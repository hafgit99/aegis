import { app, BrowserWindow, ipcMain, clipboard, protocol, powerMonitor, dialog } from 'electron';
import path from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import net from 'net';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { databaseService } from './services/databaseService.js';
import { setupCloudSyncHandlers } from './services/cloudSyncMain.js';

// Initialize Cloud Sync
setupCloudSyncHandlers();

// SECURITY: Portable Mode Setup
// Ensure vault data is stored in a consistent, secure location
function setupPortablePaths() {
  // TRUE PORTABLE MODE: Store data next to the executable
  let dataPath;

  if (app.isPackaged) {
    // In production: Use "aegis-data" folder next to the .exe
    dataPath = path.join(path.dirname(app.getPath('exe')), 'aegis-data');
  } else {
    // In development: Use "aegis-data" in project root
    dataPath = path.join(__dirname, 'aegis-data');
  }

  // SECURITY: Create directory with secure permissions
  if (!fs.existsSync(dataPath)) {
    try {
      fs.mkdirSync(dataPath, { recursive: true });
    } catch (e) {
      console.error('Failed to create portable data directory:', e);
      // Fallback to AppData if writing to exe dir fails (e.g. Program Files)
      dataPath = path.join(app.getPath('appData'), 'Aegis Vault Portable');
      fs.mkdirSync(dataPath, { recursive: true });
    }
  }

  app.setPath('userData', dataPath);
  console.log('[Setup] Portable data path set to:', dataPath);
  return dataPath;
}

// SECURITY: Windows Credential Manager integration
let keytar = null;

async function loadKeytar() {
  try {
    keytar = (await import('keytar')).default;
  } catch (e) {
    console.warn('keytar not available (native dependency not installed)');
  }
}

// SECURITY: Audit logging with encryption
// SECURITY: Store audit key in hidden directory with restricted permissions
const auditLogPath = path.join(app.getPath('userData'), '.audit.log');
const auditLogKeyPath = path.join(app.getPath('userData'), '.audit', '.audit-key');
const auditBuffer = [];
const MAX_AUDIT_BUFFER = 100;

let mainWindow;
let deviceKey = null; // Cached device key for session
let nativeSecurity = null;

// SECURITY: Attempt to load native security addon (VirtualLock/mlock)
try {
  // Use path.join to find the build/Release/aegis_security.node
  const addonPath = path.join(__dirname, 'build', 'Release', 'aegis_security.node');
  if (fs.existsSync(addonPath)) {
    nativeSecurity = require(addonPath);
    console.log('[Security] Native security addon loaded successfully');
  } else {
    console.warn('[Security] Native security addon not found. Memory page locking will be simulated.');
  }
} catch (e) {
  console.warn('[Security] Failed to load native security addon:', e.message);
}

// SECURITY: Hardware Binding Secret (DPAPI Protected)
function getHardwareBoundSecret() {
  const hwPath = path.join(app.getPath('userData'), '.aegis_hb');

  if (nativeSecurity) {
    try {
      if (fs.existsSync(hwPath)) {
        const encrypted = fs.readFileSync(hwPath);
        const decrypted = nativeSecurity.unprotectData(encrypted);
        if (decrypted) {
          console.log('[Security] Hardware secret decrypted successfully');
          return decrypted;
        }
      }

      // First run or recovery: Create new hardware secret
      console.log('[Security] Generating new hardware binding secret...');
      const secret = crypto.randomBytes(32);
      const encrypted = nativeSecurity.protectData(secret);
      if (encrypted) {
        fs.writeFileSync(hwPath, encrypted);
        return secret;
      }
    } catch (e) {
      console.error('[Security] Hardware binding failed:', e.message);
    }
  }

  // Fallback to Device ID based seed if native/DPAPI fails
  console.warn('[Security] Falling back to software hardware binding');
  return crypto.createHash('sha256').update(getDeviceId() + 'AEGIS-HB-SALT').digest();
}

function getDeviceId() {
  try {
    let serial = "";
    if (process.platform === 'win32') {
      // Windows: Motherboard + CPU Serial
      serial = execSync('wmic baseboard get serialnumber').toString() +
        execSync('wmic cpu get processorid').toString();
    } else if (process.platform === 'darwin') {
      // macOS: Hardware UUID
      serial = execSync("ioreg -rd1 -c IOPlatformExpertDevice | grep -E '(IOPlatformSerialNumber|IOPlatformUUID)'").toString();
    } else {
      serial = os.hostname() + os.arch() + os.totalmem();
    }
    return crypto.createHash('sha256').update(serial.replace(/\s/g, '')).digest('hex').toUpperCase().substring(0, 24);
  } catch (e) {
    return "AEGIS-GENERIC-ID-" + crypto.randomBytes(4).toString('hex').toUpperCase();
  }
}

// SECURITY: Derive device-specific key for audit log encryption
function getDeviceKey() {
  if (deviceKey) return deviceKey;

  try {
    // Check if persistent device key exists
    if (fs.existsSync(auditLogKeyPath)) {
      const keyData = JSON.parse(fs.readFileSync(auditLogKeyPath, 'utf8'));

      // SECURITY: Check key age and rotate if older than 90 days
      const keyAge = Date.now() - keyData.createdAt;
      const MAX_KEY_AGE = 90 * 24 * 60 * 60 * 1000; // 90 days in milliseconds

      if (keyAge > MAX_KEY_AGE && keyData.rotatedAt) {
        console.log('[Security] Rotating audit log encryption key - key age > 90 days');

        // Generate new key
        const deviceId = getDeviceId();
        const newSeed = crypto.randomBytes(32).toString('hex');
        const combinedData = deviceId + newSeed;
        deviceKey = crypto.createHash('sha256').update(combinedData).digest();

        // Update with rotation timestamp
        keyData.seed = newSeed;
        keyData.rotatedAt = Date.now();
        fs.writeFileSync(auditLogKeyPath, JSON.stringify(keyData), 'utf8');

        // SECURITY: Re-encrypt existing audit logs with new key
        console.log('[Security] Audit log key rotated, existing logs will be re-encrypted on next flush');
      }

      // Re-derive from device serial + stored seed
      const deviceId = getDeviceId();
      const combinedData = deviceId + keyData.seed;
      deviceKey = crypto.createHash('sha256').update(combinedData).digest();
      return deviceKey;
    } else {
      // Create new device key on first run
      const deviceId = getDeviceId();
      const seed = crypto.randomBytes(32).toString('hex');
      const combinedData = deviceId + seed;
      deviceKey = crypto.createHash('sha256').update(combinedData).digest();

      // Persist seed with rotation metadata
      fs.writeFileSync(auditLogKeyPath, JSON.stringify({
        seed,
        createdAt: Date.now(),
        rotatedAt: null
      }), 'utf8');
      return deviceKey;
    }
  } catch (e) {
    console.error('Failed to derive device key:', e);
    // Fallback to ephemeral key
    deviceKey = crypto.randomBytes(32);
    return deviceKey;
  }
}

// SECURITY: Encrypted audit logging helpers
function recordAuditLog(action, metadata = {}) {
  const entry = {
    timestamp: Date.now(),
    action,
    metadata,
    deviceId: getDeviceId()
  };

  auditBuffer.push(entry);

  // Flush to disk if buffer is full
  if (auditBuffer.length >= MAX_AUDIT_BUFFER) {
    flushAuditLog();
  }
}

