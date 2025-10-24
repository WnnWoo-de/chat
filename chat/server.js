const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 存储在线用户信息
const onlineUsers = new Map();

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Socket.IO连接处理
io.on('connection', (socket) => {
    console.log('用户连接:', socket.id);

    // 用户加入聊天室
    socket.on('join', (username) => {
        // 检查用户名是否已存在
        const existingUser = Array.from(onlineUsers.values()).find(user => user.username === username);
        if (existingUser) {
            socket.emit('username-taken', '用户名已被占用，请选择其他用户名');
            return;
        }

        // 添加用户到在线列表
        onlineUsers.set(socket.id, {
            username: username,
            joinTime: new Date()
        });

        socket.username = username;
        
        // 通知所有用户有新用户加入
        socket.broadcast.emit('user-joined', {
            username: username,
            message: `${username} 加入了聊天室`,
            timestamp: new Date().toLocaleString('zh-CN')
        });

        // 发送当前在线用户列表给新用户
        const userList = Array.from(onlineUsers.values()).map(user => user.username);
        socket.emit('user-list', userList);
        
        // 向所有用户广播更新的用户列表
        io.emit('update-user-list', userList);

        console.log(`${username} 加入聊天室`);
    });

    // 处理聊天消息
    socket.on('chat-message', (data) => {
        if (!socket.username) {
            return;
        }

        const messageData = {
            username: socket.username,
            message: data.message,
            timestamp: new Date().toLocaleString('zh-CN')
        };

        // 广播消息给所有用户（包括发送者）
        io.emit('chat-message', messageData);
        
        console.log(`${socket.username}: ${data.message}`);
    });

    // 处理用户断开连接
    socket.on('disconnect', () => {
        if (socket.username) {
            // 从在线用户列表中移除
            onlineUsers.delete(socket.id);
            
            // 通知其他用户有用户离开
            socket.broadcast.emit('user-left', {
                username: socket.username,
                message: `${socket.username} 离开了聊天室`,
                timestamp: new Date().toLocaleString('zh-CN')
            });

            // 向所有用户广播更新的用户列表
            const userList = Array.from(onlineUsers.values()).map(user => user.username);
            io.emit('update-user-list', userList);

            console.log(`${socket.username} 离开聊天室`);
        }
        console.log('用户断开连接:', socket.id);
    });

    // 处理正在输入状态
    socket.on('typing', (data) => {
        socket.broadcast.emit('user-typing', {
            username: socket.username,
            isTyping: data.isTyping
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`聊天室服务器运行在 http://localhost:${PORT}`);
});