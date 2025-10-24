// 客户端配置：用于在Vercel静态站点通过Socket.IO连接远端后端
// 将下方地址改为你部署的后端Socket服务器域名，例如：
// window.CHAT_SERVER_URL = "https://your-socket-server.example.com";
// 留空表示同源（本地开发或前后端同域部署）
window.CHAT_SERVER_URL = "";

// Socket.IO路径（一般保持默认即可）
window.CHAT_SOCKET_PATH = "/socket.io";