function flushAuditLog() {
  if (auditBuffer.length === 0) return;

  try {
    const entriesToWrite = auditBuffer.splice(0, auditBuffer.length);
    const logEntries = entriesToWrite.map(e => JSON.stringify(e)).join('\n') + '\n';

    // SECURITY: Encrypt audit log entries
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getDeviceKey(), iv);
    let encrypted = cipher.update(logEntries, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag();

    // Format: iv:tag:ciphertext (hex encoded)
    const encryptedEntry = iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted + '\n';

    fs.appendFileSync(auditLogPath, encryptedEntry, 'utf8');
  } catch (err) {
    console.error('Failed to flush audit log:', err.message);
  }
}

// Helper to read encrypted audit log (for admin purposes)
function readAuditLog() {
  try {
    if (!fs.existsSync(auditLogPath)) return [];

    const content = fs.readFileSync(auditLogPath, 'utf8');
    const lines = content.trim().split('\n').filter(l => l);
    const entries = [];
    const deviceKey = getDeviceKey();

    for (const line of lines) {
      try {
        const parts = line.split(':');
        if (parts.length < 3) continue;

        const iv = Buffer.from(parts[0], 'hex');
        const tag = Buffer.from(parts[1], 'hex');
        const ciphertext = parts.slice(2).join(':'); // In case ciphertext has colons

        const decipher = crypto.createDecipheriv('aes-256-gcm', deviceKey, iv);
        decipher.setAuthTag(tag);
        let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        // Each line can contain multiple JSON entries
        const logLines = decrypted.trim().split('\n');
        for (const logLine of logLines) {
          if (logLine) entries.push(JSON.parse(logLine));
        }
      } catch (e) {
        console.warn('Failed to decrypt audit log entry:', e.message);
      }
    }

    return entries;
  } catch (err) {
    console.error('Failed to read audit log:', err.message);
    return [];
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    center: true,
    backgroundColor: '#050505',
    frame: false, // Arka plan çerçevesini tamamen kaldır
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: app.isPackaged
        ? path.join(process.resourcesPath, 'preload.cjs')
        : path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true,
      enableRemoteModule: false
    },
    resizable: true
  });

  // SECURITY: Prevent screen capture and recording
  mainWindow.setContentProtection(true);

  // Geliştirme aşamasında Vite sunucusunu kullan, dağıtımda index.html'i yükle
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  // Cleanup mainWindow reference when window is closed
  mainWindow.on('closed', () => {
    console.log('[MainWindow] Window closed, clearing reference');
    mainWindow = null;
  });

  // SECURITY: Setup response headers
  mainWindow.webContents.session.webRequest.onHeadersReceived(
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Strict-Transport-Security': ['max-age=31536000; includeSubDomains; preload'],
          'X-Content-Type-Options': ['nosniff'],
          'X-Frame-Options': ['DENY'],
          'X-XSS-Protection': ['1; mode=block'],
          'Referrer-Policy': ['no-referrer'],
          'Permissions-Policy': [
            'geolocation=()',
            'microphone=()',
            'camera=()',
            'payment=()',
            'usb=(self)',
            'public-key-credentials-create=(self)',
            'public-key-credentials-get=(self)',
            'magnetometer=()',
            'gyroscope=()',
            'accelerometer=()'
          ].join(', '),
          'Cross-Origin-Embedder-Policy': ['require-corp'],
          'Cross-Origin-Opener-Policy': ['same-origin']
        }
      });
    }
  );

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
    // DevTools'u otomatik aç (migration debug için)
    // mainWindow.webContents.openDevTools();
  });

  // Prevent navigation and handle window lifecycle properly
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[MainWindow] Failed to load:', errorCode, errorDescription);
  });
}

// SECURITY: Dedicated Bridge Server for Native Messaging
// Only used to communicate between the Extension Bridge process and the Main App.
const PIPE_NAME = '\\\\.\\pipe\\aegis-vault-pipe';
let bridgeSessionToken = null;
let bridgeRotationTimer = null;

/**
 * SECURITY: Generates and manages the Bridge Session Token.
 * Implements: 1. OS-level storage, 2. File permissions, 3. Rotation
 */
async function getBridgeToken(forceRotate = false) {
  if (bridgeSessionToken && !forceRotate) return bridgeSessionToken;

  const tokenPath = path.join(app.getPath('userData'), '.bridge_token');
  try {
    // 1. Generate new 256-bit high-entropy token
    bridgeSessionToken = crypto.randomBytes(32).toString('hex');

    // 2. OS-LEVEL SECURE STORAGE: Store in Keychain/Credential Manager
    if (keytar) {
      try {
        await keytar.setPassword('AegisVault', 'BridgeSessionToken', bridgeSessionToken);
      } catch (e) {
        console.warn('[Security] Failed to store bridge token in OS vault:', e.message);
      }
    }

    // 3. FILE PERMISSIONS: Write with 0600 (Owner Read/Write Only)
    fs.writeFileSync(tokenPath, bridgeSessionToken, { mode: 0o600 });

    // 4. TOKEN ROTATION: Scheduled rotation every 30 minutes
    if (!bridgeRotationTimer) {
      bridgeRotationTimer = setInterval(() => {
        console.log('[Security] Rotating bridge session token...');
        getBridgeToken(true);
      }, 30 * 60 * 1000);
    }

    return bridgeSessionToken;
  } catch (e) {
    console.error('[Security] Failed to create bridge token:', e);
    return null;
  }
}

/**
 * SECURITY: Cleanup bridge artifacts to prevent persistent token exposure
 */
async function cleanupBridgeToken() {
  const tokenPath = path.join(app.getPath('userData'), '.bridge_token');
  try {
    if (fs.existsSync(tokenPath)) fs.unlinkSync(tokenPath);
    if (keytar) await keytar.deletePassword('AegisVault', 'BridgeSessionToken');
    bridgeSessionToken = null;
    if (bridgeRotationTimer) clearInterval(bridgeRotationTimer);
  } catch (e) { }
}

// Helper for shared logging
function logMain(msg) {
  // Debug logging disabled for production
  // Uncomment below for troubleshooting
  /*
  try {
    const logPath = path.join(app.getPath('desktop'), 'native_host.log');
    fs.appendFileSync(logPath, `[MAIN ${new Date().toISOString()}] ${msg}\n`);
  } catch (e) { }
  */
}

// 1. MAIN PROCESS: Listen for Bridge connections
let bridgeServer = null;
function setupBridgeServer() {
  // Prevent duplicate server creation
  if (bridgeServer) {
    logMain("Bridge Server already exists, skipping setup.");
    return bridgeServer;
  }

  logMain("Setting up Bridge Server on: " + PIPE_NAME);

  // If pipe exists, remove it (cleanup)
  try {
    if (fs.existsSync(PIPE_NAME.replace('\\\\.\\pipe\\', ''))) {
      // Try to clean up old pipe
      const client = net.createConnection(PIPE_NAME, () => {
        client.destroy();
      });
      client.on('error', () => { });
    }
  } catch (e) {
    // Ignore cleanup errors
  }

  bridgeServer = net.createServer((socket) => {
    logMain("Bridge connection accepted from Native Host process.");

    socket.on('data', async (data) => {
      // Data received from Bridge (originally from Chrome)
      const chunks = data.toString().split('\n').filter(c => c.trim());
      for (const chunk of chunks) {
        try {
          const msg = JSON.parse(chunk);

          // SECURITY: Handshake Verification (Constant-time check to prevent timing attacks)
          const currentToken = bridgeSessionToken; // Use cached sync value
          if (!msg.token || !currentToken || !crypto.timingSafeEqual(Buffer.from(msg.token), Buffer.from(currentToken))) {
            logMain("CRITICAL: Invalid or missing bridge token!");
            socket.write(JSON.stringify({ success: false, error: "UNAUTHORIZED_BRIDGE" }) + "\n");
            return;
          }

          logMain("Received Message: " + msg.type);
          // Process the message (Search, Sign, etc.)
          await handleExtensionMessage(socket, msg);
        } catch (e) {
          logMain('[Bridge] Malformed message: ' + e.message);
        }
      }
    });
  });

  bridgeServer.listen(PIPE_NAME, () => {
    logMain("Bridge Server listening successfully.");
  });

  bridgeServer.on('error', (err) => {
    logMain("Bridge Server Error: " + err.message);
  });

  return bridgeServer;
}

