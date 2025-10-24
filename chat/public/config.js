// 在不同环境中设置后端 Socket 服务地址
// 默认留空表示同源（本地开发使用 http://localhost:PORT ）
// 部署到 Vercel 前端 + Render 后端时，填写 Render 服务地址，例如：
// window.SOCKET_URL = 'https://realtime-chat-room.onrender.com';

window.SOCKET_URL = window.SOCKET_URL || '';