const WebSocket = require('ws');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Определяем пути
const CLIENT_PATH = path.join(__dirname, '..', 'client');
const ROOT_PATH = path.join(__dirname, '..');

console.log('🚀 Запуск Vibeo сервера...');
console.log('📁 Текущая директория:', __dirname);
console.log('📁 Корневая директория:', ROOT_PATH);
console.log('📁 Путь к client папке:', CLIENT_PATH);

// Ищем index.html
let indexHtmlContent = '';
let indexHtmlPath = '';

const possiblePaths = [
    path.join(CLIENT_PATH, 'index.html'),
    path.join(ROOT_PATH, 'index.html'),
    path.join(__dirname, 'index.html'),
    'index.html'
];

for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
        indexHtmlPath = p;
        try {
            indexHtmlContent = fs.readFileSync(p, 'utf8');
            console.log(`✅ index.html найден по пути: ${p}`);
            break;
        } catch (err) {
            console.error(`❌ Ошибка чтения ${p}:`, err.message);
        }
    }
}

if (!indexHtmlContent) {
    console.error('❌ index.html не найден! Создаю заглушку...');
    indexHtmlContent = `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vibeo - Совместный просмотр видео</title>
    <style>
        body {
            background: #0f172a;
            color: white;
            font-family: Arial, sans-serif;
            text-align: center;
            padding: 50px;
            margin: 0;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
        }
        h1 {
            color: #3b82f6;
            margin-bottom: 20px;
        }
        .status {
            background: rgba(255,255,255,0.1);
            padding: 20px;
            border-radius: 10px;
            margin: 20px 0;
        }
        .success {
            color: #10b981;
        }
        .error {
            color: #ef4444;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎬 Vibeo</h1>
        <div class="status">
            <p class="success">✅ Сервер работает!</p>
            <p class="error">⚠️ Но index.html не найден в ожидаемом месте</p>
            <p>Пожалуйста, проверьте структуру файлов:</p>
            <pre style="text-align: left; background: rgba(0,0,0,0.3); padding: 15px; border-radius: 5px;">
/client/
  index.html  ← должен быть здесь
/server/
  server.js   ← этот файл
package.json</pre>
        </div>
    </div>
</body>
</html>`;
}

// Кэш для проксированных ресурсов
const cache = new Map();

// Проксирование YouTube API
async function proxyYouTubeResource(reqUrl, res) {
    console.log(`📡 Проксирование: ${reqUrl}`);
    
    const targetUrl = `https://www.youtube.com${reqUrl}`;
    
    // Проверяем кэш
    if (cache.has(targetUrl)) {
        console.log('✅ Отдаю из кэша:', reqUrl);
        const cached = cache.get(targetUrl);
        res.writeHead(200, cached.headers);
        res.end(cached.data);
        return;
    }
    
    return new Promise((resolve) => {
        https.get(targetUrl, (youtubeRes) => {
            const chunks = [];
            
            youtubeRes.on('data', (chunk) => {
                chunks.push(chunk);
            });
            
            youtubeRes.on('end', () => {
                const data = Buffer.concat(chunks);
                
                // Кэшируем только успешные ответы
                if (youtubeRes.statusCode === 200) {
                    cache.set(targetUrl, {
                        data: data,
                        headers: {
                            'Content-Type': youtubeRes.headers['content-type'] || 'text/javascript',
                            'Cache-Control': 'public, max-age=86400'
                        }
                    });
                    console.log(`✅ Загружено и закэшировано: ${reqUrl}`);
                }
                
                res.writeHead(youtubeRes.statusCode, {
                    'Content-Type': youtubeRes.headers['content-type'] || 'text/javascript',
                    'Cache-Control': 'public, max-age=86400'
                });
                res.end(data);
                resolve();
            });
        }).on('error', (err) => {
            console.error(`❌ Ошибка проксирования ${reqUrl}:`, err.message);
            res.writeHead(500);
            res.end('Error loading resource');
            resolve();
        });
    });
}