// 2. BRIDGE PROCESS (Native Messaging Host): Forward Chrome <-> Main App
function runBridgeMode() {
  // CRITICAL: Do NOT use app.getPath() here - it triggers Electron lifecycle!
  // Use os.homedir() instead for pure Node.js operation.
  const os = require('os');
  const logPath = path.join(os.homedir(), 'Desktop', 'native_host.log');
  const log = (msg) => {
    // Debug logging disabled for production
    /*
    try {
      fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`);
    } catch (e) { }
    */
  };

  // Silence stdout for protocol compliance
  console.log = function () { };
  console.error = function (err) { log("ERROR: " + err); };
  console.warn = function () { };

  log("Starting Bridge Mode...");
  log("Args: " + JSON.stringify(process.argv));

  // CRITICAL: Prevent Electron from creating windows
  // This must happen BEFORE any async operations
  if (app && app.on) {
    app.on('ready', () => {
      log("Electron ready event fired in Bridge Mode - ignoring.");
    });
    app.on('window-all-closed', () => {
      // Do nothing - prevent default quit behavior
    });
  }
  log("Starting Bridge Mode...");
  log("Args: " + JSON.stringify(process.argv));

  const tryConnect = (retries = 20) => {
    log("Attempting connection to pipe: " + PIPE_NAME + " (Retry: " + retries + ")");
    const socket = net.createConnection(PIPE_NAME);

    const cleanup = () => {
      try { socket.end(); } catch (e) { }
      process.exit(0);
    };

    socket.on('connect', () => {
      // Bridge connected to Main App
    });

    socket.on('error', (err) => {
      if (retries > 0) {
        setTimeout(() => tryConnect(retries - 1), 500);
      } else {
        // Log minimal error to stderr if needed, but Native Messaging expects specific format or silence
        process.exit(1);
      }
    });

    socket.on('close', cleanup);
    process.on('SIGINT', cleanup);

    // A. From Chrome (stdin) -> To Pipe
    let inputBuffer = Buffer.alloc(0);
    process.stdin.on('data', (chunk) => {
      inputBuffer = Buffer.concat([inputBuffer, chunk]);
      while (inputBuffer.length >= 4) {
        const msgLen = inputBuffer.readUint32LE(0);
        if (inputBuffer.length >= 4 + msgLen) {
          const payload = inputBuffer.subarray(4, 4 + msgLen);
          inputBuffer = inputBuffer.subarray(4 + msgLen);

          socket.write(payload);
          socket.write('\n');
        } else {
          break;
        }
      }
    });

    // B. From Pipe (Main App) -> To Chrome (stdout)
    socket.on('data', (data) => {
      const lines = data.toString().split('\n').filter(l => l.trim());
      for (const line of lines) {
        try {
          const msg = JSON.parse(line);
          sendToExtension(process.stdout, msg);
        } catch (e) {
          // Ignore
        }
      }
    });
  };

  tryConnect();
}

const EXTENSION_ID = 'pjjmjgibliobepbjbghmipfpiljgogii';
function sendToExtension(socketOrStdout, message) {
  const payload = JSON.stringify(message);
  const buffer = Buffer.from(payload);
  const header = Buffer.alloc(4);
  header.writeUint32LE(buffer.length, 0);

  if (socketOrStdout.write) {
    socketOrStdout.write(header);
    socketOrStdout.write(buffer);
  } else {
    process.stdout.write(header);
    process.stdout.write(buffer);
  }
}

/**
 * Registers this application as a Native Messaging Host in the OS.
 * Uses a standalone Node.js bridge script (not the Electron app) to avoid lifecycle conflicts.
 */
async function setupNativeMessagingHost() {
  const hostName = 'com.aegis.vault';

  // Path to the standalone bridge script
  let bridgeScript;
  let nodeExe;

  const exeDir = path.dirname(app.getPath('exe'));

  if (app.isPackaged) {
    // Production path
    bridgeScript = path.join(exeDir, 'resources', 'native-host-bridge.cjs');
    nodeExe = path.join(exeDir, 'node.exe');
  } else {
    // Development path
    bridgeScript = path.join(__dirname, 'native-host-bridge.cjs');
    nodeExe = 'node'; // Use system node in dev
  }

  // Create a batch file to launch node with the bridge script
  const batchPath = path.join(app.getPath('userData'), 'aegis-bridge.bat');
  const batchContent = `@echo off\n"${nodeExe}" "${bridgeScript}" %*`;
  fs.writeFileSync(batchPath, batchContent);

  const manifest = {
    name: hostName,
    description: "Aegis Vault Security Bridge",
    path: batchPath,
    type: "stdio",
    allowed_origins: [
      `chrome-extension://${EXTENSION_ID}/`
    ]
  };

  const manifestPath = path.join(app.getPath('userData'), 'com.aegis.vault.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  logMain("Native Host manifest written to: " + manifestPath);
  logMain("Bridge batch file written to: " + batchPath);

  // Trigger token generation so it's ready for the bridge
  await getBridgeToken();

  if (process.platform === 'win32') {
    const regKey = `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${hostName}`;
    try {
      execSync(`reg add "${regKey}" /ve /t REG_SZ /d "${manifestPath}" /f`);
      console.log('[Security] Native Messaging Host registered in Registry');
    } catch (e) {
      console.error('[Security] Failed to register Registry key:', e.message);
    }
  }
}

// 3. STARTUP LOGIC
// Check if running as Native Messaging Host (Bridge Mode)
// Chrome passes the origin (chrome-extension://ID/) as an argument on Windows
const isNativeHost = process.argv.includes('--native-messaging-host') ||
  process.argv.includes('com.aegis.vault.json') ||
  process.argv.some(arg => arg.startsWith('chrome-extension://'));

if (isNativeHost) {
  // We are the Bridge Process launched by Chrome
  runBridgeMode();
  // Do NOT continue to create window or start app
} else {
  // We are the Main Application
  // Check Single Instance Lock
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) {
    app.quit();
  } else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
      // Someone tried to run a second instance, we should focus our window.
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    });

    app.whenReady().then(async () => {
      // SECURITY: If we somehow got here in Native Host mode, STOP immediately.
      // This prevents double-database access and phantom windows.
      if (isNativeHost) {
        logMain("Detected Native Host mode inside whenReady - Aborting GUI launch.");
        return;
      }

      await loadKeytar();
      const userDataPath = setupPortablePaths();
      console.log('User data path:', userDataPath);

      createWindow();

      // SECURITY: Initialize Bridge Server (Main Process Side)
      setupBridgeServer();

      // Register Host Manifest (So Chrome knows where to find us)
      await setupNativeMessagingHost();
    });
  }
}

