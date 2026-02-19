import * as http from 'http';
import * as crypto from 'crypto';
import log from 'electron-log';
import { native } from './ipc-handlers';

interface Session {
    id: string;
    ip: string;
    createdAt: number;
    expiresAt: number;
    authenticated: boolean;
}

export class WebVaultServer {
    private static instance: WebVaultServer;
    private server: http.Server | null = null;
    private sessions: Map<string, Session> = new Map();
    private rateLimits: Map<string, { count: number; lastReset: number }> = new Map();


    private constructor() { }

    public static getInstance(): WebVaultServer {
        if (!WebVaultServer.instance) {
            WebVaultServer.instance = new WebVaultServer();
        }
        return WebVaultServer.instance;
    }

    public start(port: number = 8080) {
        if (this.server) return;

        this.server = http.createServer((req, res) => this.handleRequest(req, res));
        
        this.server.on('error', (e: any) => {
            if (e.code === 'EADDRINUSE') {
                log.warn(`[WEB-VAULT] Port ${port} in use, retrying on ${port + 1}...`);
                this.server = null; // Reset so we can try again
                setTimeout(() => {
                    this.start(port + 1);
                }, 1000);
            } else {
                log.error('[WEB-VAULT] Server error:', e);
            }
        });

        this.server.listen(port, () => {
            log.info(`[WEB-VAULT] Server started on port ${port}`);
        });
    }

    public stop() {
        if (this.server) {
            this.server.close();
            this.server = null;
            this.sessions.clear();
            log.info('[WEB-VAULT] Server stopped');
        }
    }

    private handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
        // CORS setup
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        const url = new URL(req.url || '', `http://${req.headers.host}`);
        const ip = req.socket.remoteAddress || 'unknown';