const server = http.createServer(async (req, res) => {
    const startTime = Date.now();
    console.log(`\n📄 ${req.method} ${req.url}`);
    
    // === ВАЖНО: Заголовки для VK Mini Apps ===
    // Разрешаем загрузку в iframe от VK
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self' vk.com *.vk.com vk.ru *.vk.ru https://vk.com https://*.vk.com https://vk.ru https://*.vk.ru;");
    
    // Старый стандарт для iframe (для старых браузеров)
    res.setHeader('X-Frame-Options', 'ALLOW-FROM https://vk.com');
    
    // CORS заголовки
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    // Дополнительные заголовки безопасности
    res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    // Обрабатываем OPTIONS запросы для CORS (предзапросы)
    if (req.method === 'OPTIONS') {
        console.log('🔄 Обработка CORS preflight запроса');
        res.writeHead(200);
        res.end();
        return;
    }
    
    // Healthcheck для Railway
    if (req.url === '/health' || req.url === '/ping') {
        res.writeHead(200, { 
            'Content-Type': 'text/plain',
            'Cache-Control': 'no-cache'
        });
        res.end('Vibeo Server is Running!');
        console.log(`✅ Healthcheck - ${Date.now() - startTime}ms`);
        return;
    }
    
    // Проксирование YouTube API
    if (req.url === '/youtube-iframe-api' || 
        req.url === '/iframe_api' ||
        req.url === '/s/player/api_player' ||
        req.url.startsWith('/s/player/') ||
        req.url.includes('www-widgetapi')) {
        
        await proxyYouTubeResource(req.url, res);
        console.log(`✅ Прокси завершено - ${Date.now() - startTime}ms`);
        return;
    }
    
    // Проксирование для других YouTube ресурсов
    if (req.url.includes('youtube.com') || req.url.includes('youtubei')) {
        await proxyYouTubeResource(req.url, res);
        console.log(`✅ YouTube прокси завершено - ${Date.now() - startTime}ms`);
        return;
    }
    
    // Обслуживаем статические файлы
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = filePath.split('?')[0]; // Убираем query параметры
    
    // Защита от path traversal атак
    if (filePath.includes('..')) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    
    // Пытаемся найти файл
    let foundPath = '';
    let isDirectory = false;
    
    const searchPaths = [
        path.join(CLIENT_PATH, filePath),
        path.join(ROOT_PATH, filePath),
        path.join(__dirname, filePath)
    ];
    
    for (const p of searchPaths) {
        try {
            if (fs.existsSync(p)) {
                const stat = fs.statSync(p);
                if (stat.isDirectory()) {
                    isDirectory = true;
                    // Для директорий ищем index.html внутри
                    const indexPath = path.join(p, 'index.html');
                    if (fs.existsSync(indexPath)) {
                        foundPath = indexPath;
                        break;
                    }
                } else {
                    foundPath = p;
                    break;
                }
            }
        } catch (err) {
            // Игнорируем ошибки, продолжаем поиск
        }
    }
    
    // Если файл не найден или это директория без index.html, отдаем главную страницу
    if (!foundPath || isDirectory) {
        console.log(`📄 Отдаю index.html (${filePath} не найден)`);
        res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        res.end(indexHtmlContent);
        console.log(`✅ HTML отправлен - ${Date.now() - startTime}ms`);
        return;
    }
    
    // Определяем Content-Type
    const ext = path.extname(foundPath).toLowerCase();
    const mimeTypes = {
        '.html': 'text/html',
        '.htm': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml',
        '.ico': 'image/x-icon',
        '.txt': 'text/plain',
        '.pdf': 'application/pdf',
        '.zip': 'application/zip'
    };
    
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    // Читаем и отдаем файл
    fs.readFile(foundPath, (err, data) => {
        if (err) {
            console.error('❌ Ошибка чтения файла:', err.message);
            res.writeHead(500);
            res.end('Server Error');
            return;
        }
        
        res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600'
        });
        res.end(data);
        console.log(`✅ Файл отправлен: ${foundPath} - ${Date.now() - startTime}ms`);
    });
});

