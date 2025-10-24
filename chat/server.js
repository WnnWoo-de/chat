const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// 存储在线用户信息：socketId -> { username, joinTime }
const onlineUsers = new Map();
// 聊天记录（只存最近50条公共消息）
const messageHistory = [];
const MAX_HISTORY = 50;

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

function getUserList() {
    return Array.from(onlineUsers.values()).map(u => u.username);
}

function findSocketIdByUsername(name) {
    for (const [sid, info] of onlineUsers.entries()) {
        if (info.username === name) return sid;
    }
    return null;
}

function pushHistory(messageData) {
    messageHistory.push(messageData);
    if (messageHistory.length > MAX_HISTORY) {
        messageHistory.shift();
    }
}

// Socket.IO连接处理
io.on('connection', (socket) => {
    console.log('用户连接:', socket.id);

    // 用户加入聊天室
    socket.on('join', (username) => {
        const name = String(username).trim();
        if (!name) {
            socket.emit('username-taken', '用户名不能为空');
            return;
        }

        // 检查用户名是否已存在
        const existingUser = Array.from(onlineUsers.values()).find(u => u.username === name);
        if (existingUser) {
            socket.emit('username-taken', '用户名已被占用，请选择其他用户名');
            return;
        }

        // 添加用户到在线列表
        onlineUsers.set(socket.id, {
            username: name,
            joinTime: new Date()
        });
        socket.username = name;

        // 通知所有用户有新用户加入（系统消息）
        socket.broadcast.emit('user-joined', {
            username: name,
            message: `${name} 加入了聊天室`,
            timestamp: new Date().toLocaleString('zh-CN')
        });

        // 发送当前在线用户列表给新用户
        const userList = getUserList();
        socket.emit('user-list', userList);

        // 下发最近聊天记录给新用户
        socket.emit('history', messageHistory);

        // 向所有用户广播更新的用户列表
        io.emit('update-user-list', userList);

        console.log(`${name} 加入聊天室`);
    });

    // 处理公共聊天消息
    socket.on('chat-message', (data) => {
        if (!socket.username) return;
        const text = data && data.message ? String(data.message) : '';
        if (!text.trim()) return;

        const messageData = {
            username: socket.username,
            message: text,
            timestamp: new Date().toLocaleString('zh-CN')
        };

        // 存入历史并广播
        pushHistory(messageData);
        io.emit('chat-message', messageData);
        console.log(`${socket.username}: ${text}`);
    });

    // 私聊消息：仅发送给目标用户与发送者自己
    socket.on('private-message', (data) => {
        if (!socket.username) return;
        const toUser = data && data.to ? String(data.to) : '';
        const text = data && data.message ? String(data.message) : '';
        if (!toUser || !text.trim()) return;

        const targetSid = findSocketIdByUsername(toUser);
        const payload = {
            from: socket.username,
            to: toUser,
            message: text,
            timestamp: new Date().toLocaleString('zh-CN')
        };

        if (!targetSid) {
            socket.emit('private-error', { message: `用户 ${toUser} 不在线或不存在` });
            return;
        }

        // 发送给目标与发送者自己
        io.to(targetSid).emit('private-message', payload);
        socket.emit('private-message', payload);
        console.log(`[私聊] ${socket.username} -> ${toUser}: ${text}`);
    });

    // 处理正在输入状态（公共提示）
    socket.on('typing', (data) => {
        socket.broadcast.emit('user-typing', {
            username: socket.username,
            isTyping: !!(data && data.isTyping)
        });
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
            io.emit('update-user-list', getUserList());

            console.log(`${socket.username} 离开聊天室`);
        }
        console.log('用户断开连接:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`聊天室服务器运行在 http://localhost:${PORT}`);
});