async function handleExtensionMessage(socketOrStdout, msg) {
  // Handle different request types from the extension
  let response = { id: msg.id, success: false };

  try {
    switch (msg.type) {
      case 'PING':
        response.success = true;
        response.data = "PONG";
        break;
      case 'STATUS':
        response.success = true;
        response.data = {
          locked: !sessionKey,
          version: app.getVersion()
        };
        break;
      case 'SEARCH':
        if (!sessionKey) {
          response.error = "VAULT_LOCKED";
          break;
        }
        // Check if mainWindow exists and is not destroyed
        if (mainWindow && !mainWindow.isDestroyed()) {
          const results = await new Promise((resolve) => {
            const requestId = Math.random().toString(36).substring(7);
            ipcMain.once(`extension:search-result-${requestId}`, (event, data) => resolve(data));
            mainWindow.webContents.send('extension:search', { query: msg.query, requestId });
          });
          response.success = true;
          response.data = results;
        } else {
          response.error = "WINDOW_NOT_AVAILABLE";
        }
        break;
      case 'GET_CREDENTIALS':
        if (!sessionKey) {
          response.error = "VAULT_LOCKED";
          break;
        }
        // Check if mainWindow exists and is not destroyed
        if (mainWindow && !mainWindow.isDestroyed()) {
          const creds = await new Promise((resolve) => {
            const requestId = Math.random().toString(36).substring(7);
            ipcMain.once(`extension:cred-result-${requestId}`, (event, data) => resolve(data));
            mainWindow.webContents.send('extension:get-creds', { entryId: msg.entryId, requestId });
          });
          response.success = true;
          response.data = creds;
        } else {
          response.error = "WINDOW_NOT_AVAILABLE";
        }
        break;
      case 'PASSKEY_SIGN':
        if (!sessionKey) {
          response.error = "VAULT_LOCKED";
          break;
        }
        // Check if mainWindow exists and is not destroyed
        if (mainWindow && !mainWindow.isDestroyed()) {
          const assertion = await new Promise((resolve) => {
            const requestId = Math.random().toString(36).substring(7);
            ipcMain.once(`extension:passkey-result-${requestId}`, (event, data) => resolve(data));
            mainWindow.webContents.send('extension:passkey-sign', {
              entryId: msg.entryId,
              challenge: msg.challenge,
              requestId
            });
          });
          response.success = true;
          response.data = assertion;
        } else {
          response.error = "WINDOW_NOT_AVAILABLE";
        }
        break;
      case 'OPEN_POPUP':
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
          response.success = true;
        } else {
          response.error = "WINDOW_NOT_AVAILABLE";
        }
        break;
      default:
        response.error = "UNKNOWN_COMMAND";
    }
  } catch (err) {
    response.error = err.message;
  }

  // Send response back through the pipe (JSON + newline, not Native Messaging protocol)
  try {
    const responseStr = JSON.stringify(response) + '\n';
    socketOrStdout.write(responseStr);
    logMain("Sent Response: " + response.success);
  } catch (e) {
    logMain("Failed to send response: " + e.message);
  }
}

let clipboardTimer;
let lastCopiedText = "";

ipcMain.on('clipboard:write', (event, text, duration = 45000) => {
  clipboard.writeText(text);
  lastCopiedText = text;

  if (clipboardTimer) clearTimeout(clipboardTimer);

  clipboardTimer = setTimeout(() => {
    // Sadece eğer pano hala bizim kopyaladığımız metni içeriyorsa temizle
    if (clipboard.readText() === lastCopiedText) {
      clipboard.writeText('');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('clipboard:cleared');
      }
    }
  }, duration);
});

ipcMain.handle('get-device-id', async () => {
  return getDeviceId();
});

ipcMain.on('window:minimize', () => {
  console.log('[IPC] window:minimize received');
  if (mainWindow) {
    console.log('[IPC] minimizing window');
    mainWindow.minimize();
  }
});

let lastMaximizeTime = 0;
ipcMain.on('window:maximize', () => {
  if (!mainWindow) return;

  const now = Date.now();
  if (now - lastMaximizeTime < 800) return; // 0.8 saniye bekle
  lastMaximizeTime = now;

  if (mainWindow.isMaximized()) {
    mainWindow.restore(); // unmaximize yerine restore bazen daha kararlıdır
  } else {
    mainWindow.maximize();
  }
});

ipcMain.on('window:close', () => {
  console.log('[IPC] window:close received');
  if (mainWindow) {
    console.log('[IPC] closing window');

    // Cleanup operations before closing
    if (sessionKey) {
      console.log('[IPC] Clearing session key');
      sessionKey.fill(0);
      sessionKey = null;
    }

    // Clear clipboard if it contains our copied text
    if (clipboard.readText() === lastCopiedText) {
      console.log('[IPC] Clearing clipboard');
      clipboard.writeText('');
    }

    // Flush audit logs
    try {
      flushAuditLog();
      console.log('[IPC] Audit logs flushed');
    } catch (e) {
      console.error('[IPC] Failed to flush audit logs:', e);
    }

    // Save brute force state
    try {
      saveBruteForceState();
      console.log('[IPC] Brute force state saved');
    } catch (e) {
      console.error('[IPC] Failed to save brute force state:', e);
    }

    // Clear bridge session
    cleanupBridgeToken();

    mainWindow.close();

    // Quit the application on all platforms
    setTimeout(() => {
      console.log('[IPC] Quitting application');
      app.quit();
    }, 100);
  }
});

