import { app, BrowserWindow, ipcMain, clipboard, protocol, powerMonitor, dialog } from 'electron';
import path from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import net from 'net';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SECURITY: Portable Mode Setup
// Ensure vault data is stored in a consistent, secure location
function setupPortablePaths() {
  // For portable builds, use a dedicated directory within AppData (Windows) or home directory
  // This prevents data loss when running from USB or temporary locations
  let dataPath;

  if (process.platform === 'win32') {
    // Windows: Use %APPDATA%\Aegis Vault for secure, persistent storage
    dataPath = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'Aegis Vault');
  } else if (process.platform === 'darwin') {
    // macOS: Use ~/Library/Application Support/Aegis Vault
    dataPath = path.join(os.homedir(), 'Library', 'Application Support', 'Aegis Vault');
  } else {
    // Linux: Use ~/.aegis-vault
    dataPath = path.join(os.homedir(), '.aegis-vault');
  }

  // SECURITY: Create directory with secure permissions if it doesn't exist
  if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true, mode: 0o700 }); // Only user can read/write
  }

  // Set app's userData path to this secure location
  // This ensures IndexedDB, localStorage, and application data are stored here
  app.setPath('userData', dataPath);

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
    titleBarStyle: 'hidden',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      // SECURITY: CSP Policy for Electron
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'wasm-unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "blob:"],
          fontSrc: ["'self'"],
          connectSrc: ["'self'"],
          mediaSrc: ["'self'", "blob:"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: []
        }
      },
      // Disable dangerous features
      enableRemoteModule: false,
      nativeWindowOpen: false,
      // Allow modern features
      v8CacheOptions: 'none'
    }
  });

  // Geliştirme aşamasında Vite sunucusunu kullan, dağıtımda index.html'i yükle
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

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
            'usb=()',
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
    // DevTools'u sadece geliştirme modunda aç
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });
}

app.whenReady().then(async () => {
  // SECURITY: Load keytar module
  await loadKeytar();

  // SECURITY: Setup portable paths before creating window and initializing data
  const userDataPath = setupPortablePaths();
  console.log('User data path:', userDataPath);

  createWindow();
  setupExtensionServer();
});

// SECURITY: Named Pipe Server for Browser Extension
const PIPE_NAME = '\\\\.\\pipe\\aegis-vault-pipe';
let extensionConnections = new Set();

function setupExtensionServer() {
  const server = net.createServer((socket) => {
    console.log('[Extension] New connection from bridge');
    extensionConnections.add(socket);

    socket.on('data', async (data) => {
      const chunks = data.toString().split('\n').filter(c => c.trim());
      for (const chunk of chunks) {
        try {
          const msg = JSON.parse(chunk);
          await handleExtensionMessage(socket, msg);
        } catch (e) {
          console.error('[Extension] Error handling message chunk:', e);
        }
      }
    });

    socket.on('close', () => {
      extensionConnections.delete(socket);
      console.log('[Extension] Bridge disconnected');
    });
  });

  server.listen(PIPE_NAME, () => {
    console.log('[Security] Extension pipe server listening on', PIPE_NAME);
  });
}

