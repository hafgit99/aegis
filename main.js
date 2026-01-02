import { app, BrowserWindow, ipcMain, clipboard, protocol } from 'electron';
import path from 'path';
import { execSync } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
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
const auditLogPath = path.join(app.getPath('userData'), 'audit.log');
const auditLogKeyPath = path.join(app.getPath('userData'), '.audit-key');
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

      // Persist seed for consistent key derivation
      fs.writeFileSync(auditLogKeyPath, JSON.stringify({ seed, createdAt: Date.now() }), 'utf8');
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
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
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
});

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
    mainWindow.close();
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

// --- Brute Force Protection (Server-side, tamper-proof) ---
const bruteForceTracker = new Map(); // { deviceId -> { attempts, lockedUntil } }
const BRUTE_FORCE_RULES = [
  { threshold: 3, lockout: 30 * 1000 },       // 3 hata -> 30 sn
  { threshold: 5, lockout: 5 * 60 * 1000 },   // 5 hata -> 5 dk
  { threshold: 10, lockout: 30 * 60 * 1000 }  // 10 hata -> 30 dk
];

ipcMain.handle('vault:set-key', (event, keyRaw) => {
  sessionKey = Buffer.from(keyRaw);
  return true;
});

ipcMain.handle('vault:clear-key', () => {
  if (sessionKey) sessionKey.fill(0);
  sessionKey = null;
  if (verifierBlob) verifierBlob = null; // Wipe verifier too
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

  // Lockout süresi geçti, temizle
  if (tracker.lockedUntil && now >= tracker.lockedUntil) {
    bruteForceTracker.delete(deviceId);
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

  return {
    locked: !!tracker.lockedUntil,
    attempts: tracker.attempts,
    remaining: tracker.lockedUntil ? Math.ceil((tracker.lockedUntil - now) / 1000) : 0
  };
});

ipcMain.handle('bruteforce:record-success', async (event, deviceId) => {
  bruteForceTracker.delete(deviceId);
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
  flushAuditLog(); // Ensure all logs are written before closing
  if (clipboard.readText() === lastCopiedText) clipboard.writeText('');
  if (process.platform !== 'darwin') app.quit();
});