// WebSocket сервер
const wss = new WebSocket.Server({ 
    server,
    path: '/ws',
    perMessageDeflate: {
        zlibDeflateOptions: {
            chunkSize: 1024,
            memLevel: 7,
            level: 3
        },
        zlibInflateOptions: {
            chunkSize: 10 * 1024
        },
        clientNoContextTakeover: true,
        serverNoContextTakeover: true,
        serverMaxWindowBits: 10,
        concurrencyLimit: 10,
        threshold: 1024
    }
});

const rooms = new Map();

class Room {
    constructor(code, hostId) {
        this.code = code;
        this.hostId = hostId;
        this.users = new Map();
        this.video = null;
        this.playbackState = { playing: false, time: 0 };
        this.chatMessages = new Map();
        this.createdAt = Date.now();
    }
    
    addUser(userId, userData, ws) {
        const isHost = userId === this.hostId;
        const userWithWs = { 
            ...userData, 
            ws, 
            isHost,
            joinedAt: Date.now(),
            lastActive: Date.now()
        };
        
        this.users.set(userId, userWithWs);
        
        this.broadcast({
            type: 'USER_JOINED',
            user: { 
                id: userData.id, 
                name: userData.name, 
                isHost 
            },
            users: this.getUsersList()
        }, userId);

        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'ROOM_STATE',
                room: this.code,
                video: this.video,
                playbackState: this.playbackState,
                users: this.getUsersList(),
                chatMessages: Array.from(this.chatMessages.values()).slice(-50),
                isHost: isHost,
                timestamp: Date.now()
            }));
        }
        
        console.log(`👤 ${userData.name} присоединился к комнате ${this.code}`);
    }
    
    removeUser(userId) {
        const user = this.users.get(userId);
        if (user) {
            this.users.delete(userId);
            
            if (userId === this.hostId && this.users.size > 0) {
                const newHost = this.users.values().next().value;
                this.hostId = newHost.id;
                newHost.isHost = true;
                
                this.broadcast({
                    type: 'HOST_CHANGED',
                    newHostId: newHost.id,
                    newHostName: newHost.name,
                    users: this.getUsersList(),
                    timestamp: Date.now()
                });
                
                console.log(`👑 Права хоста переданы от ${user.name} к ${newHost.name}`);
            }
            
            this.broadcast({
                type: 'USER_LEFT',
                userId: userId,
                userName: user.name,
                users: this.getUsersList(),
                timestamp: Date.now()
            });
            
            console.log(`👤 ${user.name} вышел из комнаты ${this.code}`);
        }
    }
    
    changeVideo(videoData, userId) {
        const user = this.users.get(userId);
        if (!user || !user.isHost) {
            return false;
        }
        
        this.video = videoData;
        this.broadcast({
            type: 'VIDEO_CHANGED',
            video: videoData,
            userId: userId,
            userName: user.name,
            timestamp: Date.now()
        });
        
        console.log(`🎬 ${user.name} сменил видео на: ${videoData.title || videoData.id}`);
        return true;
    }
    
    updatePlayback(state, userId) {
        const user = this.users.get(userId);
        if (!user || !user.isHost) {
            return false;
        }
        
        this.playbackState = state;
        this.broadcast({
            type: 'PLAYBACK_SYNC',
            state: state,
            userId: userId,
            timestamp: Date.now()
        });
        return true;
    }

    addChatMessage(message) {
        this.chatMessages.set(message.id, message);
        
        // Ограничиваем историю сообщений
        if (this.chatMessages.size > 100) {
            const firstKey = this.chatMessages.keys().next().value;
            this.chatMessages.delete(firstKey);
        }
        
        this.broadcast({
            type: 'CHAT_MESSAGE',
            message: message
        });
        
        console.log(`💬 ${message.author}: ${message.text.substring(0, 50)}${message.text.length > 50 ? '...' : ''}`);
    }

    toggleReaction(messageId, reaction, userId) {
        const message = this.chatMessages.get(messageId);
        if (!message) return;

        if (!message.reactions) {
            message.reactions = {};
        }
        if (!message.reactions[reaction]) {
            message.reactions[reaction] = [];
        }

        const userIndex = message.reactions[reaction].indexOf(userId);
        
        if (userIndex > -1) {
            message.reactions[reaction].splice(userIndex, 1);
            if (message.reactions[reaction].length === 0) {
                delete message.reactions[reaction];
            }
        } else {
            message.reactions[reaction].push(userId);
        }

        this.chatMessages.set(messageId, message);

        this.broadcast({
            type: 'REACTION_UPDATE',
            messageId: messageId,
            reactions: message.reactions,
            timestamp: Date.now()
        });
    }

    transferHost(newHostId, currentUserId) {
        const currentUser = this.users.get(currentUserId);
        const newHost = this.users.get(newHostId);
        
        if (!currentUser || !currentUser.isHost || !newHost) {
            return false;
        }
        
        currentUser.isHost = false;
        this.hostId = newHostId;
        newHost.isHost = true;
        
        this.broadcast({
            type: 'HOST_CHANGED',
            newHostId: newHostId,
            newHostName: newHost.name,
            users: this.getUsersList(),
            timestamp: Date.now()
        });
        
        console.log(`👑 Права хоста переданы от ${currentUser.name} к ${newHost.name}`);
        return true;
    }

    deleteMessage(messageId, userId) {
        const message = this.chatMessages.get(messageId);
        if (!message) return false;
        
        const user = this.users.get(userId);
        
        if (message.userId === userId || (user && user.isHost)) {
            this.chatMessages.delete(messageId);
            
            this.broadcast({
                type: 'MESSAGE_DELETED',
                messageId: messageId,
                deletedBy: userId,
                isHost: user.isHost,
                timestamp: Date.now()
            });
            
            console.log(`🗑️ Сообщение удалено пользователем ${user?.name || 'unknown'}`);
            return true;
        }
        
        return false;
    }
    
    getUsersList() {
        return Array.from(this.users.values()).map(u => ({
            id: u.id,
            name: u.name,
            isHost: u.isHost,
            joinedAt: u.joinedAt
        }));
    }
    
    broadcast(message, excludeUserId = null) {
        this.users.forEach((user, userId) => {
            if (userId !== excludeUserId && user.ws.readyState === WebSocket.OPEN) {
                try {
                    user.ws.send(JSON.stringify(message));
                    user.lastActive = Date.now();
                } catch (err) {
                    console.error('❌ Ошибка отправки сообщения:', err.message);
                }
            }
        });
    }
    
    // Очистка неактивных пользователей
    cleanupInactiveUsers(timeout = 300000) { // 5 минут
        const now = Date.now();
        this.users.forEach((user, userId) => {
            if (now - user.lastActive > timeout) {
                console.log(`⏰ Удаляю неактивного пользователя: ${user.name}`);
                this.removeUser(userId);
            }
        });
    }
}

