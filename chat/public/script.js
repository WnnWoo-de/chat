// Socket.IO连接
const socket = io();

// DOM元素
const loginContainer = document.getElementById('login-container');
const chatContainer = document.getElementById('chat-container');
const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');
const errorMessage = document.getElementById('error-message');
const currentUser = document.getElementById('current-user');
const logoutBtn = document.getElementById('logout-btn');
const usersList = document.getElementById('users-list');
const userCount = document.getElementById('user-count');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const typingIndicator = document.getElementById('typing-indicator');
const privateTargetWrap = document.getElementById('private-target');
const privateTargetName = document.getElementById('private-target-name');
const cancelPrivateBtn = document.getElementById('cancel-private-btn');

// 全局变量
let username = '';
let typingTimer;
let isTyping = false;
let privateTarget = null; // 当前私聊对象
let unreadCount = 0;
const defaultTitle = document.title;

// 初始化事件监听器
function initEventListeners() {
    // 加入聊天室
    joinBtn.addEventListener('click', joinChat);
    usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            joinChat();
        }
    });

    // 退出聊天室
    logoutBtn.addEventListener('click', logout);

    // 发送消息
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // 输入状态检测
    messageInput.addEventListener('input', handleTyping);
    messageInput.addEventListener('blur', stopTyping);

    // 用户列表委托点击以设置私聊
    usersList.addEventListener('click', (e) => {
        const li = e.target.closest('li');
        if (!li) return;
        const targetName = li.dataset.username || li.textContent.trim();
        if (!targetName || targetName === username) {
            // 点击自己或空白则取消私聊
            clearPrivateTarget();
            return;
        }
        setPrivateTarget(targetName);
        // 高亮选中项
        Array.from(usersList.children).forEach(node => node.classList.remove('active'));
        li.classList.add('active');
    });

    // 取消私聊
    cancelPrivateBtn.addEventListener('click', clearPrivateTarget);

    // 未读消息计数：标签页可见性变化
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            resetUnread();
        }
    });
}

function setPrivateTarget(name) {
    privateTarget = name;
    privateTargetName.textContent = name;
    privateTargetWrap.style.display = 'inline-flex';
}

function clearPrivateTarget() {
    privateTarget = null;
    privateTargetName.textContent = '';
    privateTargetWrap.style.display = 'none';
    Array.from(usersList.children).forEach(node => node.classList.remove('active'));
}

// 加入聊天室
function joinChat() {
    const inputUsername = usernameInput.value.trim();
    
    if (!inputUsername) {
        showError('请输入用户名');
        return;
    }

    if (inputUsername.length > 20) {
        showError('用户名不能超过20个字符');
        return;
    }

    username = inputUsername;
    socket.emit('join', username);
}

// 发送消息
function sendMessage() {
    const message = messageInput.value.trim();
    
    if (!message) {
        return;
    }

    if (message.length > 500) {
        alert('消息不能超过500个字符');
        return;
    }

    if (privateTarget) {
        socket.emit('private-message', { to: privateTarget, message });
    } else {
        socket.emit('chat-message', { message });
    }

    messageInput.value = '';
    stopTyping();
}

// 处理输入状态
function handleTyping() {
    if (!isTyping) {
        isTyping = true;
        socket.emit('typing', { isTyping: true });
    }

    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
        stopTyping();
    }, 1000);
}

// 停止输入状态
function stopTyping() {
    if (isTyping) {
        isTyping = false;
        socket.emit('typing', { isTyping: false });
    }
    clearTimeout(typingTimer);
}

// 退出聊天室
function logout() {
    socket.disconnect();
    loginContainer.style.display = 'flex';
    chatContainer.style.display = 'none';
    usernameInput.value = '';
    messageInput.value = '';
    messagesContainer.innerHTML = '<div class="welcome-message"><p>欢迎来到实时聊天室！开始聊天吧～</p></div>';
    usersList.innerHTML = '';
    userCount.textContent = '0';
    username = '';
    clearPrivateTarget();
    errorMessage.textContent = '';
    resetUnread();
    localStorage.removeItem('chat_username');
    
    // 重新连接
    setTimeout(() => {
        socket.connect();
    }, 100);
}