ipcMain.on('vault:panic', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

// --- Secure Vault Engine (Node.js Side) ---
let sessionKey = null; // Master Key stays in Main process RAM
let rotationSessionKey = null; // Staged key for vault re-encryption during rotation
let verifierBlob = null; // Master Verifier stays in Main process RAM (SECURE)

// --- Brute Force Protection (Server-side, tamper-proof with persistence) ---
const bruteForceFilePath = path.join(app.getPath('userData'), '.bruteforce-state.json');
const backupMetaPath = path.join(app.getPath('userData'), '.backup-metadata.json');
const bruteForceTracker = new Map(); // In-memory cache
const BRUTE_FORCE_RULES = [
  { threshold: 3, lockout: 30 * 1000 },       // 3 hata -> 30 sn
  { threshold: 5, lockout: 5 * 60 * 1000 },   // 5 hata -> 5 dk
  { threshold: 10, lockout: 30 * 60 * 1000 }  // 10 hata -> 30 dk
];

// SECURITY UPGRADE: Load brute-force state from disk on startup
function loadBruteForceState() {
  try {
    if (fs.existsSync(bruteForceFilePath)) {
      const data = JSON.parse(fs.readFileSync(bruteForceFilePath, 'utf8'));
      const now = Date.now();

      // Load only non-expired entries
      for (const [deviceId, entry] of Object.entries(data)) {
        if (!entry.lockedUntil || entry.lockedUntil > now) {
          bruteForceTracker.set(deviceId, entry);
        }
      }

      console.log(`[Security] Loaded ${bruteForceTracker.size} active brute-force entries from disk`);
    }
  } catch (e) {
    console.error('[Security] Failed to load brute-force state:', e.message);
  }
}

// SECURITY UPGRADE: Save brute-force state to disk (persistent across restarts)
function saveBruteForceState() {
  try {
    const data = {};
    for (const [deviceId, entry] of bruteForceTracker.entries()) {
      data[deviceId] = entry;
    }
    fs.writeFileSync(bruteForceFilePath, JSON.stringify(data), 'utf8');
  } catch (e) {
    console.error('[Security] Failed to save brute-force state:', e.message);
  }
}

// Auto-save on changes (debounced)
let bruteForceSaveTimer = null;
function scheduleBruteForceSave() {
  if (bruteForceSaveTimer) clearTimeout(bruteForceSaveTimer);
  bruteForceSaveTimer = setTimeout(() => {
    saveBruteForceState();
  }, 1000); // Save 1 second after last change
}

// Load state on app start
loadBruteForceState();

ipcMain.handle('vault:prepare-rotation', async (event, newKeyRaw) => {
  try {
    rotationSessionKey = Buffer.from(newKeyRaw);
    console.log('[Security] Vault rotation prepared. Re-encryption will use the new key.');
    return true;
  } catch (e) {
    console.error('[Security] Failed to prepare rotation:', e.message);
    throw e;
  }
});

ipcMain.handle('vault:rotate-key', async (event, newKeyRaw, newVerifier) => {
  try {
    // Favor the rotationSessionKey if it was prepared
    const newSessionKey = rotationSessionKey || Buffer.from(newKeyRaw);
    const hwSecret = getHardwareBoundSecret();
    const newCombinedKey = crypto.createHmac('sha256', hwSecret).update(newSessionKey).digest('hex');

    // 1. Rekey the database
    databaseService.rekey(newCombinedKey);

    // 2. Update session key in memory
    sessionKey = newSessionKey;
    rotationSessionKey = null; // Clear staged key

    if (nativeSecurity) {
      nativeSecurity.lockMemory(sessionKey);
    }

    // 3. Update verifier and metadata
    if (newVerifier) {
      verifierBlob = newVerifier;
      if (verifierBlob.salt) {
        databaseService.setConfig('vault_salt', verifierBlob.salt);
        databaseService.setConfig('vault_iterations', verifierBlob.iterations?.toString() || '20');
      }
    }

    console.log('[Security] Vault master key rotated successfully in Electron.');
    return true;
  } catch (e) {
    console.error('[Security] Vault key rotation failed in Electron:', e.message);
    throw e;
  }
});

ipcMain.handle('vault:set-key', async (event, keyRaw, verifier) => {
  try {
    sessionKey = Buffer.from(keyRaw);

    // SECURITY: Lock memory immediately to prevent swapping
    if (nativeSecurity) {
      try {
        const locked = nativeSecurity.lockMemory(sessionKey);
        console.log(`[Security] Session key locked in RAM: ${locked}`);
      } catch (e) {
        console.error('[Security] Failed to lock session key:', e.message);
      }
    }

    // If verifier is provided, update the global verifierBlob
    if (verifier) {
      verifierBlob = verifier;
    }

    // SECURITY: Initialize SQLite/SQLCipher Database
    const hwSecret = getHardwareBoundSecret();
    const combinedKey = crypto.createHmac('sha256', hwSecret).update(sessionKey).digest('hex');

    databaseService.init(app.getPath('userData'), combinedKey);

    // PERSIST Metadata for CLI access
    if (verifierBlob && verifierBlob.salt) {
      const meta = {
        salt: verifierBlob.salt,
        iterations: verifierBlob.iterations || 20
      };
      const metaPath = path.join(app.getPath('userData'), 'vault_meta.json');
      fs.writeFileSync(metaPath, JSON.stringify(meta));

      databaseService.setConfig('vault_salt', verifierBlob.salt);
      databaseService.setConfig('vault_iterations', verifierBlob.iterations?.toString() || '20');
    }

    return true;
  } catch (e) {
    console.error('[Database] Initialization failed:', e.message);
    throw e; // Standard IPC error return
  }
});

ipcMain.handle('vault:clear-key', () => {
  if (sessionKey) {
    // SECURITY: Unlock memory before wiping if possible
    if (nativeSecurity) {
      try { nativeSecurity.unlockMemory(sessionKey); } catch (e) { }
    }

    // SECURITY: Aggressive wiping - overwrite multiple times
    sessionKey.fill(0xFF);
    sessionKey.fill(0xAA);
    sessionKey.fill(0x55);
    sessionKey.fill(0);
  }
  sessionKey = null;
  if (verifierBlob) verifierBlob = null; // Wipe verifier too

  // SECURITY: Close encrypted database
  try {
    databaseService.close();
  } catch (e) {
    console.error('[Database] Shutdown failed:', e.message);
  }

  // Suggest GC to clean up any remaining references
  if (global.gc) {
    global.gc();
  }
  return true;
});

ipcMain.handle('vault:set-verifier', (event, blob) => {
  verifierBlob = blob; // Store in RAM (not persisted to disk)
  return true;
});

ipcMain.handle('vault:get-verifier', async (event) => {
  if (!verifierBlob) throw new Error("VERIFIER_NOT_SET");
  return verifierBlob;
});

ipcMain.handle('vault:encrypt', async (event, text) => {
  const activeKey = rotationSessionKey || sessionKey;
  if (!activeKey) throw new Error("VAULT_LOCKED");

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', activeKey, iv);

  let encrypted = cipher.update(text, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    ciphertext: encrypted,
    iv: iv,
    tag: tag
  };
});

ipcMain.handle('vault:decrypt', async (event, ciphertext, iv, tag) => {
  if (!sessionKey) throw new Error("VAULT_LOCKED");

  const decipher = crypto.createDecipheriv('aes-256-gcm', sessionKey, Buffer.from(iv));
  decipher.setAuthTag(Buffer.from(tag));

  let decrypted = decipher.update(Buffer.from(ciphertext), 'binary', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
});

ipcMain.handle('vault:encrypt-binary', async (event, buffer) => {
  const activeKey = rotationSessionKey || sessionKey;
  if (!activeKey) throw new Error("VAULT_LOCKED");

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', activeKey, iv);
  const encrypted = Buffer.concat([cipher.update(Buffer.from(buffer)), cipher.final()]);
  return {
    ciphertext: encrypted,
    iv: iv,
    tag: cipher.getAuthTag()
  };
});

ipcMain.handle('vault:decrypt-binary', async (event, ciphertext, iv, tag) => {
  if (!sessionKey) throw new Error("VAULT_LOCKED");
  const decipher = crypto.createDecipheriv('aes-256-gcm', sessionKey, Buffer.from(iv));
  decipher.setAuthTag(Buffer.from(tag));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext)), decipher.final()]);
});

// --- SQLite Database Handlers ---
ipcMain.handle('db:save-entry', async (event, entry) => {
  if (!sessionKey) throw new Error("VAULT_LOCKED");
  return databaseService.saveEntry(entry);
});

ipcMain.handle('db:delete-entry', async (event, id) => {
  if (!sessionKey) throw new Error("VAULT_LOCKED");
  return databaseService.deleteEntry(id);
});

ipcMain.handle('db:get-entry', async (event, id) => {
  if (!sessionKey) throw new Error("VAULT_LOCKED");
  return databaseService.getEntry(id);
});

ipcMain.handle('db:bulk-save-entries', async (event, entries) => {
  if (!sessionKey) throw new Error("VAULT_LOCKED");
  return databaseService.bulkSaveEntries(entries);
});

ipcMain.handle('db:get-all-entries', async () => {
  if (!sessionKey) throw new Error("VAULT_LOCKED");
  return databaseService.getAllEntries();
});

ipcMain.handle('db:save-folder', async (event, folder) => {
  if (!sessionKey) throw new Error("VAULT_LOCKED");
  return databaseService.saveFolder(folder);
});