function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Проверяем, не существует ли уже такой комнаты
    if (rooms.has(result)) {
        return generateRoomCode(); // Рекурсивно генерируем новый код
    }
    
    return result;
}

function getOrCreateRoom(roomCode, userId, isHost = false) {
    if (!rooms.has(roomCode)) {
        if (!isHost) {
            throw new Error('ROOM_NOT_FOUND');
        }
        rooms.set(roomCode, new Room(roomCode, userId));
        console.log(`🏠 Создана новая комната: ${roomCode}`);
    }
    return rooms.get(roomCode);
}

// Очистка неактивных комнат и пользователей
setInterval(() => {
    const now = Date.now();
    let cleanedRooms = 0;
    let cleanedUsers = 0;
    
    for (const [code, room] of rooms.entries()) {
        // Очищаем неактивных пользователей в комнате
        room.cleanupInactiveUsers();
        
        // Удаляем комнату, если пустая или очень старая (24 часа)
        if (room.users.size === 0 || (now - room.createdAt > 86400000)) {
            rooms.delete(code);
            cleanedRooms++;
            console.log(`🗑️ Удалена комната ${code}`);
        }
    }
    
    if (cleanedRooms > 0 || cleanedUsers > 0) {
        console.log(`🧹 Очистка: удалено ${cleanedRooms} комнат`);
    }
}, 60000); // Каждую минуту

