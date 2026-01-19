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

// Send message to Chrome using Native Messaging protocol (4-byte length prefix + JSON)
function sendToChrome(msg) {
    const payload = JSON.stringify(msg);
    const buffer = Buffer.from(payload, 'utf8');
    const header = Buffer.alloc(4);
    header.writeUInt32LE(buffer.length, 0);

    process.stdout.write(header);
    process.stdout.write(buffer);
    log('Sent to Chrome: ' + payload.substring(0, 100));
}

// Connect to Main App's Pipe Server
function connectToPipe(retries = 30) {
    log('Connecting to pipe: ' + PIPE_NAME + ' (retries left: ' + retries + ')');

    const socket = net.createConnection(PIPE_NAME);

    socket.on('connect', () => {
        log('Connected to Main App!');
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
        inputBuffer = Buffer.concat([inputBuffer, chunk]);
        while (inputBuffer.length >= 4) {
            const msgLen = inputBuffer.readUInt32LE(0);
            if (inputBuffer.length >= 4 + msgLen) {
                const payload = inputBuffer.subarray(4, 4 + msgLen).toString('utf8');
                inputBuffer = inputBuffer.subarray(4 + msgLen);

                log('From Chrome: ' + payload.substring(0, 100));
                socket.write(payload + '\n');
            } else {
                break;
            }
        }
    });

    // From Main App (pipe) -> To Chrome (stdout)
    let pipeBuffer = '';
    socket.on('data', (data) => {
        pipeBuffer += data.toString();
        const lines = pipeBuffer.split('\n');
        pipeBuffer = lines.pop(); // Keep incomplete line

        for (const line of lines) {
            if (line.trim()) {
                try {
                    const msg = JSON.parse(line);
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