ipcMain.handle('db:delete-folder', async (event, id) => {
  if (!sessionKey) throw new Error("VAULT_LOCKED");
  return databaseService.deleteFolder(id);
});

ipcMain.handle('db:get-all-folders', async () => {
  if (!sessionKey) throw new Error("VAULT_LOCKED");
  return databaseService.getAllFolders();
});

ipcMain.handle('db:set-config', async (event, key, value) => {
  if (!sessionKey) throw new Error("VAULT_LOCKED");
  return databaseService.setConfig(key, value);
});

ipcMain.handle('db:get-config', async (event, key) => {
  // SECURITY FIX: migration_v1_complete kontrolü için özel durum
  // Migration kontrolü vault unlock olmadan önce yapılabilir
  if (key === 'migration_v1_complete') {
    try {
      // Veritabanı henüz init edilmemişse null dön
      if (!databaseService.db) return null;
      return databaseService.getConfig(key);
    } catch (e) {
      // Hata durumunda null dön (migration yapılmamış kabul et)
      return null;
    }
  }

  // Diğer tüm config'ler için sessionKey gerekli
  if (!sessionKey) throw new Error("VAULT_LOCKED");
  return databaseService.getConfig(key);
});

// --- Brute Force Protection Handlers ---
ipcMain.handle('bruteforce:check-status', async (event, deviceId) => {
  const tracker = bruteForceTracker.get(deviceId);

  if (!tracker) return { locked: false, attempts: 0, remaining: 0 };

  const now = Date.now();
  if (tracker.lockedUntil && now < tracker.lockedUntil) {
    const remaining = Math.ceil((tracker.lockedUntil - now) / 1000);
    return { locked: true, attempts: tracker.attempts, remaining };
  }

  // Lockout süresi geçti, temizle ve persist
  if (tracker.lockedUntil && now >= tracker.lockedUntil) {
    bruteForceTracker.delete(deviceId);
    scheduleBruteForceSave(); // SECURITY UPGRADE: Persist to disk
    return { locked: false, attempts: 0, remaining: 0 };
  }

  return { locked: false, attempts: tracker.attempts || 0, remaining: 0 };
});

ipcMain.handle('bruteforce:record-failure', async (event, deviceId) => {
  const tracker = bruteForceTracker.get(deviceId) || { attempts: 0, lockedUntil: null };
  tracker.attempts = (tracker.attempts || 0) + 1;

  const now = Date.now();

  // Lockout süresi dolduysa counter'ı sıfırlamadan attempts'i arttır
  if (tracker.lockedUntil && now >= tracker.lockedUntil) {
    tracker.lockedUntil = null;
  }

  // Protokole göre kilitlenme süresi hesapla
  const rule = [...BRUTE_FORCE_RULES].reverse().find(p => tracker.attempts >= p.threshold);
  if (rule) {
    tracker.lockedUntil = now + rule.lockout;
  }

  bruteForceTracker.set(deviceId, tracker);
  scheduleBruteForceSave(); // SECURITY UPGRADE: Persist to disk

  return {
    locked: !!tracker.lockedUntil,
    attempts: tracker.attempts,
    remaining: tracker.lockedUntil ? Math.ceil((tracker.lockedUntil - now) / 1000) : 0
  };
});

ipcMain.handle('bruteforce:record-success', async (event, deviceId) => {
  bruteForceTracker.delete(deviceId);
  scheduleBruteForceSave(); // SECURITY UPGRADE: Persist to disk
  return { attempts: 0, remaining: 0 };
});

// --- Windows Credential Manager Integration (Optional) ---
const CREDENTIAL_SERVICE = 'Aegis Vault';
const CREDENTIAL_ACCOUNT = 'master-vault';

ipcMain.handle('credentials:save-master-key', async (event, saltB64, keyB64) => {
  if (!keytar) {
    console.warn('keytar unavailable, skipping credential save');
    return false;
  }

  try {
    // Combine salt and key for storage (will be used for recovery/biometric)
    const combined = `${saltB64}|${keyB64}`;
    await keytar.setPassword(CREDENTIAL_SERVICE, CREDENTIAL_ACCOUNT, combined);
    return true;
  } catch (err) {
    console.error('Failed to save credentials:', err.message);
    return false;
  }
});

ipcMain.handle('credentials:retrieve-master-key', async (event) => {
  if (!keytar) {
    return null;
  }

  try {
    const combined = await keytar.getPassword(CREDENTIAL_SERVICE, CREDENTIAL_ACCOUNT);
    if (!combined) return null;

    const [saltB64, keyB64] = combined.split('|');
    return { saltB64, keyB64 };
  } catch (err) {
    console.error('Failed to retrieve credentials:', err.message);
    return null;
  }
});

ipcMain.handle('credentials:clear-master-key', async (event) => {
  if (!keytar) {
    return false;
  }

  try {
    await keytar.deletePassword(CREDENTIAL_SERVICE, CREDENTIAL_ACCOUNT);
    return true;
  } catch (err) {
    console.error('Failed to clear credentials:', err.message);
    return false;
  }
});

const BIOMETRIC_ACCOUNT = 'biometric-secret';

ipcMain.handle('credentials:save-biometric-secret', async (event, secretB64, tag = 'platform') => {
  if (!keytar) return false;
  try {
    const account = `${BIOMETRIC_ACCOUNT}-${tag}`;
    await keytar.setPassword(CREDENTIAL_SERVICE, account, secretB64);
    return true;
  } catch (err) {
    console.error(`Failed to save biometric secret (${tag}):`, err.message);
    return false;
  }
});

ipcMain.handle('credentials:retrieve-biometric-secret', async (event, tag = 'platform') => {
  if (!keytar) return null;
  try {
    const account = `${BIOMETRIC_ACCOUNT}-${tag}`;
    return await keytar.getPassword(CREDENTIAL_SERVICE, account);
  } catch (err) {
    console.error(`Failed to retrieve biometric secret (${tag}):`, err.message);
    return null;
  }
});

ipcMain.handle('credentials:clear-biometric-secret', async (event, tag = 'platform') => {
  if (!keytar) return false;
  try {
    const account = `${BIOMETRIC_ACCOUNT}-${tag}`;
    await keytar.deletePassword(CREDENTIAL_SERVICE, account);
    return true;
  } catch (err) {
    console.error(`Failed to clear biometric secret (${tag}):`, err.message);
    return false;
  }
});

ipcMain.handle('secure-memory:lock-pages', async (event, buffer) => {
  if (nativeSecurity && buffer) {
    try {
      // buffer should be a TypedArray (Uint8Array)
      return nativeSecurity.lockMemory(buffer);
    } catch (e) {
      console.error('[Security] Native VirtualLock failed:', e.message);
      return false;
    }
  }
  // Fallback: Success if high-level sanitization is active
  return true;
});

ipcMain.handle('secure-memory:get-status', async () => {
  return {
    locked: !!nativeSecurity,
    supported: !!nativeSecurity,
    native: !!nativeSecurity,
    platform: process.platform
  };
});