// Обработка WebSocket соединений
wss.on('connection', (ws, request) => {
    console.log('🔌 Новое WebSocket соединение');
    
    const parameters = url.parse(request.url, true);
    const roomCode = parameters.query.room;
    const userId = parameters.query.userId || Math.random().toString(36).substr(2, 9);
    const userIp = request.socket.remoteAddress;
    
    let currentRoom = null;
    let currentUser = null;

    console.log(`👤 Подключение: ID=${userId}, комната=${roomCode || 'новая'}, IP=${userIp}`);

    // Отправляем подтверждение подключения
    ws.send(JSON.stringify({
        type: 'CONNECTED',
        message: 'Успешно подключено к серверу',
        userId: userId,
        timestamp: Date.now()
    }));

    // Обработка ping/pong для поддержания соединения
    ws.isAlive = true;
    ws.on('pong', () => {
        ws.isAlive = true;
    });

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            
            // Логируем только не heartbeat сообщения
            if (message.type !== 'PING') {
                console.log(`📨 ${currentUser?.name || 'unknown'}: ${message.type}`);
            }
            
            handleMessage(message, ws);
        } catch (error) {
            console.error('❌ Ошибка парсинга сообщения:', error.message);
            sendError(ws, 'INVALID_MESSAGE');
        }
    });

    ws.on('close', () => {
        console.log(`🔌 Соединение закрыто: ${currentUser?.name || userId}`);
        if (currentRoom && currentUser) {
            currentRoom.removeUser(currentUser.id);
        }
    });

    ws.on('error', (error) => {
        console.error(`❌ WebSocket ошибка для ${currentUser?.name || userId}:`, error.message);
    });

    function handleMessage(message, ws) {
        // Обновляем активность пользователя
        if (currentUser && currentRoom) {
            const user = currentRoom.users.get(currentUser.id);
            if (user) {
                user.lastActive = Date.now();
            }
        }
        
        switch (message.type) {
            case 'PING':
                // Heartbeat
                ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
                break;
                
            case 'JOIN_ROOM':
                handleJoinRoom(message, ws);
                break;
                
            case 'CREATE_ROOM':
                handleCreateRoom(message, ws);
                break;
                
            case 'CHANGE_VIDEO':
                if (currentRoom) {
                    const success = currentRoom.changeVideo(message.video, currentUser.id);
                    if (!success) {
                        sendError(ws, 'ONLY_HOST_CAN_CHANGE_VIDEO');
                    }
                }
                break;
                
            case 'PLAYBACK_UPDATE':
                if (currentRoom) {
                    const success = currentRoom.updatePlayback(message.state, currentUser.id);
                    if (!success) {
                        sendError(ws, 'ONLY_HOST_CAN_CONTROL_PLAYBACK');
                    }
                }
                break;
                
            case 'CHAT_MESSAGE':
                if (currentRoom && message.text && message.text.trim()) {
                    const chatMessage = {
                        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                        text: message.text.trim(),
                        author: currentUser.name,
                        userId: currentUser.id,
                        timestamp: Date.now(),
                        isHost: currentUser.id === currentRoom.hostId,
                        reactions: {}
                    };
                    currentRoom.addChatMessage(chatMessage);
                }
                break;

            case 'TOGGLE_REACTION':
                if (currentRoom && message.messageId && message.reaction) {
                    currentRoom.toggleReaction(message.messageId, message.reaction, message.userId);
                }
                break;

            case 'TRANSFER_HOST':
                if (currentRoom) {
                    const success = currentRoom.transferHost(message.newHostId, currentUser.id);
                    if (!success) {
                        sendError(ws, 'ONLY_HOST_CAN_TRANSFER');
                    }
                }
                break;

            case 'DELETE_MESSAGE':
                if (currentRoom && message.messageId) {
                    const success = currentRoom.deleteMessage(message.messageId, currentUser.id);
                    if (!success) {
                        sendError(ws, 'NO_PERMISSION_TO_DELETE');
                    }
                }
                break;
                
            case 'SYNC_REQUEST':
                if (currentRoom) {
                    ws.send(JSON.stringify({
                        type: 'ROOM_SYNC',
                        room: currentRoom.code,
                        video: currentRoom.video,
                        playbackState: currentRoom.playbackState,
                        users: currentRoom.getUsersList(),
                        isHost: currentUser.id === currentRoom.hostId,
                        timestamp: Date.now()
                    }));
                }
                break;
        }
    }

    function handleJoinRoom(message, ws) {
        try {
            if (!message.roomCode || message.roomCode.length !== 6) {
                throw new Error('INVALID_ROOM_CODE');
            }
            
            const room = getOrCreateRoom(message.roomCode, message.user.id, false);
            currentRoom = room;
            currentUser = {
                id: message.user.id,
                name: message.user.name.substring(0, 30) // Ограничиваем длину имени
            };
            
            room.addUser(message.user.id, currentUser, ws);
            
        } catch (error) {
            console.error('❌ Ошибка присоединения:', error.message);
            sendError(ws, error.message);
        }
    }

    function handleCreateRoom(message, ws) {
        const roomCode = generateRoomCode();
        const room = getOrCreateRoom(roomCode, message.user.id, true);
        currentRoom = room;
        currentUser = {
            id: message.user.id,
            name: message.user.name.substring(0, 30)
        };
        
        room.addUser(message.user.id, currentUser, ws);
        
        console.log(`🏠 Создана комната ${roomCode} пользователем ${currentUser.name}`);
    }

    function sendError(ws, errorCode) {
        ws.send(JSON.stringify({
            type: 'ERROR',
            error: errorCode,
            timestamp: Date.now()
        }));
    }
});

