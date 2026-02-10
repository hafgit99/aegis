#!/usr/bin/env node
/**
 * Aegis Vault Native Messaging Bridge
 * Pure Node.js - No Electron dependency
 * Forwards messages between Chrome Extension and Main Aegis App via Named Pipe
 */

const net = require('net');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PIPE_NAME = '\\\\.\\pipe\\aegis-vault-pipe-v3';
let sessionToken = null;

// Read session token from secure file
function getSessionToken(forceRefresh) {
    if (forceRefresh === undefined) forceRefresh = false;
    if (sessionToken && !forceRefresh) return sessionToken;
    try {
        if (forceRefresh) sessionToken = null;

        var appData = process.env.APPDATA || (process.platform === 'win32' ? path.join(os.homedir(), 'AppData', 'Roaming') : os.homedir());
        var localAppData = process.env.LOCALAPPDATA || (process.platform === 'win32' ? path.join(os.homedir(), 'AppData', 'Local') : os.homedir());

        var possiblePaths = [
            path.join(appData, 'aegis-vault-3.0', '.bridge_token'),
            path.join(appData, 'Aegis Vault', '.bridge_token'),
            path.join(localAppData, 'aegis-vault-3.0', '.bridge_token'),
            path.join(__dirname, 'aegis-data', '.bridge_token'),
            path.join(os.homedir(), '.aegis-vault', '.bridge_token'),
            path.join(os.homedir(), '.bridge_token')
        ];

        var foundTokens = [];
        for (var i = 0; i < possiblePaths.length; i++) {
            var p = possiblePaths[i];
            if (fs.existsSync(p)) {
                try {
                    var stats = fs.statSync(p);
                    var content = fs.readFileSync(p, 'utf8').trim();
                    if (content && content.length >= 32) {
                        foundTokens.push({ path: p, mtime: stats.mtimeMs, content: content });
                    }
                } catch (e) { }
            }
        }

        if (foundTokens.length > 0) {
            // Newest first
            foundTokens.sort(function (a, b) { return b.mtime - a.mtime; });

            var best = foundTokens[0];
            sessionToken = best.content;
            log('Newest token chosen: ' + best.path + ' (Updated: ' + new Date(best.mtime).toISOString() + ')');
            log('Token starts with: ' + sessionToken.substring(0, 4) + '...');
            return sessionToken;
        }
        log('WARNING: No valid token file found (checked ' + possiblePaths.length + ' paths)');
    } catch (e) {
        log('CRITICAL: getSessionToken failed: ' + e.message);
    }
    return 'NO_TOKEN_FOUND';
}

// Log to multiple locations for maximum visibility
// Log to multiple locations for maximum visibility - DISABLED
function log(msg) {
    // Logging disabled for production to keep desktop clean
}

// Silence console to prevent stdout corruption
console.log = () => { };
console.error = (err) => log('ERROR: ' + err);

log('=== Bridge Started ===');
log('Args: ' + JSON.stringify(process.argv));

const MAX_MESSAGE_SIZE = 5 * 1024 * 1024; // 5MB limit
const MAX_MESSAGES_PER_SECOND = 50; // Increased to prevent false positives
let messageCount = 0;
let lastResetTime = Date.now();
let activeSocket = null;
let isFirstConnection = true;

// Rate limiting check
function isRateLimited() {
    const now = Date.now();
    if (now - lastResetTime > 1000) {
        messageCount = 0;
        lastResetTime = now;
    }
    if (messageCount >= MAX_MESSAGES_PER_SECOND) {
        return true;
    }
    messageCount++;
    return false;
}

// Inbound: Chrome (stdin) -> Main App (pipe)
let inputBuffer = Buffer.alloc(0);
process.stdin.on('data', (chunk) => {
    if (inputBuffer.length + chunk.length > MAX_MESSAGE_SIZE + 4) {
        log('CRITICAL: Stdin buffer overflow');
        inputBuffer = Buffer.alloc(0);
        return;
    }
    inputBuffer = Buffer.concat([inputBuffer, chunk]);

    while (inputBuffer.length >= 4) {
        const msgLen = inputBuffer.readUInt32LE(0);
        if (msgLen > MAX_MESSAGE_SIZE) {
            log('CRITICAL: Message too large, dropping');
            process.exit(1);
        }

        if (inputBuffer.length >= 4 + msgLen) {
            const payload = inputBuffer.subarray(4, 4 + msgLen).toString('utf8');
            inputBuffer = inputBuffer.subarray(4 + msgLen);

            if (isRateLimited()) {
                log('WARNING: Rate limit exceeded');
                continue;
            }

            log('From Chrome (ID: ' + (JSON.parse(payload).id || 'N/A') + ')');

            if (activeSocket && !activeSocket.destroyed) {
                try {
                    const msgObj = JSON.parse(payload);
                    msgObj.token = getSessionToken();
                    const json = JSON.stringify(msgObj);
                    activeSocket.write(json + '\n');
                    log('Sent to pipe (ID: ' + (msgObj.id || 'N/A') + ', Token: ' + msgObj.token.substring(0, 4) + '...)');
                } catch (e) { log('Send to pipe failed: ' + e.message); }
            } else {
                log('WARNING: Message dropped, no active pipe connection');
            }
        } else break;
    }
});

// Outbound: Main App (pipe) -> Chrome (stdout)
function setupSocket(socket) {
    let pipeBuffer = '';
    socket.on('data', (data) => {
        log('Data received from Main App');
        pipeBuffer += data.toString();
        const lines = pipeBuffer.split('\n');
        pipeBuffer = lines.pop();

        for (const line of lines) {
            if (line.trim()) {
                try {
                    const msg = JSON.parse(line);
                    if (msg.error === 'UNAUTHORIZED_BRIDGE') {
                        log('Handshake failed: Unauthorized');
                        getSessionToken(true);
                    }
                    sendToChrome(msg);
                } catch (e) { log('Parse error from pipe: ' + e.message); }
            }
        }
    });

    socket.on('close', () => {
        log('Socket closed.');
        activeSocket = null;
    });

    socket.on('error', (err) => {
        log('Socket error: ' + err.message);
    });
}

function connectToPipe(retries) {
    if (retries === undefined) retries = 100;
    log('Connecting to pipe: ' + PIPE_NAME + ' (retries: ' + retries + ')');

    const socket = net.createConnection(PIPE_NAME);
    socket.setTimeout(10000);

    socket.on('connect', () => {
        log('Connected to Main App!');
        activeSocket = socket;
        setupSocket(socket);
        socket.setTimeout(0);
    });

    socket.on('error', (err) => {
        log('Connection error: ' + err.message);
    });

    socket.on('close', () => {
        if (!activeSocket) {
            if (retries <= 0) {
                log('Gave up. Exiting.');
                process.exit(1);
            } else {
                log('Retrying...');
                setTimeout(() => connectToPipe(retries - 1), 300);
            }
        }
    });
}

// Send to Chrome (stdout)
function sendToChrome(msg) {
    try {
        const payload = JSON.stringify(msg);
        const buffer = Buffer.from(payload, 'utf8');
        const header = Buffer.alloc(4);
        header.writeUInt32LE(buffer.length, 0);
        process.stdout.write(header);
        process.stdout.write(buffer);
        log('Sent to Chrome: ' + payload.substring(0, 50));
    } catch (e) { log('Stdout error'); }
}

connectToPipe();
