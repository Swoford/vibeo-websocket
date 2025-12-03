const WebSocket = require('ws');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

// Создаем HTTP сервер
const server = http.createServer((req, res) => {
    console.log(`📄 HTTP запрос: ${req.method} ${req.url}`);
    // В server.js после создания http сервера
const https = require('https');

// Прокси для YouTube API
server.on('request', (req, res) => {
    // Прокси для iframe_api
    if (req.url === '/youtube-iframe-api') {
        console.log('📡 Проксирование YouTube API...');
        
        https.get('https://www.youtube.com/iframe_api', (youtubeRes) => {
            res.writeHead(youtubeRes.statusCode, {
                'Content-Type': 'text/javascript',
                'Cache-Control': 'public, max-age=86400'
            });
            youtubeRes.pipe(res);
        }).on('error', (err) => {
            console.error('YouTube API прокси ошибка:', err);
            res.writeHead(500);
            res.end('Error loading YouTube API');
        });
        return;
    }
    
    // Прокси для player_api
    if (req.url === '/youtube-player-api') {
        console.log('📡 Проксирование YouTube Player API...');
        
        const videoId = req.url.split('?v=')[1] || '';
        https.get(`https://www.youtube.com/s/player/${videoId}/player_ias.vflset/ru_RU/base.js`, (youtubeRes) => {
            res.writeHead(youtubeRes.statusCode, {
                'Content-Type': 'text/javascript',
                'Cache-Control': 'public, max-age=86400'
            });
            youtubeRes.pipe(res);
        }).on('error', (err) => {
            console.error('YouTube Player API ошибка:', err);
            res.writeHead(500);
            res.end('Error loading YouTube Player API');
        });
        return;
    }
});
    
    // Healthcheck для Railway
    if (req.url === '/health') {
        res.writeHead(200, { 
            'Content-Type': 'text/plain',
            'Access-Control-Allow-Origin': '*'
        });
        res.end('Vibeo Server is Running!');
        return;
    }
    
    // Обслуживаем index.html для всех маршрутов
    const filePath = path.join(__dirname, '../client/index.html');
    
    // Проверяем существование файла
    if (!fs.existsSync(filePath)) {
        console.error('❌ index.html не найден по пути:', filePath);
        res.writeHead(404);
        res.end('index.html not found');
        return;
    }
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            console.error('❌ Ошибка чтения index.html:', err);
            res.writeHead(500);
            res.end('Server error');
            return;
        }
        
        res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache'
        });
        res.end(data);
        console.log('✅ index.html отправлен клиенту');
    });
});

