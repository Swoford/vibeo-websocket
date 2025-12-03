const WebSocket = require('ws');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Определяем пути
const CLIENT_PATH = path.join(__dirname, '..', 'client');
const ROOT_PATH = path.join(__dirname, '..');

console.log('🚀 Запуск Vibeo сервера для VK Mini Apps...');
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
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            text-align: center;
            padding: 40px 20px;
            margin: 0;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            max-width: 600px;
            width: 100%;
            background: rgba(30, 41, 59, 0.8);
            backdrop-filter: blur(10px);
            padding: 40px;
            border-radius: 20px;
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        }
        h1 {
            color: #3b82f6;
            margin-bottom: 20px;
            font-size: 2.5rem;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 15px;
        }
        .status {
            background: linear-gradient(135deg, #10b981, #0ea5e9);
            color: white;
            padding: 25px;
            border-radius: 15px;
            margin: 30px 0;
            font-size: 1.2rem;
            font-weight: 600;
        }
        .error {
            background: linear-gradient(135deg, #ef4444, #f97316);
            color: white;
            padding: 20px;
            border-radius: 12px;
            margin: 20px 0;
            font-size: 1rem;
        }
        code {
            background: rgba(0, 0, 0, 0.3);
            padding: 12px 15px;
            border-radius: 8px;
            display: block;
            text-align: left;
            margin: 15px 0;
            font-family: 'Courier New', monospace;
            font-size: 0.9rem;
            overflow-x: auto;
            border-left: 4px solid #3b82f6;
        }
        .button {
            display: inline-block;
            background: #3b82f6;
            color: white;
            padding: 14px 28px;
            border-radius: 10px;
            text-decoration: none;
            font-weight: 600;
            margin-top: 20px;
            transition: all 0.3s ease;
            border: none;
            cursor: pointer;
            font-size: 1rem;
        }
        .button:hover {
            background: #2563eb;
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(37, 99, 235, 0.3);
        }
        .vk-badge {
            background: #0077FF;
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.9rem;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin-top: 15px;
        }
    </style>
    <!-- VK Bridge для VK Mini Apps -->
    <script src="https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js"></script>
</head>
<body>
    <div class="container">
        <h1>🎬 Vibeo</h1>
        <div class="status">
            ✅ Сервер работает корректно!
        </div>
        
        <div class="vk-badge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M15.07 2H8.93C3.33 2 2 3.33 2 8.93V15.07C2 20.67 3.33 22 8.93 22H15.07C20.67 22 22 20.67 22 15.07V8.93C22 3.33 20.67 2 15.07 2M18.15 16.27H16.69C16.14 16.27 15.97 15.82 15 14.83C14.12 14 13.74 13.88 13.53 13.88C13.24 13.88 13.15 13.96 13.15 14.38V15.69C13.15 16.04 13.04 16.26 12.11 16.26C10.57 16.26 8.86 15.32 7.66 13.59C5.85 11.05 5.36 9.13 5.36 8.75C5.36 8.54 5.43 8.34 5.85 8.34H7.32C7.69 8.34 7.83 8.5 7.97 8.9C8.69 10.96 10.38 13.09 11.53 13.09C11.8 13.09 11.87 13 11.87 12.66V10.84C11.87 9.5 12.01 9.41 12.41 9.41C12.71 9.41 13.18 9.53 14.54 10.94C16.01 12.57 16.3 13.08 17.08 13.08H18.56C19 13.08 19.13 13.35 18.96 13.69C18.68 14.22 17.64 15.26 16.64 16.04C16.24 16.35 15.98 16.5 15.89 16.66C15.79 16.83 15.86 17 16.12 17H18.15C18.56 17 18.7 17.18 18.7 17.41C18.7 17.76 18.3 18.31 17.63 18.95C16.8 19.74 16.19 20 15.87 20C15.62 20 15.5 19.88 15.5 19.52V18.77C15.5 17.82 15.38 17.73 14.64 17.18C13.75 16.5 12.61 15.47 11.2 13.93C9.92 12.55 9.22 11.76 8.95 11.38C8.68 11 8.76 10.8 8.95 10.56C9.06 10.43 9.27 10.2 9.46 10C10.67 8.74 11.5 7.71 12.08 6.92C12.46 6.41 12.86 6 13.45 6H14.93C15.23 6 15.36 6.16 15.45 6.45C15.55 6.79 16.06 7.87 16.63 8.92C17.14 9.84 17.55 10.42 17.73 10.42C17.86 10.42 17.93 10.32 17.93 10.05V8.93C17.93 8.5 18.05 8.34 18.44 8.34H19.93C20.28 8.34 20.41 8.55 20.28 8.9C20.07 9.42 19.03 10.67 17.63 12.04C16.99 12.65 16.57 13 16.45 13.15C16.33 13.3 16.37 13.42 16.54 13.42C17.21 13.42 18.53 12.38 19.63 11.21C20.36 10.42 21.03 9.66 21.07 9.41C21.11 9.16 20.99 9 20.64 9H19.17C18.81 9 18.69 9.11 18.57 9.38C18.43 9.68 17.77 10.65 16.93 11.58C16.36 12.21 16.06 12.42 15.98 12.42C15.86 12.42 15.79 12.33 15.79 11.95V11.25C15.79 9.85 16.32 9.72 16.53 9.72C16.68 9.72 16.9 9.79 17.32 10.19C17.77 10.61 19.08 12.11 20.26 13.53C21.14 14.56 21.8 15.36 21.86 15.57C21.93 15.84 21.8 16 21.43 16H19.93Z"/>
            </svg>
            VK Mini App
        </div>
        
        <p>Совместный просмотр видео с друзьями в реальном времени</p>
        
        <div class="error">
            ⚠️ Но index.html не найден в ожидаемом месте
            <p>Пожалуйста, проверьте структуру файлов:</p>
            <code>
/client/
  index.html  ← должен быть здесь
/server/
  server.js   ← этот файл
package.json
            </code>
        </div>
        
        <a href="https://vk.com/apps?act=manage" target="_blank" class="button">
            Настроить в VK
        </a>
        
        <script>
            // Инициализация VK Bridge
            if (typeof vkBridge !== 'undefined') {
                console.log('✅ VK Bridge обнаружен');
                vkBridge.send('VKWebAppInit', {})
                    .then(data => {
                        console.log('VK Mini App инициализирован:', data);
                        document.querySelector('.vk-badge').innerHTML += ' ✅';
                    })
                    .catch(err => {
                        console.error('VK ошибка инициализации:', err);
                        document.querySelector('.vk-badge').innerHTML += ' ❌';
                    });
            } else {
                console.log('ℹ️ Запущено не в VK Mini App');
            }
            
            // Отправляем статус родительскому окну если запущено в iframe
            if (window.parent !== window) {
                window.parent.postMessage({
                    type: 'VK_APP_STATUS',
                    status: 'ready',
                    url: window.location.href,
                    timestamp: Date.now()
                }, '*');
            }
        </script>
    </div>
</body>
</html>`;
}

// Кэш для проксированных ресурсов
const cache = new Map();

// Проксирование YouTube API
async function proxyYouTubeResource(reqUrl, res) {
    console.log(`📡 Проксирование YouTube: ${reqUrl}`);
    
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
            res.end('Error loading YouTube resource');
            resolve();
        });
    });
}

// Создаем HTTP сервер
const server = http.createServer(async (req, res) => {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substr(2, 9);
    
    console.log(`\n[${requestId}] 📄 ${req.method} ${req.url}`);
    console.log(`[${requestId}] 👤 User-Agent: ${req.headers['user-agent']?.substring(0, 80)}...`);
    console.log(`[${requestId}] 🌐 Referer: ${req.headers.referer || 'none'}`);
    
    // === КРИТИЧЕСКИ ВАЖНО: Заголовки для VK Mini Apps ===
    // 1. Разрешаем загрузку в iframe от VK (самое важное!)
    res.setHeader('Content-Security-Policy', 
        "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; " +
        "frame-ancestors vk.com *.vk.com vk.ru *.vk.ru 'self'; " +
        "script-src * 'unsafe-inline' 'unsafe-eval' blob:; " +
        "style-src * 'unsafe-inline'; " +
        "connect-src *; " +
        "img-src * data: blob:; " +
        "media-src *; " +
        "font-src * data:;"
    );
    
    // 2. Старый стандарт для iframe (для совместимости)
    res.setHeader('X-Frame-Options', 'ALLOW-FROM https://vk.com');
    
    // 3. CORS заголовки (очень важны для VK)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE, PATCH, HEAD');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-VK-*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Expose-Headers', '*');
    res.setHeader('Access-Control-Max-Age', '86400');
    
    // 4. Дополнительные заголовки для VK
    res.setHeader('Vary', 'Origin');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'no-referrer-when-downgrade');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
    res.setHeader('X-VK-Apps-Allowed', 'true');
    
    // 5. Обрабатываем OPTIONS запросы для CORS (предзапросы от VK)
    if (req.method === 'OPTIONS') {
        console.log(`[${requestId}] 🔄 Обработка CORS preflight запроса от VK`);
        res.writeHead(200, {
            'Content-Length': '0'
        });
        res.end();
        console.log(`[${requestId}] ✅ CORS preflight отправлен - ${Date.now() - startTime}ms`);
        return;
    }
    
    // === Обработка специальных маршрутов для VK ===
    
    // Редирект с vercel.app на railway.app (если есть старые ссылки)
    if (req.headers.host && req.headers.host.includes('vercel.app')) {
        console.log(`[${requestId}] 🔄 Перенаправление с ${req.headers.host} на railway.app`);
        res.writeHead(301, {
            'Location': `https://vibeo-websocket-production.up.railway.app${req.url}`,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        res.end();
        return;
    }
    
    // Healthcheck для Railway и VK
    if (req.url === '/health' || req.url === '/ping' || req.url === '/status') {
        res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
        });
        res.end(JSON.stringify({ 
            status: 'ok',
            service: 'Vibeo',
            version: '1.0.0',
            vk_mini_app: true,
            server_time: new Date().toISOString(),
            uptime: process.uptime(),
            request_id: requestId
        }));
        console.log(`[${requestId}] ❤️ Healthcheck - ${Date.now() - startTime}ms`);
        return;
    }
    
    // Специальный эндпоинт для проверки VK
    if (req.url === '/vk-check' || req.url === '/vk/test') {
        res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
        });
        res.end(JSON.stringify({
            vk_mini_app: true,
            iframe_allowed: true,
            cors_enabled: true,
            server: 'vibeo-websocket-production.up.railway.app',
            timestamp: Date.now(),
            request_id: requestId,
            headers_received: {
                origin: req.headers.origin,
                referer: req.headers.referer,
                'user-agent': req.headers['user-agent']?.substring(0, 50)
            }
        }));
        console.log(`[${requestId}] ✅ VK check отправлен - ${Date.now() - startTime}ms`);
        return;
    }
    
    // Эндпоинт для получения конфигурации VK
    if (req.url === '/vk-config') {
        res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, max-age=0'
        });
        res.end(JSON.stringify({
            app_id: process.env.VK_APP_ID || 'vibeo_app',
            app_name: 'Vibeo - Совместный просмотр',
            app_version: '1.0.0',
            platform: 'web_mobile',
            api_version: '5.199',
            features: ['video', 'chat', 'rooms', 'reactions'],
            permissions: ['friends', 'video', 'messages'],
            supported_methods: ['VKWebAppInit', 'VKWebAppGetUserInfo', 'VKWebAppGetAuthToken'],
            iframe_config: {
                sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups',
                allow: 'camera *; microphone *'
            }
        }));
        console.log(`[${requestId}] ⚙️ VK config отправлен - ${Date.now() - startTime}ms`);
        return;
    }
    
    // Favicon
    if (req.url === '/favicon.ico') {
        res.writeHead(204, {
            'Content-Length': '0'
        });
        res.end();
        return;
    }
    
    // Проксирование YouTube API