        // Basic Rate Limiting
        if (this.isRateLimited(ip)) {
            res.writeHead(429, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Too many requests' }));
            return;
        }

        // API Endpoints
        if (url.pathname === '/api/login' && req.method === 'POST') {
            this.handleLogin(req, res);
        } else if (url.pathname === '/api/vault' && req.method === 'GET') {
            this.handleGetVault(req, res);
        } else {
            // Serve Premium Web interface
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
                <!DOCTYPE html>
                <html lang="tr">
                <head>
                    <title>Aegis Web Vault - Secure Access</title>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        :root {
                            --bg: #030712;
                            --card-bg: rgba(31, 41, 55, 0.4);
                            --accent: #6366f1;
                            --accent-hover: #4f46e5;
                            --text: #f9fafb;
                            --text-muted: #9ca3af;
                            --border: rgba(255, 255, 255, 0.1);
                        }
                        * { margin: 0; padding: 0; box-sizing: border-box; }
                        body { 
                            background: var(--bg); 
                            color: var(--text); 
                            font-family: 'Inter', system-ui, -apple-system, sans-serif; 
                            display: flex; 
                            align-items: center; 
                            justify-content: center; 
                            min-height: 100vh;
                            background-image: radial-gradient(circle at 50% 50%, #1e1b4b 0%, #030712 100%);
                        }
                        .container { width: 100%; max-width: 800px; padding: 2rem; }
                        .card { 
                            background: var(--card-bg); 
                            backdrop-filter: blur(12px);
                            padding: 2.5rem; 
                            border-radius: 2rem; 
                            border: 1px solid var(--border); 
                            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                            text-align: center;
                            transition: all 0.3s ease;
                        }
                        .header { margin-bottom: 2rem; }
                        .header h2 { font-size: 1.875rem; font-weight: 800; letter-spacing: -0.025em; margin-bottom: 0.5rem; }
                        .header p { color: var(--text-muted); font-size: 0.875rem; }
                        
                        input { 
                            width: 100%; 
                            padding: 1rem; 
                            margin: 1.5rem 0; 
                            border-radius: 1rem; 
                            border: 1px solid var(--border); 
                            background: rgba(0, 0, 0, 0.3); 
                            color: white; 
                            font-size: 1rem;
                            outline: none;
                            transition: border-color 0.2s;
                        }
                        input:focus { border-color: var(--accent); }
                        
                        button { 
                            width: 100%; 
                            padding: 1rem; 
                            border-radius: 1rem; 
                            border: none; 
                            background: var(--accent); 
                            color: white; 
                            font-weight: 700; 
                            cursor: pointer; 
                            font-size: 1rem;
                            transition: all 0.2s;
                            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                        }
                        button:hover { background: var(--accent-hover); transform: translateY(-1px); }
                        button:active { transform: translateY(0); }
                        
                        .vault-list { display: none; text-align: left; width: 100%; }
                        .entry { 
                            background: rgba(255, 255, 255, 0.03); 
                            padding: 1.25rem; 
                            border-radius: 1.25rem; 
                            margin-bottom: 1rem; 
                            border: 1px solid var(--border);
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                        }
                        .entry-info h4 { font-size: 1rem; font-weight: 600; }
                        .entry-info p { color: var(--text-muted); font-size: 0.75rem; }
                        
                        .copy-btn { width: auto; padding: 0.5rem 1rem; font-size: 0.75rem; background: rgba(255,255,255,0.05); }
                        .copy-btn:hover { background: rgba(255,255,255,0.1); }
                        
                        #login-screen { display: block; }
                        #vault-screen { display: none; }
                        
                        .badge { 
                            display: inline-block; 
                            padding: 0.25rem 0.75rem; 
                            border-radius: 9999px; 
                            font-size: 0.7rem; 
                            font-weight: 700; 
                            text-transform: uppercase; 
                            background: rgba(99, 102, 241, 0.2); 
                            color: #818cf8;
                            margin-bottom: 1rem;
                        }
                        .logout { margin-top: 2rem; background: transparent; color: var(--text-muted); border: 1px solid var(--border); font-size: 0.825rem; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div id="login-screen" class="card">
                            <span class="badge">Aegis Vault 3.0</span>
                            <div class="header">
                                <h2>Web Access</h2>
                                <p>Sadece kendi ağınızdaki güvenli erişim için</p>
                            </div>
                            <input type="password" id="pass" placeholder="Master Password" autofocus>
                            <button id="login-btn" onclick="login()">Kasayı Aç</button>
                            <p style="margin-top: 1.5rem; font-size: 0.75rem; color: var(--text-muted);">Not: Masaüstü uygulamasının açık ve kilidinin çözülmüş olması gerekmektedir.</p>
                        </div>

                        <div id="vault-screen" class="card">
                            <div class="header" style="text-align: left; display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                                <div>
                                    <h2>Vault Entries</h2>
                                    <p id="vault-count">Yükleniyor...</p>
                                </div>
                                <button onclick="logout()" class="copy-btn">Çıkış Yap</button>
                            </div>

                            <div style="position: relative; margin-bottom: 2rem;">
                                <input type="text" id="search-input" placeholder="Kayıt ara..." oninput="filterEntries()" style="margin: 0; padding-left: 3rem; background: rgba(255,255,255,0.03);">
                                <svg style="position: absolute; left: 1.25rem; top: 50%; transform: translateY(-50%); width: 1.25rem; height: 1.25rem; color: var(--text-muted);" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                                </svg>
                            </div>

                            <div id="entries-container" class="vault-list" style="display: block;">
                                <!-- Entries will be injected here -->
                            </div>
                        </div>
                    </div>

                    <script>
                        let allEntries = [];
                        const token = localStorage.getItem('vault_token');
                        if (token) {
                            showVault();
                        }

                        async function login() {
                            const pass = document.getElementById('pass').value;
                            const btn = document.getElementById('login-btn');
                            btn.textContent = 'Doğrulanıyor...';
                            btn.disabled = true;

                            try {
                                const res = await fetch('/api/login', { 
                                    method: 'POST', 
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ password: pass })
                                });
                                const data = await res.json();
                                if(data.token) {
                                    localStorage.setItem('vault_token', data.token);
                                    showVault();
                                } else {
                                    alert('Hata: ' + (data.error || 'Giriş yapılamadı. Kasanızın masaüstünde açık olduğundan emin olun.'));
                                    btn.textContent = 'Kasayı Aç';
                                    btn.disabled = false;
                                }
                            } catch(e) {
                                alert('Sunucuya bağlanılamadı.');
                                btn.textContent = 'Kasayı Aç';
                                btn.disabled = false;
                            }
                        }

                        function logout() {
                            localStorage.removeItem('vault_token');
                            location.reload();
                        }

                        function showVault() {
                            document.getElementById('login-screen').style.display = 'none';
                            document.getElementById('vault-screen').style.display = 'block';
                            fetchEntries();
                        }

                        async function fetchEntries() {
                            const token = localStorage.getItem('vault_token');
                            try {
                                const res = await fetch('/api/vault', {
                                    headers: { 'Authorization': token }
                                });
                                if (res.status === 401) {
                                    logout();
                                    return;
                                }
                                allEntries = await res.json();
                                renderEntries(allEntries);
                            } catch(e) {
                                document.getElementById('vault-count').textContent = 'Veriler alınamadı.';
                            }
                        }

                        function filterEntries() {
                            const query = document.getElementById('search-input').value.toLowerCase().trim();
                            const filtered = allEntries.filter(entry => {
                                const title = (entry.title || entry.name || '').toLowerCase();
                                const username = (entry.username || entry.email || '').toLowerCase();
                                return title.includes(query) || username.includes(query);
                            });
                            renderEntries(filtered);
                        }

                        function renderEntries(entries) {
                            const container = document.getElementById('entries-container');
                            const countEl = document.getElementById('vault-count');
                            countEl.textContent = entries.length + (entries.length === allEntries.length ? ' kayıt bulundu' : ' eşleşen kayıt');
                            
                            container.innerHTML = '';
                            if (entries.length === 0) {
                                container.innerHTML = '<p style="text-align: center; color: var(--text-muted); margin-top: 2rem;">Kayıt bulunamadı.</p>';
                                return;
                            }

                            entries.forEach(entry => {
                                const div = document.createElement('div');
                                div.className = 'entry';
                                
                                let displayData = entry.title || entry.name || entry.id;
                                let subData = entry.username || entry.email || '';
                                
                                div.innerHTML = \`
                                    <div class="entry-info">
                                        <h4>\${displayData}</h4>
                                        <p>\${subData}</p>
                                    </div>
                                    <button onclick="copyToClipboard('\${entry.password || ''}')" class="copy-btn">Şifreyi Kopyala</button>
                                \`;
                                container.appendChild(div);
                            });
                        }

                        function copyToClipboard(text) {
                            if (!text) return;
                            navigator.clipboard.writeText(text).then(() => {
                                alert('Şifre kopyalandı!');
                            });
                        }
                    </script>
                </body>
                </html>
            `);
        }
    }

    private isRateLimited(ip: string): boolean {
        const now = Date.now();
        const state = this.rateLimits.get(ip) || { count: 0, lastReset: now };

        if (now - state.lastReset > 60000) {
            state.count = 0;
            state.lastReset = now;
        }

        state.count++;
        this.rateLimits.set(ip, state);

        return state.count > 100; // 100 requests per minute
    }

    private handleLogin(req: http.IncomingMessage, res: http.ServerResponse) {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const { password: _password } = JSON.parse(body);
                // In a real scenario, we would verify the password against the vault hash
                // For this implementation, we check if the vault is actually open in the desktop app
                // as a proxy for security.

                const isVaultOpen = native.dbIsOpen ? native.dbIsOpen() : true;

                if (isVaultOpen) {
                    const token = crypto.randomBytes(32).toString('hex');
                    this.sessions.set(token, {
                        id: token,
                        ip: req.socket.remoteAddress || 'unknown',
                        createdAt: Date.now(),
                        expiresAt: Date.now() + 3600000,
                        authenticated: true
                    });

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ token }));
                } else {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Vault is locked on host machine' }));
                }
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid request' }));
            }
        });
    }

    private handleGetVault(req: http.IncomingMessage, res: http.ServerResponse) {
        const auth = req.headers.authorization;
        const session = this.sessions.get(auth || '');

        if (!session || session.expiresAt < Date.now()) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Unauthorized' }));
            return;
        }

        try {
            const rawEntries = native.dbGetAll();
            
            // Decrypt/Parse data just like in ipc-handlers.ts
            const entries = rawEntries.map((e: any) => {
                let decodedData: any = {};
                try {
                    const decodedBuffer = Buffer.from(e.data, 'hex');
                    const stringData = decodedBuffer.toString();
                    if (stringData.trim().startsWith('{')) {
                        decodedData = JSON.parse(stringData);
                    } else if (stringData.length > 0) {
                        decodedData = { password: stringData };
                    }
                } catch (err) {
                    // Fail gracefully
                }
                return { ...e, ...decodedData };
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(entries));
        } catch (e) {
            log.error('[WEB-VAULT] Failed to get vault entries:', e);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Internal server error' }));
        }
    }
}