// 显示错误信息
function showError(message) {
    errorMessage.textContent = message;
    setTimeout(() => {
        errorMessage.textContent = '';
    }, 3000);
}

// 添加消息到聊天区域
function addMessage(data, type = 'other') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;

    if (type === 'system') {
        messageDiv.innerHTML = `
            <div class="message-content">${data.message}</div>
            <div class="timestamp">${data.timestamp}</div>
        `;
    } else if (type === 'private') {
        const isOwn = data.from === username;
        messageDiv.className = `message ${isOwn ? 'own' : 'other'} private`;
        const displayName = isOwn ? `${data.from} → ${data.to}` : `${data.from} → 你`;
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="username">${displayName}</span>
                <span class="badge private">私聊</span>
                <span class="timestamp">${data.timestamp}</span>
            </div>
            <div class="message-content">${escapeHtml(data.message)}</div>
        `;
    } else {
        const isOwn = data.username === username;
        messageDiv.className = `message ${isOwn ? 'own' : 'other'}`;
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <span class="username">${data.username}</span>
                <span class="timestamp">${data.timestamp}</span>
            </div>
            <div class="message-content">${escapeHtml(data.message)}</div>
        `;
    }

    messagesContainer.appendChild(messageDiv);
    scrollToBottom();

    // 更新未读计数
    if (document.hidden) {
        unreadCount += 1;
        updateTitleUnread();
    }
}

// 渲染历史消息（公共消息）
function renderHistory(history) {
    messagesContainer.innerHTML = '';
    if (Array.isArray(history)) {
        history.forEach(item => addMessage(item));
    }
}

// 更新在线用户列表
function updateUsersList(users) {
    usersList.innerHTML = '';
    userCount.textContent = users.length;

    users.forEach(user => {
        const li = document.createElement('li');
        li.textContent = user;
        li.setAttribute('data-username', user);
        if (user === username) {
            li.style.fontWeight = 'bold';
            li.style.color = '#667eea';
        }
        usersList.appendChild(li);
    });
}

// 滚动到底部
function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// HTML转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateTitleUnread() {
    document.title = unreadCount > 0 ? `(${unreadCount}) ${defaultTitle}` : defaultTitle;
}

function resetUnread() {
    unreadCount = 0;
    updateTitleUnread();
}

// Socket.IO事件监听器
socket.on('connect', () => {
    console.log('连接到服务器');
    // 自动加入：如果有本地用户名且当前未进入聊天页
    const saved = localStorage.getItem('chat_username');
    if (saved && chatContainer.style.display === 'none') {
        usernameInput.value = saved;
        joinChat();
    }
});

socket.on('disconnect', () => {
    console.log('与服务器断开连接');
    if (chatContainer.style.display !== 'none') {
        addMessage({
            message: '与服务器连接断开，请刷新页面重新连接',
            timestamp: new Date().toLocaleString('zh-CN')
        }, 'system');
    }
});

// 用户名被占用
socket.on('username-taken', (message) => {
    showError(message);
});

// 成功加入聊天室
socket.on('user-list', (users) => {
    loginContainer.style.display = 'none';
    chatContainer.style.display = 'flex';
    currentUser.textContent = username;
    updateUsersList(users);
    messageInput.focus();
    localStorage.setItem('chat_username', username);
});

// 历史消息
socket.on('history', (history) => {
    renderHistory(history);
});

// 更新用户列表
socket.on('update-user-list', (users) => {
    updateUsersList(users);
});

// 接收公共聊天消息
socket.on('chat-message', (data) => {
    addMessage(data);
});

// 用户加入通知
socket.on('user-joined', (data) => {
    addMessage(data, 'system');
});

// 用户离开通知
socket.on('user-left', (data) => {
    addMessage(data, 'system');
});

// 用户正在输入
socket.on('user-typing', (data) => {
    if (data.isTyping) {
        typingIndicator.textContent = `${data.username} 正在输入...`;
    } else {
        typingIndicator.textContent = '';
    }
});

// 私聊消息
socket.on('private-message', (data) => {
    addMessage(data, 'private');
});

socket.on('private-error', (err) => {
    showError(err.message || '私聊失败');
});

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    usernameInput.focus();
});