if (req.url === '/youtube-iframe-api' || req.url === '/iframe_api') {
    console.log(`[${requestId}] 📹 Проксирование YouTube iframe API...`);
    
    https.get('https://www.youtube.com/iframe_api', (youtubeRes) => {
        res.writeHead(youtubeRes.statusCode, {
            'Content-Type': 'text/javascript',
            'Cache-Control': 'public, max-age=86400'
        });
        youtubeRes.pipe(res);
    }).on('error', (err) => {
        console.error(`[${requestId}] ❌ YouTube API ошибка:`, err.message);
        // Отдаем заглушку вместо ошибки
        res.writeHead(200, {
            'Content-Type': 'text/javascript',
            'Cache-Control': 'public, max-age=3600'
        });
        res.end(`
            console.log('YouTube API недоступен, используется заглушка');
            window.YT = window.YT || {};
            window.YT.Player = class MockPlayer {
                constructor() { console.log('Mock YouTube Player создан'); }
                loadVideoById(id) { console.log('Mock: Загрузка видео', id); }
                playVideo() { console.log('Mock: Воспроизведение'); }
                pauseVideo() { console.log('Mock: Пауза'); }
                seekTo(time) { console.log('Mock: Перемотка к', time); }
                getCurrentTime() { return 0; }
                getDuration() { return 0; }
                getPlayerState() { return -1; }
                setVolume() {}
            };
            if (window.onYouTubeIframeAPIReady) {
                setTimeout(() => window.onYouTubeIframeAPIReady(), 100);
            }
        `);
    });
    return;
}
    
    // Обслуживаем статические файлы
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = filePath.split('?')[0]; // Убираем query параметры
    
    // Защита от path traversal атак
    if (filePath.includes('..') || filePath.includes('//')) {
        console.log(`[${requestId}] ⚠️ Попытка path traversal: ${filePath}`);
        res.writeHead(403, { 'Content-Type': 'text/plain' });
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
            console.log(`[${requestId}] ⚠️ Ошибка проверки пути ${p}:`, err.message);
        }
    }
    
    // Если файл не найден или это директория без index.html, отдаем главную страницу (SPA)
    if (!foundPath || isDirectory) {
        console.log(`[${requestId}] 📄 Отдаю index.html (${filePath} не найден или директория)`);
        
        // Добавляем VK Bridge в index.html если его нет
        let finalHtml = indexHtmlContent;
        if (!finalHtml.includes('vk-bridge') && !finalHtml.includes('@vkontakte/vk-bridge')) {
            finalHtml = finalHtml.replace('</head>', 
                '<script src="https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js"></script>\n</head>'
            );
        }
        
        res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'X-VK-App-Status': 'serving_spa',
            'Content-Length': Buffer.byteLength(finalHtml, 'utf8')
        });
        res.end(finalHtml);
        console.log(`[${requestId}] ✅ SPA отправлено - ${Date.now() - startTime}ms`);
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
        '.zip': 'application/zip',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.woff': 'font/woff',
        '.woff2': 'font/woff2',
        '.ttf': 'font/ttf',
        '.eot': 'application/vnd.ms-fontobject',
        '.otf': 'font/otf'
    };
    
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    // Читаем и отдаем файл
    fs.readFile(foundPath, (err, data) => {
        if (err) {
            console.error(`[${requestId}] ❌ Ошибка чтения файла ${foundPath}:`, err.message);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Server Error');
            return;
        }
        
        res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': ext === '.html' ? 'no-cache, no-store, must-revalidate' : 'public, max-age=3600',
            'Content-Length': data.length,
            'X-VK-App-File': path.basename(foundPath)
        });
        res.end(data);
        console.log(`[${requestId}] ✅ Файл отправлен: ${path.basename(foundPath)} - ${Date.now() - startTime}ms`);
    });
});

