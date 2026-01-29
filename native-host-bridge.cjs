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

const PIPE_NAME = '\\\\.\\pipe\\aegis-vault-pipe';
let sessionToken = null;

// Read session token from secure file
function getSessionToken(forceRefresh = false) {
    if (sessionToken && !forceRefresh) return sessionToken;
    try {
        // Clear cached token if refresh requested
        if (forceRefresh) sessionToken = null;

        // Path matches setupPortablePaths in main.js
        let userDataPath;
        const appName = 'aegis-vault';

        // Check standard locations for the .bridge_token file
        const possiblePaths = [
            path.join(path.dirname(process.execPath), 'aegis-data', '.bridge_token'),
            path.join(os.homedir(), 'AppData', 'Roaming', 'aegis-vault', '.bridge_token'),
            path.join(os.homedir(), 'AppData', 'Local', 'aegis-vault', '.bridge_token')
        ];

        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                sessionToken = fs.readFileSync(p, 'utf8').trim();
                log('Token refreshed from: ' + p);
                return sessionToken;
            }
        }
        log('WARNING: Session token not found in any standard path');
    } catch (e) {
        log('Token read error: ' + e.message);
    }
    return null;
}

// Log to Desktop for debugging
const logPath = path.join(os.homedir(), 'Desktop', 'bridge_debug.log');
function log(msg) {
    // Debug logging disabled for production
    // Uncomment below for troubleshooting
    /*
    try {
        fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
    } catch (e) { }
    */
}

// Silence console to prevent stdout corruption
console.log = () => { };
console.error = (err) => log('ERROR: ' + err);

log('=== Bridge Started ===');
log('Args: ' + JSON.stringify(process.argv));

const MAX_MESSAGE_SIZE = 5 * 1024 * 1024; // 5MB limit
const MAX_MESSAGES_PER_SECOND = 20; // Force rate limit
let messageCount = 0;
let lastResetTime = Date.now();

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

// Send message to Chrome using Native Messaging protocol (4-byte length prefix + JSON)
function sendToChrome(msg) {
    try {
        const payload = JSON.stringify(msg);
        const buffer = Buffer.from(payload, 'utf8');

        if (buffer.length > MAX_MESSAGE_SIZE) {
            log('CRITICAL: Outbound message too large, dropping');
            return;
        }

        const header = Buffer.alloc(4);
        header.writeUInt32LE(buffer.length, 0);

        process.stdout.write(header);
        process.stdout.write(buffer);
        log('Sent to Chrome: ' + payload.substring(0, 100));
    } catch (e) {
        log('Send error: ' + e.message);
    }
}

// Connect to Main App's Pipe Server
function connectToPipe(retries = 30) {
    log('Connecting to pipe: ' + PIPE_NAME + ' (retries left: ' + retries + ')');

    const socket = net.createConnection(PIPE_NAME);

    // SECURITY: Add connection timeout
    socket.setTimeout(10000); // 10s inactivity timeout

    socket.on('connect', () => {
        log('Connected to Main App!');
        socket.setTimeout(0); // Reset timeout after connection
    });

    socket.on('timeout', () => {
        log('Socket timeout. Closing connection.');
        socket.destroy();
    });

    socket.on('error', (err) => {
        log('Socket error: ' + err.message);
        if (retries > 0) {
            setTimeout(() => connectToPipe(retries - 1), 300);
        } else {
            log('Gave up connecting. Exiting.');
            process.exit(1);
        }
    });

    socket.on('close', () => {
        log('Socket closed.');
        process.exit(0);
    });

    // From Chrome (stdin) -> To Main App (pipe)
    let inputBuffer = Buffer.alloc(0);
    process.stdin.on('data', (chunk) => {
        // SECURITY: Buffer growth protection
        if (inputBuffer.length + chunk.length > MAX_MESSAGE_SIZE + 4) {
            log('CRITICAL: Stdin buffer overflow, clearing');
            inputBuffer = Buffer.alloc(0);
            return;
        }

        inputBuffer = Buffer.concat([inputBuffer, chunk]);

        while (inputBuffer.length >= 4) {
            const msgLen = inputBuffer.readUInt32LE(0);

            // SECURITY: Message size validation
            if (msgLen > MAX_MESSAGE_SIZE) {
                log(`CRITICAL: Message too large (${msgLen}), dropping connection`);
                process.exit(1);
            }

            if (inputBuffer.length >= 4 + msgLen) {
                const payload = inputBuffer.subarray(4, 4 + msgLen).toString('utf8');
                inputBuffer = inputBuffer.subarray(4 + msgLen);

                // SECURITY: Rate limiting
                if (isRateLimited()) {
                    log('WARNING: Rate limit exceeded, dropping message');
                    continue;
                }

                log('From Chrome: ' + payload.substring(0, 100));

                // Inject Session Token into message
                try {
                    const msgObj = JSON.parse(payload);
                    msgObj.token = getSessionToken();
                    socket.write(JSON.stringify(msgObj) + '\n');
                } catch (e) {
                    log('Malformed JSON from Chrome, dropping');
                }
            } else {
                break;
            }
        }
    });

    // From Main App (pipe) -> To Chrome (stdout)
    let pipeBuffer = '';
    socket.on('data', (data) => {
        // SECURITY: Buffer growth protection for pipe
        if (pipeBuffer.length + data.length > MAX_MESSAGE_SIZE * 2) {
            log('CRITICAL: Pipe buffer overflow, resetting');
            pipeBuffer = '';
            return;
        }

        pipeBuffer += data.toString();
        const lines = pipeBuffer.split('\n');
        pipeBuffer = lines.pop(); // Keep incomplete line

        for (const line of lines) {
            if (line.trim()) {
                if (line.length > MAX_MESSAGE_SIZE) {
                    log('WARNING: Line from pipe exceeds MAX_MESSAGE_SIZE, skipping');
                    continue;
                }
                try {
                    const msg = JSON.parse(line);

                    // SECURITY: If Main App rejected our token, it might have been rotated.
                    // Force a re-read for next messages.
                    if (msg.error === 'UNAUTHORIZED_BRIDGE') {
                        log('Handshake failed: Token likely rotated. Refreshing...');
                        getSessionToken(true);
                    }

                    sendToChrome(msg);
                } catch (e) {
                    log('Parse error: ' + e.message);
                }
            }
        }
    });
}

// Start
connectToPipe();