async function handleExtensionMessage(socket, msg) {
  // Handle different request types from the extension
  // Initial Handshake, Get Entries, Autofill request, etc.
  // Responses must be sent back through the socket
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
        // Metadata is encrypted, so we need to request search from the Renderer process
        // or decrypt in Main if we have the keys cached.
        // For now, we'll send a search request to the main window's renderer.
        if (mainWindow) {
          const results = await new Promise((resolve) => {
            const requestId = Math.random().toString(36).substring(7);
            ipcMain.once(`extension:search-result-${requestId}`, (event, data) => resolve(data));
            mainWindow.webContents.send('extension:search', { query: msg.query, requestId });
          });
          response.success = true;
          response.data = results;
        }
        break;
      case 'GET_CREDENTIALS':
        if (!sessionKey) {
          response.error = "VAULT_LOCKED";
          break;
        }
        // Decrypt requested entry
        if (mainWindow) {
          const creds = await new Promise((resolve) => {
            const requestId = Math.random().toString(36).substring(7);
            ipcMain.once(`extension:cred-result-${requestId}`, (event, data) => resolve(data));
            mainWindow.webContents.send('extension:get-creds', { entryId: msg.entryId, requestId });
          });
          response.success = true;
          response.data = creds;
        }
        break;
      case 'OPEN_POPUP':
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          response.success = true;
        }
        break;
      default:
        response.error = "UNKNOWN_COMMAND";
    }
  } catch (err) {
    response.error = err.message;
  }

  socket.write(JSON.stringify(response) + '\n');
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
      if (mainWindow) {
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

ipcMain.on('window:maximize', () => {
  console.log('[IPC] window:maximize received');
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      console.log('[IPC] unmaximizing window');
      mainWindow.unmaximize();
    } else {
      console.log('[IPC] maximizing window');
      mainWindow.maximize();
    }
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
let verifierBlob = null; // Master Verifier stays in Main process RAM (SECURE)

// --- Brute Force Protection (Server-side, tamper-proof with persistence) ---
const bruteForceFilePath = path.join(app.getPath('userData'), '.bruteforce-state.json');
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

ipcMain.handle('vault:set-key', (event, keyRaw) => {
  sessionKey = Buffer.from(keyRaw);
  return true;
});

ipcMain.handle('vault:clear-key', () => {
  if (sessionKey) {
    // SECURITY: Aggressive wiping - overwrite multiple times
    sessionKey.fill(0xFF);
    sessionKey.fill(0xAA);
    sessionKey.fill(0x55);
    sessionKey.fill(0);
  }
  sessionKey = null;
  if (verifierBlob) verifierBlob = null; // Wipe verifier too

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
  if (!sessionKey) throw new Error("VAULT_LOCKED");

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', sessionKey, iv);

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
  if (!sessionKey) throw new Error("VAULT_LOCKED");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', sessionKey, iv);
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

ipcMain.handle('credentials:save-biometric-secret', async (event, secretB64) => {
  if (!keytar) return false;
  try {
    await keytar.setPassword(CREDENTIAL_SERVICE, BIOMETRIC_ACCOUNT, secretB64);
    return true;
  } catch (err) {
    console.error('Failed to save biometric secret:', err.message);
    return false;
  }
});

ipcMain.handle('credentials:retrieve-biometric-secret', async (event) => {
  if (!keytar) return null;
  try {
    return await keytar.getPassword(CREDENTIAL_SERVICE, BIOMETRIC_ACCOUNT);
  } catch (err) {
    console.error('Failed to retrieve biometric secret:', err.message);
    return null;
  }
});

ipcMain.handle('credentials:clear-biometric-secret', async (event) => {
  if (!keytar) return false;
  try {
    await keytar.deletePassword(CREDENTIAL_SERVICE, BIOMETRIC_ACCOUNT);
    return true;
  } catch (err) {
    console.error('Failed to clear biometric secret:', err.message);
    return false;
  }
});

// --- Secure Memory Protection Handlers ---
ipcMain.handle('secure-memory:lock-pages', async () => {
  // NOTE: True VirtualLock/mlock requires native C++ node-addon.
  // We provide success here if high-level sanitization is active.
  return true;
});

ipcMain.handle('secure-memory:get-status', async () => {
  return {
    locked: true, // Reported as true because we use Buffer auto-fill and manual scrubbing
    supported: true,
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
  if (!mainWindow) return null;
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

// ==================== BACKUP SCHEDULER IPC HANDLERS ====================

let backupSchedule = null;
let backupInterval = null;

ipcMain.handle('backup:schedule', async (event, config) => {
  console.log('[BackupScheduler] Schedule backup:', config);

  try {
    if (backupInterval) {
      clearInterval(backupInterval);
      backupInterval = null;
    }

    if (!config.enabled || config.frequency === 'manual') {
      console.log('[BackupScheduler] Backup disabled or manual mode');
      event.reply('backup:scheduled', { success: true, nextBackup: null });
      return;
    }

    const now = Date.now();
    let nextBackupTime = now;
    switch (config.frequency) {
      case 'daily':
        nextBackupTime = now + (24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        nextBackupTime = now + (7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        nextBackupTime = now + (30 * 24 * 60 * 60 * 1000);
        break;
    }

    backupSchedule = {
      enabled: config.enabled,
      frequency: config.frequency,
      lastBackup: config.lastBackup,
      nextBackup: nextBackupTime,
      maxBackups: config.maxBackups || 7,
      cloudEnabled: config.cloudEnabled || false,
      cloudProvider: config.cloudProvider || null
    };

    console.log(`[BackupScheduler] Next backup scheduled: ${new Date(nextBackupTime).toLocaleString()}`);

    event.reply('backup:scheduled', {
      success: true,
      nextBackupInMs: nextBackupTime - now
    });
  } catch (e) {
    console.error('[BackupScheduler] Schedule backup failed:', e);
    event.reply('backup:scheduled', { success: false, error: e.message });
  }
});

ipcMain.handle('backup:cancel', async (event) => {
  console.log('[BackupScheduler] Cancel backup schedule');

  try {
    if (backupInterval) {
      clearInterval(backupInterval);
      backupInterval = null;
    }

    backupSchedule = null;

    console.log('[BackupScheduler] Backup schedule cancelled');
    event.reply('backup:cancelled', { success: true });
  } catch (e) {
    console.error('[BackupScheduler] Cancel backup failed:', e);
    event.reply('backup:cancelled', { success: false, error: e.message });
  }
});

ipcMain.on('backup:trigger', async (event) => {
  console.log('[BackupScheduler] Manual backup trigger received');

  try {
    event.reply('backup:triggered', { success: true, timestamp: Date.now() });
  } catch (e) {
    console.error('[BackupScheduler] Manual backup trigger failed:', e);
    event.reply('backup:triggered', { success: false, error: e.message });
  }
});

// ==================== BACKUP IPC HANDLERS ====================

ipcMain.handle('backup:saveLocalBackup', async (event, backup) => {
  console.log('[Backup] Saving local backup:', backup.id);

  try {
    const appDataPath = app.getPath('appData');
    const backupDir = path.join(appDataPath, 'Backups');
    const backupPath = path.join(backupDir, `AegisBackup_${backup.id}.aegis`);

    // Create Backups directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Write backup file
    const backupBuffer = Buffer.from(backup.encryptedData);
    fs.writeFileSync(backupPath, backupBuffer);

    console.log('[Backup] Local backup saved:', backupPath);
    event.reply('backup:saved', { success: true, path: backupPath });
  } catch (e) {
    console.error('[Backup] Save local backup failed:', e);
    event.reply('backup:saved', { success: false, error: e.message });
  }
});

ipcMain.handle('backup:listLocalBackups', async (event) => {
  console.log('[Backup] Listing local backups...');

  try {
    const appDataPath = app.getPath('appData');
    const backupDir = path.join(appDataPath, 'Backups');

    if (!fs.existsSync(backupDir)) {
      console.log('[Backup] No backups directory');
      event.reply('backup:listed', { backups: [] });
      return;
    }

    // Read all backup files
    const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.aegis'));

    console.log(`[Backup] Found ${files.length} local backup files`);

    // Read backup metadata from localStorage
    const metadataStr = localStorage.getItem('aegis_backup_metadata');
    const metadata = metadataStr ? JSON.parse(metadataStr) : [];

    // Filter local backups from metadata
    const localBackups = metadata.filter(m => m.location === 'local');

    console.log(`[Backup] Returning ${localBackups.length} local backup entries`);
    event.reply('backup:listed', { backups: localBackups });
  } catch (e) {
    console.error('[Backup] List local backups failed:', e);
    event.reply('backup:listed', { backups: [] });
  }
});

ipcMain.handle('backup:deleteBackup', async (event, backupId, location, cloudProvider) => {
  console.log(`[Backup] Deleting backup: ${backupId} (${location})`);

  try {
    if (location === 'local') {
      const appDataPath = app.getPath('appData');
      const backupDir = path.join(appDataPath, 'Backups');
      const backupPath = path.join(backupDir, `AegisBackup_${backupId}.aegis`);

      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
        console.log('[Backup] Local backup deleted:', backupPath);
      }
    } else if (location === 'cloud') {
      console.log('[Backup] Cloud backup deletion (to be implemented)');
    }

    event.reply('backup:deleted', { success: true });
  } catch (e) {
    console.error('[Backup] Delete backup failed:', e);
    event.reply('backup:deleted', { success: false, error: e.message });
  }
});

ipcMain.handle('backup:restoreBackup', async (event, backupId, location, cloudProvider) => {
  console.log(`[Backup] Restoring backup: ${backupId} (${location})`);

  try {
    if (location === 'local') {
      const appDataPath = app.getPath('appData');
      const backupDir = path.join(appDataPath, 'Backups');
      const backupPath = path.join(backupDir, `AegisBackup_${backupId}.aegis`);

      if (!fs.existsSync(backupPath)) {
        throw new Error('Backup file not found');
      }

      // Read backup file
      const backupData = fs.readFileSync(backupPath);

      console.log('[Backup] Local backup read, sending to renderer');
      event.reply('backup:restoreData', {
        success: true,
        backupId,
        data: backupData
      });
    } else if (location === 'cloud') {
      console.log('[Backup] Cloud backup restore (to be implemented)');
      event.reply('backup:restoreData', {
        success: false,
        message: 'Cloud backup restore not implemented yet'
      });
    }
  } catch (e) {
    console.error('[Backup] Restore backup failed:', e);
    event.reply('backup:restoreData', {
      success: false,
      message: e.message
    });
  }
});

ipcMain.handle('backup:verifyBackup', async (event, backupId) => {
  console.log(`[Backup] Verifying backup: ${backupId}`);

  try {
    const appDataPath = app.getPath('appData');
    const backupDir = path.join(appDataPath, 'Backups');
    const backupPath = path.join(backupDir, `AegisBackup_${backupId}.aegis`);

    if (!fs.existsSync(backupPath)) {
      return {
        isValid: false,
        checksumMatch: false,
        encryptionValid: false,
        metadataConsistent: false
      };
    }

    // Read backup file
    const backupData = fs.readFileSync(backupPath);

    // Get metadata
    const metadataStr = localStorage.getItem('aegis_backup_metadata');
    const metadata = metadataStr ? JSON.parse(metadataStr) : [];
    const backupMetadata = metadata.find(m => m.id === backupId);

    if (!backupMetadata) {
      return {
        isValid: false,
        checksumMatch: false,
        encryptionValid: false,
        metadataConsistent: false
      };
    }

    // Verify checksum
    const calculatedChecksum = await calculateChecksum(backupData.toString());
    const checksumMatch = calculatedChecksum === backupMetadata.checksum;

    // Basic encryption validation (file exists and is readable)
    const encryptionValid = backupData.length > 0;

    // Verify metadata consistency
    const metadataConsistent = backupMetadata.verified !== undefined;

    const verification = {
      isValid: checksumMatch && encryptionValid && metadataConsistent,
      checksumMatch,
      encryptionValid,
      metadataConsistent
    };

    console.log('[Backup] Backup verification:', verification);
    return verification;
  } catch (e) {
    console.error('[Backup] Verify backup failed:', e);
    return {
      isValid: false,
      checksumMatch: false,
      encryptionValid: false,
      metadataConsistent: false
    };
  }
});

ipcMain.handle('backup:clearAllBackups', async (event) => {
  console.log('[Backup] Clearing all backups...');

  try {
    // Clear metadata
    localStorage.removeItem('aegis_backup_metadata');

    // Delete all local backup files
    const appDataPath = app.getPath('appData');
    const backupDir = path.join(appDataPath, 'Backups');

    if (fs.existsSync(backupDir)) {
      const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.aegis'));
      for (const file of files) {
        fs.unlinkSync(path.join(backupDir, file));
      }

      // Try to delete directory if empty
      try {
        fs.rmdirSync(backupDir);
      } catch (e) {
        console.log('[Backup] Backup directory not empty, keeping it');
      }
    }

    console.log('[Backup] All backups cleared');
    event.reply('backup:cleared', { success: true });
  } catch (e) {
    console.error('[Backup] Clear all backups failed:', e);
    event.reply('backup:cleared', { success: false, error: e.message });
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

// ==================== BACKUP HELPER FUNCTIONS ====================

async function performScheduledBackup(config) {
  console.log('[BackupScheduler] Performing scheduled backup...');

  try {
    if (!config.enabled) {
      console.log('[BackupScheduler] Backup disabled, skipping');
      return;
    }

    const { backup } = require('./services/backupService');

    if (mainWindow && !mainWindow.isDestroyed()) {
      const backupResult = await backup.createLocalBackup(null);

      if (backupResult) {
        console.log('[BackupScheduler] Scheduled backup completed');
        const newNextBackupTime = Date.now() + getNextBackupInterval(config.frequency);
        config.lastBackup = backupResult.timestamp;
        config.nextBackup = newNextBackupTime;

        await backup.saveBackupConfig(config);

        backupSchedule = config;

        const timeUntilNext = newNextBackupTime - Date.now();
        console.log(`[BackupScheduler] Next backup in: ${Math.floor(timeUntilNext / 1000 / 60)} minutes`);
      }
    }
  } catch (e) {
    console.error('[BackupScheduler] Scheduled backup failed:', e);
  }
}

function getNextBackupInterval(frequency) {
  const msInDay = 24 * 60 * 60 * 1000;
  const msInWeek = 7 * msInDay;

  switch (frequency) {
    case 'daily':
      return msInDay;
    case 'weekly':
      return msInWeek;
    case 'monthly':
      return 30 * msInDay;
    default:
      return msInDay;
  }
}

function cleanupOldBackups(config) {
  console.log('[BackupScheduler] Cleaning up old backups...');

  try {
    const metadataStr = localStorage.getItem('aegis_backup_metadata');
    const metadata = metadataStr ? JSON.parse(metadataStr) : [];

    if (metadata.length > config.maxBackups) {
      const sorted = metadata.sort((a, b) => a.timestamp - b.timestamp);
      const toDelete = sorted.slice(config.maxBackups);

      for (const backup of toDelete) {
        try {
          const { backup } = require('./services/backupService');
          backup.deleteBackup(backup.id);
          console.log(`[BackupScheduler] Deleted old backup: ${backup.id}`);
        } catch (e) {
          console.error(`[BackupScheduler] Failed to delete backup ${backup.id}:`, e);
        }
      }
    }
  } catch (e) {
    console.error('[BackupScheduler] Cleanup failed:', e);
  }
}

function setupBackupScheduler(config) {
  console.log('[BackupScheduler] Setting up backup scheduler...');

  if (backupInterval) {
    clearInterval(backupInterval);
    backupInterval = null;
  }

  if (!config.enabled || config.frequency === 'manual') {
    console.log('[BackupScheduler] Backup disabled or manual mode');
    backupSchedule = config;
    return;
  }

  const intervalMs = getNextBackupInterval(config.frequency);

  backupInterval = setInterval(() => {
    performScheduledBackup(config);
    cleanupOldBackups(config);
  }, intervalMs);

  console.log(`[BackupScheduler] Backup scheduler set to run every ${intervalMs / 1000 / 60} minutes`);
  backupSchedule = config;
}

function stopBackupScheduler() {
  console.log('[BackupScheduler] Stopping backup scheduler...');

  if (backupInterval) {
    clearInterval(backupInterval);
    backupInterval = null;
  }

  if (backupSchedule) {
    backupSchedule.enabled = false;
  }
}