// WebSocket сервер (остается без изменений)
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

// [ОСТАВШАЯСЯ ЧАСТЬ КОДА С WebSocket ЛОГИКОЙ ОСТАЕТСЯ БЕЗ ИЗМЕНЕНИЙ]
// ============================================================
// ВСТАВЬТЕ СЮДА ВЕСЬ ВАШ WebSocket КОД ИЗ ПРЕДЫДУЩЕЙ ВЕРСИИ
// (class Room, generateRoomCode, getOrCreateRoom, wss.on('connection'), etc.)
// ============================================================

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
    
    cleanupInactiveUsers(timeout = 300000) {
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
    
    if (rooms.has(result)) {
        return generateRoomCode();
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

setInterval(() => {
    const now = Date.now();
    let cleanedRooms = 0;
    
    for (const [code, room] of rooms.entries()) {
        room.cleanupInactiveUsers();
        
        if (room.users.size === 0 || (now - room.createdAt > 86400000)) {
            rooms.delete(code);
            cleanedRooms++;
            console.log(`🗑️ Удалена комната ${code}`);
        }
    }
    
    if (cleanedRooms > 0) {
        console.log(`🧹 Очистка: удалено ${cleanedRooms} комнат`);
    }
}, 60000);

wss.on('connection', (ws, request) => {
    console.log('🔌 Новое WebSocket соединение');
    
    const parameters = url.parse(request.url, true);
    const roomCode = parameters.query.room;
    const userId = parameters.query.userId || Math.random().toString(36).substr(2, 9);
    const userIp = request.socket.remoteAddress;
    
    let currentRoom = null;
    let currentUser = null;

    console.log(`👤 Подключение: ID=${userId}, комната=${roomCode || 'новая'}, IP=${userIp}`);

    ws.send(JSON.stringify({
        type: 'CONNECTED',
        message: 'Успешно подключено к серверу',
        userId: userId,
        timestamp: Date.now(),
        vk_app: request.headers.origin?.includes('vk.com') || false
    }));

    ws.isAlive = true;
    ws.on('pong', () => {
        ws.isAlive = true;
    });

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            
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
        if (currentUser && currentRoom) {
            const user = currentRoom.users.get(currentUser.id);
            if (user) {
                user.lastActive = Date.now();
            }
        }
        
        switch (message.type) {
            case 'PING':
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
                name: message.user.name.substring(0, 30)
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
}, 30000);

// Запуск сервера
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log('\n' + '='.repeat(60));
    console.log('🚀 Vibeo сервер для VK Mini Apps успешно запущен!');
    console.log('='.repeat(60));
    console.log(`📡 Порт: ${PORT}`);
    console.log(`🌐 HTTP: http://0.0.0.0:${PORT}`);
    console.log(`🔗 WebSocket: ws://0.0.0.0:${PORT}/ws`);
    console.log(`❤️  Healthcheck: http://0.0.0.0:${PORT}/health`);
    console.log(`🔍 VK проверка: http://0.0.0.0:${PORT}/vk-check`);
    console.log(`📹 YouTube прокси: http://0.0.0.0:${PORT}/youtube-iframe-api`);
    console.log(`📁 Обслуживается из: ${indexHtmlPath || 'в памяти'}`);
    console.log('='.repeat(60));
    console.log('\n🔧 Для настройки VK Mini App:');
    console.log('1. Перейдите в https://dev.vk.com/mini-apps/dev');
    console.log('2. В настройках приложения укажите URL:');
    console.log(`   🔗 https://vibeo-websocket-production.up.railway.app/`);
    console.log('3. Включите "Доверенный iframe"');
    console.log('4. Добавьте домен *.railway.app в разрешенные');
    console.log('='.repeat(60) + '\n');
});

process.on('SIGINT', () => {
    console.log('\n🔻 Получен SIGINT, завершаю работу...');
    
    wss.clients.forEach((client) => {
        client.close();
    });
    
    wss.close(() => {
        server.close(() => {
            console.log('✅ Сервер остановлен');
            process.exit(0);
        });
    });
    
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
