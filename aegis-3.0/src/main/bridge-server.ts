import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
// os import removed
import { app } from 'electron';
import log from 'electron-log';

const PIPE_NAME = '\\\\.\\pipe\\aegis-vault-pipe-v3';
let bridgeServer: net.Server | null = null;
let sessionToken: string | null = null;

// Multi-location logging disabled for production
function mainLog(msg: string) {
    log.info(msg);
}

// Security: Rate Limiting & Suspicious Activity Tracking
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 60; // 1 request per second avg
const MAX_AUTH_FAILURES = 5;

interface ClientState {
    requests: number[];
    authFailures: number;
    blocked: boolean;
}

const clientStates = new Map<net.Socket, ClientState>();

export function startBridgeServer() {
    // Generate and save token
    sessionToken = crypto.randomBytes(32).toString('hex');
    const tokenPath = path.join(app.getPath('userData'), '.bridge_token');

    // Ensure directory exists
    try {
        fs.writeFileSync(tokenPath, sessionToken, { mode: 0o600 });
        mainLog(`[STARTUP] Session token generated.`);
        mainLog(`[STARTUP] PID: ${process.pid}`);
        mainLog(`[STARTUP] Token Path: ${tokenPath}`);
        mainLog(`[STARTUP] Token Prefix: ${sessionToken.substring(0, 4)}`);
        mainLog(`[STARTUP] UserData Path: ${app.getPath('userData')}`);
    } catch (e: any) {
        mainLog(`[ERROR] Failed to write token: ${e.message}`);
    }

    bridgeServer = net.createServer((socket) => {
        log.info('[BRIDGE] Client connected');
        clientStates.set(socket, { requests: [], authFailures: 0, blocked: false });

        socket.on('data', (data) => {
            const state = clientStates.get(socket);
            if (!state || state.blocked) {
                socket.destroy();
                return;
            }

            // Rate Limiting
            const now = Date.now();
            state.requests = state.requests.filter(t => now - t < RATE_LIMIT_WINDOW);
            if (state.requests.length >= MAX_REQUESTS_PER_WINDOW) {
                log.warn('[BRIDGE] Rate limit exceeded for client');
                sendMessage(socket, { type: 'ERROR', error: 'RATE_LIMITED' });
                return;
            }
            state.requests.push(now);

            mainLog(`[DATA] Raw data received: ${data.length} bytes`);

            const lines = data.toString().split('\n');
            for (const line of lines) {
                if (!line.trim()) continue;

                try {
                    const msg = JSON.parse(line);

                    // Validate Token
                    if (msg.token !== sessionToken) {
                        state.authFailures++;
                        const receivedPrefix = msg.token ? msg.token.substring(0, 4) : 'NONE';
                        const expectedPrefix = sessionToken ? sessionToken.substring(0, 4) : 'NULL';

                        mainLog(`[AUTH] Invalid token. Expected: ${expectedPrefix}..., Received: ${receivedPrefix}...`);

                        if (state.authFailures >= MAX_AUTH_FAILURES) {
                            log.error('[BRIDGE] Client blocked due to too many auth failures (Suspicious Activity)');
                            state.blocked = true;
                            sendMessage(socket, { type: 'SECURITY_ALERT', error: 'BLOCKED_SUSPICIOUS_ACTIVITY' });
                            socket.destroy();
                        } else {
                            sendMessage(socket, { error: 'UNAUTHORIZED_BRIDGE' });
                        }
                        return;
                    }

                    // Reset auth failures on success
                    state.authFailures = 0;

                    handleMessage(socket, msg);
                } catch (e: any) {
                    log.error('[BRIDGE] Parse error:', e.message);
                }
            }
        });

        socket.on('end', () => {
            log.info('[BRIDGE] Client disconnected');
            clientStates.delete(socket);
        });

        socket.on('error', (err) => {
            log.error('[BRIDGE] Socket error', err);
            clientStates.delete(socket);
        });
    });

    bridgeServer.on('error', (err: any) => {
        mainLog(`[SERVER ERROR] ${err.message}`);
    });

    bridgeServer.listen(PIPE_NAME, () => {
        mainLog(`[SERVER] Listening on ${PIPE_NAME}`);
    });
}

import { native } from './ipc-handlers';
import { generateTOTP } from './totp';