// Heartbeat для WebSocket соединений
setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            console.log('💔 Закрываю неотвечающее соединение');
            return ws.terminate();
        }
        
        ws.isAlive = false;
        try {
            ws.ping();
        } catch (err) {
            // Игнорируем ошибки ping
        }
    });
}, 30000); // Каждые 30 секунд

// Запуск сервера
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(50));
    console.log('🚀 Vibeo сервер успешно запущен!');
    console.log('='.repeat(50));
    console.log(`📡 Порт: ${PORT}`);
    console.log(`🌐 HTTP: http://0.0.0.0:${PORT}`);
    console.log(`🔗 WebSocket: ws://0.0.0.0:${PORT}/ws`);
    console.log(`❤️  Healthcheck: http://0.0.0.0:${PORT}/health`);
    console.log(`📹 YouTube прокси: http://0.0.0.0:${PORT}/youtube-iframe-api`);
    console.log(`📁 Обслуживается из: ${indexHtmlPath || 'в памяти'}`);
    console.log('='.repeat(50) + '\n');
});

// Обработка graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🔻 Получен SIGINT, завершаю работу...');
    
    // Закрываем все WebSocket соединения
    wss.clients.forEach((client) => {
        client.close();
    });
    
    wss.close(() => {
        server.close(() => {
            console.log('✅ Сервер остановлен');
            process.exit(0);
        });
    });
    
    // Таймаут на случай если закрытие затянется
    setTimeout(() => {
        console.log('⚠️ Принудительное завершение');
        process.exit(1);
    }, 5000);
});

process.on('SIGTERM', () => {
    console.log('\n🔻 Получен SIGTERM, завершаю работу...');
    wss.close();
    server.close();
});

// Обработка ошибок
server.on('error', (error) => {
    console.error('❌ Ошибка сервера:', error.message);
    if (error.code === 'EADDRINUSE') {
        console.error(`⚠️ Порт ${PORT} уже занят. Попробуйте другой порт.`);
    }
});

process.on('uncaughtException', (error) => {
    console.error('❌ Необработанная ошибка:', error);
    console.error(error.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Необработанный промис:', reason);
});