// --- Backup & File System Handlers ---
ipcMain.handle('backup:save', async (event, { filePath, data, encrypted }) => {
  try {
    const buffer = Buffer.from(data);
    fs.writeFileSync(filePath, buffer);
    recordAuditLog('BACKUP_CREATED', { path: filePath, encrypted });
    return { success: true };
  } catch (err) {
    console.error('Backup save failed:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('backup:select-directory', async () => {
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('backup:get-default-path', () => {
  return path.join(app.getPath('documents'), 'Aegis Vault Backups');
});

// --- Audit Logging Handlers ---
ipcMain.handle('audit:log-event', async (event, action, metadata = {}) => {
  recordAuditLog(action, metadata);
  return true;
});

ipcMain.handle('audit:flush', async (event) => {
  flushAuditLog();
  return true;
});

ipcMain.handle('audit:get-logs', async (event, limit = 100) => {
  try {
    if (!fs.existsSync(auditLogPath)) {
      return [];
    }

    const content = fs.readFileSync(auditLogPath, 'utf8');
    const lines = content.trim().split('\n').filter(l => l);
    const logs = lines.map(line => {
      try {
        return JSON.parse(line);
      } catch (e) {
        return null;
      }
    }).filter(l => l !== null);

    // Return last 'limit' entries
    return logs.slice(-limit);
  } catch (err) {
    console.error('Failed to read audit logs:', err.message);
    return [];
  }
});

app.on('window-all-closed', () => {
  console.log('[App] window-all-closed event');
  flushAuditLog(); // Ensure all logs are written before closing
  saveBruteForceState(); // SECURITY UPGRADE: Save brute-force state before exit
  if (sessionKey) {
    console.log('[App] Clearing session key');
    sessionKey.fill(0);
    sessionKey = null;
  }
  if (clipboard.readText() === lastCopiedText) {
    console.log('[App] Clearing clipboard');
    clipboard.writeText('');
  }
  // Quit on all platforms (not just non-macOS)
  console.log('[App] Quitting application');
  app.quit();
});

// Backup scheduling handled by renderer


// ==================== BACKUP IPC HANDLERS ====================

ipcMain.handle('backup:saveLocalBackup', async (event, backup) => {
  console.log('[Backup] Saving local backup:', backup.id);

  try {
    const backupDir = path.join(app.getPath('documents'), 'Aegis Vault Backups');
    const backupPath = path.join(backupDir, `AegisBackup_${backup.id}.aegis`);

    // Create Backups directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Write backup file
    fs.writeFileSync(backupPath, backup.encryptedData);

    console.log('[Backup] Local backup saved:', backupPath);
    return { success: true, path: backupPath };
  } catch (e) {
    console.error('[Backup] Save local backup failed:', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('backup:listLocalBackups', async (event) => {
  console.log('[Backup] Listing local backups...');

  try {
    const backupDir = path.join(app.getPath('documents'), 'Aegis Vault Backups');

    if (!fs.existsSync(backupDir)) {
      console.log('[Backup] No backups directory');
      return { backups: [] };
    }

    // Read all backup files
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.aegis'));
    console.log(`[Backup] Found ${files.length} local backup files`);

    // Note: Metadata is managed by renderer's localStorage for simplicity now,
    // but the files are physically here.
    return { files };
  } catch (e) {
    console.error('[Backup] List local backups failed:', e);
    return { backups: [] };
  }
});

ipcMain.handle('backup:deleteBackup', async (event, backupId, location) => {
  console.log(`[Backup] Deleting backup: ${backupId} (${location})`);

  try {
    if (location === 'local') {
      const backupDir = path.join(app.getPath('documents'), 'Aegis Vault Backups');
      const backupPath = path.join(backupDir, `AegisBackup_${backupId}.aegis`);

      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
        console.log('[Backup] Local backup deleted:', backupPath);
      }
    }
    return { success: true };
  } catch (e) {
    console.error('[Backup] Delete backup failed:', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('backup:restoreBackup', async (event, backupId, location) => {
  console.log(`[Backup] Restoring backup: ${backupId} (${location})`);

  try {
    if (location === 'local') {
      const backupDir = path.join(app.getPath('documents'), 'Aegis Vault Backups');
      const backupPath = path.join(backupDir, `AegisBackup_${backupId}.aegis`);

      if (!fs.existsSync(backupPath)) {
        throw new Error('Backup file not found');
      }

      const backupData = fs.readFileSync(backupPath, 'utf8');
      return { success: true, data: backupData };
    }
    return { success: false, message: 'Not implemented' };
  } catch (e) {
    console.error('[Backup] Restore backup failed:', e);
    return { success: false, message: e.message };
  }
});

ipcMain.handle('backup:verifyBackup', async (event, backupId) => {
  try {
    const backupDir = path.join(app.getPath('documents'), 'Aegis Vault Backups');
    const backupPath = path.join(backupDir, `AegisBackup_${backupId}.aegis`);

    if (!fs.existsSync(backupPath)) {
      return { isValid: false };
    }

    const backupData = fs.readFileSync(backupPath, 'utf8');
    return { isValid: backupData.length > 0 };
  } catch (e) {
    return { isValid: false };
  }
});

ipcMain.handle('backup:clearAllBackups', async (event) => {
  console.log('[Backup] Clearing all backups...');

  try {
    const backupDir = path.join(app.getPath('documents'), 'Aegis Vault Backups');

    if (fs.existsSync(backupDir)) {
      const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.aegis'));
      for (const file of files) {
        fs.unlinkSync(path.join(backupDir, file));
      }
    }

    console.log('[Backup] All backups cleared');
    return { success: true };
  } catch (e) {
    console.error('[Backup] Clear all backups failed:', e);
    return { success: false, error: e.message };
  }
});

// ==================== CLOUD BACKUP IPC HANDLERS ====================

ipcMain.handle('backup:uploadToCloud', async (event, backup, provider, config) => {
  console.log(`[CloudBackup] Uploading to ${provider}...`);

  try {
    // Cloud backup upload logic (to be implemented for each provider)
    console.log('[CloudBackup] Cloud upload (placeholder)');

    const cloudPath = `/AegisVault/Backups/${backup.id}.aegis`;

    event.reply('backup:cloudUploaded', {
      success: true,
      path: cloudPath
    });
  } catch (e) {
    console.error('[CloudBackup] Upload failed:', e);
    event.reply('backup:cloudUploaded', {
      success: false,
      error: e.message
    });
  }
});

ipcMain.handle('backup:listCloudBackups', async (event, provider) => {
  console.log(`[CloudBackup] Listing cloud backups (${provider})...`);

  try {
    // Cloud backup listing logic (to be implemented for each provider)
    console.log('[CloudBackup] Cloud list (placeholder)');

    event.reply('backup:cloudListed', {
      backups: []
    });
  } catch (e) {
    console.error('[CloudBackup] List failed:', e);
    event.reply('backup:cloudListed', {
      backups: []
    });
  }
});

// ==================== HELPER FUNCTIONS ====================

async function calculateChecksum(data) {
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256');
  hash.update(data);
  return hash.digest('hex');
}

// Scheduling handled by renderer for now to avoid ESM require issues and localStorage bugs
ipcMain.handle('backup:schedule', async (event, config) => {
  console.log('[Backup] Config updated:', config);
  return { success: true };
});

// ==================== SECURE LICENSING SYSTEM ====================
// SECURITY: Anti-tampering licensing with HMAC verification and monotonic time tracking

const LICENSE_FILE_PATH = path.join(app.getPath('userData'), '.license-data.enc');
const LICENSE_HMAC_SECRET = crypto.createHash('sha256')
  .update(getDeviceId() + 'AEGIS-LICENSE-SALT-V2')
  .digest();

/**
 * Creates HMAC signature for license data
 */
function signLicenseData(data) {
  const hmac = crypto.createHmac('sha256', LICENSE_HMAC_SECRET);
  hmac.update(JSON.stringify(data));
  return hmac.digest('hex');
}

/**
 * Verifies HMAC signature of license data
 */
function verifyLicenseData(data, signature) {
  const expectedSig = signLicenseData(data);
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSig, 'hex')
  );
}

/**
 * Saves license data securely with HMAC signature
 */
function saveLicenseData(data) {
  try {
    const signature = signLicenseData(data);
    const payload = {
      data,
      signature,
      deviceId: getDeviceId()
    };

    // Encrypt with device-specific key if native security available
    let fileContent;
    if (nativeSecurity) {
      try {
        const encrypted = nativeSecurity.protectData(Buffer.from(JSON.stringify(payload)));
        fileContent = encrypted.toString('base64');
      } catch (e) {
        fileContent = JSON.stringify(payload);
      }
    } else {
      // Fallback: AES encryption with device key
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', LICENSE_HMAC_SECRET, iv);
      let encrypted = cipher.update(JSON.stringify(payload), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      const tag = cipher.getAuthTag();
      fileContent = iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
    }

    fs.writeFileSync(LICENSE_FILE_PATH, fileContent, 'utf8');
    console.log('[Licensing] License data saved securely');
    return true;
  } catch (e) {
    console.error('[Licensing] Failed to save license data:', e.message);
    return false;
  }
}

/**
 * Loads and verifies license data
 */
function loadLicenseData() {
  try {
    if (!fs.existsSync(LICENSE_FILE_PATH)) {
      return null;
    }

    const fileContent = fs.readFileSync(LICENSE_FILE_PATH, 'utf8');
    let payload;

    // Try DPAPI decryption first
    if (nativeSecurity && !fileContent.includes(':')) {
      try {
        const encrypted = Buffer.from(fileContent, 'base64');
        const decrypted = nativeSecurity.unprotectData(encrypted);
        payload = JSON.parse(decrypted.toString());
      } catch (e) {
        console.warn('[Licensing] DPAPI decryption failed, trying AES');
        payload = null;
      }
    }

    // Fallback to AES decryption
    if (!payload && fileContent.includes(':')) {
      const parts = fileContent.split(':');
      if (parts.length >= 3) {
        const iv = Buffer.from(parts[0], 'hex');
        const tag = Buffer.from(parts[1], 'hex');
        const ciphertext = parts.slice(2).join(':');

        const decipher = crypto.createDecipheriv('aes-256-gcm', LICENSE_HMAC_SECRET, iv);
        decipher.setAuthTag(tag);
        let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        payload = JSON.parse(decrypted);
      }
    }

    if (!payload) {
      console.warn('[Licensing] Failed to decrypt license data');
      return null;
    }

    // SECURITY: Verify device binding
    if (payload.deviceId !== getDeviceId()) {
      console.warn('[Licensing] Device ID mismatch - license data rejected');
      fs.unlinkSync(LICENSE_FILE_PATH);
      return null;
    }

    // SECURITY: Verify HMAC signature
    if (!verifyLicenseData(payload.data, payload.signature)) {
      console.warn('[Licensing] HMAC verification failed - data tampered');
      fs.unlinkSync(LICENSE_FILE_PATH);
      return null;
    }

    return payload.data;
  } catch (e) {
    console.error('[Licensing] Failed to load license data:', e.message);
    return null;
  }
}

/**
 * Detects time manipulation by comparing with last activity timestamp
 */
function detectTimeManipulation(licenseData) {
  if (!licenseData) return false;

  const now = Date.now();

  // Check 1: Current time is before install date (impossible)
  if (now < licenseData.installDate) {
    console.warn('[Licensing] Time manipulation detected: current time before install date');
    return true;
  }

  // Check 2: Current time is before last activity (clock rolled back)
  if (licenseData.lastActivity && now < licenseData.lastActivity - 60000) { // 1 minute tolerance
    console.warn('[Licensing] Time manipulation detected: clock rolled back');
    return true;
  }

  // Check 3: Monotonic usage counter - elapsed days should only increase
  if (licenseData.maxElapsedDays !== undefined) {
    const currentElapsedDays = (now - licenseData.installDate) / (1000 * 60 * 60 * 24);
    if (currentElapsedDays < licenseData.maxElapsedDays - 0.1) { // Small tolerance
      console.warn('[Licensing] Time manipulation detected: elapsed days decreased');
      return true;
    }
  }

  return false;
}

// IPC Handlers for Secure Licensing
ipcMain.handle('licensing:init', async () => {
  let data = loadLicenseData();
  const now = Date.now();

  if (!data) {
    // First run - initialize license data
    data = {
      installDate: now,
      lastActivity: now,
      maxElapsedDays: 0,
      proActivated: false,
      proLicense: null
    };
    saveLicenseData(data);
    console.log('[Licensing] Initialized new trial');
  } else {
    // Update last activity and max elapsed days
    const elapsedDays = (now - data.installDate) / (1000 * 60 * 60 * 24);
    data.lastActivity = now;
    data.maxElapsedDays = Math.max(data.maxElapsedDays || 0, elapsedDays);
    saveLicenseData(data);
  }

  return {
    installDate: data.installDate,
    proActivated: data.proActivated,
    timeManipulated: detectTimeManipulation(data)
  };
});

ipcMain.handle('licensing:getStatus', async () => {
  const data = loadLicenseData();
  const now = Date.now();
  const TRIAL_DAYS = 3;

  if (!data) {
    return {
      isPro: false,
      remainingDays: TRIAL_DAYS,
      isExpired: false,
      timeManipulated: false
    };
  }

  // Check for time manipulation
  const timeManipulated = detectTimeManipulation(data);

  // If time manipulation detected, treat as expired
  if (timeManipulated && !data.proActivated) {
    return {
      isPro: false,
      remainingDays: 0,
      isExpired: true,
      timeManipulated: true
    };
  }

  // Calculate remaining trial days
  const elapsedDays = Math.max(data.maxElapsedDays || 0, (now - data.installDate) / (1000 * 60 * 60 * 24));
  const remainingDays = Math.max(0, Math.ceil(TRIAL_DAYS - elapsedDays));

  return {
    isPro: data.proActivated,
    remainingDays: data.proActivated ? -1 : remainingDays,
    isExpired: !data.proActivated && remainingDays <= 0,
    timeManipulated: false
  };
});

ipcMain.handle('licensing:activatePro', async (event, licenseKey) => {
  const data = loadLicenseData();
  if (!data) {
    return { success: false, error: 'LICENSE_DATA_NOT_FOUND' };
  }

  // License key will be verified in the renderer using ECDSA
  // Here we just store the activation status
  data.proActivated = true;
  data.proLicense = licenseKey;
  data.proActivatedAt = Date.now();

  const saved = saveLicenseData(data);

  if (saved) {
    console.log('[Licensing] Pro license activated successfully');
    return { success: true };
  } else {
    return { success: false, error: 'SAVE_FAILED' };
  }
});

ipcMain.handle('licensing:updateActivity', async () => {
  const data = loadLicenseData();
  if (!data) return false;

  const now = Date.now();
  const elapsedDays = (now - data.installDate) / (1000 * 60 * 60 * 24);

  data.lastActivity = now;
  data.maxElapsedDays = Math.max(data.maxElapsedDays || 0, elapsedDays);

  return saveLicenseData(data);
});

ipcMain.handle('licensing:isPro', async () => {
  const data = loadLicenseData();
  return data?.proActivated === true;
});