function handleMessage(socket: net.Socket, msg: any) {
    mainLog(`[MSG] Processing ${msg.type}`);

    // Handle messages (e.g., from browser extension)
    if (msg.type === 'PING') {
        sendMessage(socket, { type: 'PONG', timestamp: Date.now() });
    }
    else if (msg.type === 'SEARCH') {
        try {
            const query = (msg.query || '').toLowerCase();
            mainLog(`[SEARCH] Query: "${query}"`);

            const filter = msg.filter || {};
            const rawEntries = native.dbGetAll();
            let matches: any[] = [];

            for (const e of rawEntries) {
                let website = '';
                let username = '';
                let type = 'login';
                let tags: string[] = [];
                let favorite = false;
                let lastUsed = 0;

                try {
                    const dataStr = Buffer.from(e.data, 'hex').toString();
                    const data = JSON.parse(dataStr);

                    website = (data.website || '').toLowerCase();
                    username = data.username || e.username || '';
                    type = data.type || 'login';
                    tags = Array.isArray(data.tags) ? data.tags : [];
                    favorite = !!data.favorite;
                    lastUsed = (data.lastUsed || 0);

                    // Skip trash
                    if (e.category === 'Trash') continue;
                } catch (err) { continue; }

                // Apply Filters
                if (filter.category && e.category !== filter.category) continue;
                if (filter.favorite && !favorite) continue;
                if (filter.tag && !tags.includes(filter.tag)) continue;

                // Match Logic
                const matchTitle = e.title.toLowerCase().includes(query);
                const matchWebsite = website.includes(query);
                const matchUsername = username.toLowerCase().includes(query);
                const matchTag = tags.some((t: string) => t.toLowerCase().includes(query));

                if (matchTitle || matchWebsite || matchUsername || matchTag) {
                    matches.push({
                        id: e.id,
                        title: e.title,
                        username: username,
                        type: type,
                        favorite: favorite,
                        lastUsed: lastUsed,
                        category: e.category
                    });
                }
            }

            // Sorting
            if (filter.sort === 'recent') {
                matches.sort((a, b) => b.lastUsed - a.lastUsed);
            } else {
                matches.sort((a, b) => {
                    // Exact match prioritization
                    const aExact = a.title.toLowerCase() === query;
                    const bExact = b.title.toLowerCase() === query;
                    if (aExact && !bExact) return -1;
                    if (!aExact && bExact) return 1;

                    return a.title.localeCompare(b.title);
                });
            }

            if (matches.length > 50) matches = matches.slice(0, 50);

            mainLog(`[SEARCH] Found ${matches.length} matches`);
            sendMessage(socket, { type: 'SEARCH_RESULT', data: matches, requestId: msg.id });
        } catch (error: any) {
            mainLog(`[SEARCH ERROR] ${error.message}`);
            sendMessage(socket, { type: 'ERROR', error: error.message, requestId: msg.id });
        }
    }
    else if (msg.type === 'GET_CREDENTIALS') {
        try {
            // Access Access Control / Logging
            log.info(`[BRIDGE] Access requested for entry: ${msg.entryId}`);

            const entryId = msg.entryId;
            const rawEntries = native.dbGetAll();
            const entry = rawEntries.find((e: any) => e.id === entryId);

            if (entry) {
                const data = JSON.parse(Buffer.from(entry.data, 'hex').toString());
                const response: any = {
                    username: data.username || entry.username || '',
                    password: data.password,
                    type: data.type || 'login'
                };

                // Handle TOTP
                if (data.totp) {
                    try {
                        let secret = data.totp;
                        if (secret.startsWith('otpauth://')) {
                            const url = new URL(secret);
                            secret = url.searchParams.get('secret');
                        }
                        if (secret) {
                            response.totp = generateTOTP(secret);
                        }
                    } catch (e) {
                        log.error('[BRIDGE] TOTP generation failed', e);
                    }
                }

                // Handle Credit Card
                if (data.type === 'card') {
                    response.card = {
                        number: data.cardNumber || data.password,
                        cvv: data.cvv || data.securityCode,
                        expiry: data.expiry || data.expiryDate,
                        holder: data.cardHolder || data.username
                    };
                }

                // Handle Identity
                if (data.type === 'identity') {
                    response.identity = {
                        fullName: data.fullName || entry.title,
                        email: data.email || data.username,
                        phone: data.phone,
                        address: data.address
                    };
                }

                sendMessage(socket, { type: 'CREDENTIALS_RESULT', data: response, requestId: msg.id });

                // Notify Extension of access (Security Audit)
                sendMessage(socket, { type: 'NOTIFICATION', message: `Access granted to ${entry.title}`, level: 'info' });
            } else {
                sendMessage(socket, { type: 'ERROR', error: 'Entry not found', requestId: msg.id });
            }
        } catch (error: any) {
            sendMessage(socket, { type: 'ERROR', error: error.message, requestId: msg.id });
        }
    }
}

function sendMessage(socket: net.Socket, msg: any) {
    try {
        if (socket.writable) {
            socket.write(JSON.stringify(msg) + '\n');
        }
    } catch (e) {
        console.error('[BRIDGE] Send error:', e);
    }
}

export function stopBridgeServer() {
    if (bridgeServer) {
        bridgeServer.close();
        bridgeServer = null;
    }
}