// WebSocket сервер
const wss = new WebSocket.Server({ 
    server,
    path: '/ws'
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
    }
    
    addUser(userId, userData, ws) {
        const isHost = userId === this.hostId;
        this.users.set(userId, { ...userData, ws, isHost });
        
        this.broadcast({
            type: 'USER_JOINED',
            user: { ...userData, isHost },
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
                isHost: isHost
            }));
        }
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
                    users: this.getUsersList()
                });
                
                console.log(`👑 Права хоста переданы пользователю ${newHost.name}`);
            }
            
            this.broadcast({
                type: 'USER_LEFT',
                userId: userId,
                userName: user.name,
                users: this.getUsersList()
            });
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
            userName: user.name
        });
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
            userId: userId
        });
        return true;
    }

    addChatMessage(message) {
        this.chatMessages.set(message.id, message);
        if (this.chatMessages.size > 100) {
            const firstKey = this.chatMessages.keys().next().value;
            this.chatMessages.delete(firstKey);
        }
        
        this.broadcast({
            type: 'CHAT_MESSAGE',
            message: message
        });
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
            reactions: message.reactions
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
            users: this.getUsersList()
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
                isHost: user.isHost
            });
            
            return true;
        }
        
        return false;
    }
    
    getUsersList() {
        return Array.from(this.users.values()).map(u => ({
            id: u.id,
            name: u.name,
            isHost: u.isHost
        }));
    }
    
    broadcast(message, excludeUserId = null) {
        this.users.forEach((user, userId) => {
            if (userId !== excludeUserId && user.ws.readyState === WebSocket.OPEN) {
                user.ws.send(JSON.stringify(message));
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
    return result;
}

function getOrCreateRoom(roomCode, userId, isHost = false) {
    if (!rooms.has(roomCode)) {
        if (!isHost) {
            throw new Error('ROOM_NOT_FOUND');
        }
        rooms.set(roomCode, new Room(roomCode, userId));
    }
    return rooms.get(roomCode);
}

setInterval(() => {
    for (const [code, room] of rooms.entries()) {
        if (room.users.size === 0) {
            rooms.delete(code);
            console.log(`🗑️ Комната ${code} удалена (нет пользователей)`);
        }
    }
}, 600000);

wss.on('connection', (ws, request) => {
    console.log('✅ НОВОЕ ПОДКЛЮЧЕНИЕ К WEBSOCKET!');
    
    const parameters = url.parse(request.url, true);
    const roomCode = parameters.query.room;
    const userId = parameters.query.userId || Math.random().toString(36).substr(2, 9);
    
    let currentRoom = null;
    let currentUser = null;

    console.log(`Новое соединение: ${userId}, комната: ${roomCode || 'не указана'}`);

    ws.send(JSON.stringify({
        type: 'CONNECTED',
        message: 'Успешно подключено к серверу'
    }));

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            console.log('📨 Получено сообщение типа:', message.type);
            
            handleMessage(message, ws);
        } catch (error) {
            console.error('Ошибка парсинга сообщения:', error);
            sendError(ws, 'INVALID_MESSAGE');
        }
    });

    ws.on('close', () => {
        console.log(`🔌 Соединение закрыто: ${userId}`);
        if (currentRoom && currentUser) {
            console.log(`Пользователь ${currentUser.name} вышел из комнаты ${currentRoom.code}`);
            currentRoom.removeUser(currentUser.id);
        }
    });

    function handleMessage(message, ws) {
        switch (message.type) {
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
                if (currentRoom && message.text) {
                    const chatMessage = {
                        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
                        text: message.text,
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
                        isHost: currentUser.id === currentRoom.hostId
                    }));
                }
                break;
        }
    }

    function handleJoinRoom(message, ws) {
        try {
            const room = getOrCreateRoom(message.roomCode, message.user.id, false);
            currentRoom = room;
            currentUser = {
                id: message.user.id,
                name: message.user.name
            };
            
            room.addUser(message.user.id, currentUser, ws);
            
            console.log(`✅ Пользователь ${currentUser.name} присоединился к комнате ${room.code}`);
            
        } catch (error) {
            console.error('Ошибка присоединения:', error);
            sendError(ws, error.message);
        }
    }

    function handleCreateRoom(message, ws) {
        const roomCode = generateRoomCode();
        const room = getOrCreateRoom(roomCode, message.user.id, true);
        currentRoom = room;
        currentUser = {
            id: message.user.id,
            name: message.user.name
        };
        
        room.addUser(message.user.id, currentUser, ws);
        
        console.log(`✅ Создана комната ${roomCode} пользователем ${currentUser.name}`);
    }

    function sendError(ws, errorCode) {
        ws.send(JSON.stringify({
            type: 'ERROR',
            error: errorCode
        }));
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 HTTP + WebSocket сервер запущен на порту ${PORT}`);
    console.log(`🌐 Healthcheck: http://0.0.0.0:${PORT}/health`);
    console.log(`📡 WebSocket: ws://0.0.0.0:${PORT}/ws`);
});

process.on('SIGINT', () => {
    console.log('Завершение работы сервера...');
    wss.close(() => {
        server.close(() => {
            console.log('Сервер остановлен');
            process.exit(0);
        });
    });
});

// Обработка ошибок
server.on('error', (error) => {
    console.error('❌ Ошибка сервера:', error);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Необработанная ошибка:', error);
});
