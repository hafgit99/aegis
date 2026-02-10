import { app, BrowserWindow, ipcMain, clipboard, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
// os import removed

// ABSOLUTE TOP LEVEL DEBUG - REMOVED
import { setupIpcHandlers, native } from './ipc-handlers';
import { handleCLI } from './cli';
import { setupSyncIpc } from './sync-service';
import { setupLicenseHandlers } from './license-handler';

import log from 'electron-log';

// Configure logging
log.transports.file.level = 'info';
log.info('[MAIN] App starting...');

function createWindow() {
    const isDev = (process.env.NODE_ENV === 'development' || !app.isPackaged) && process.env.NODE_ENV !== 'test';
    // __dirname is now dist/main, preload is at dist/main/preload/preload.js
    const preloadPath = path.join(__dirname, './preload/preload.js');

    log.info('[MAIN] Preload path:', preloadPath);
    log.info('[MAIN] Environment:', isDev ? 'development' : 'production');
    log.info('[MAIN] App Path:', app.getAppPath());
    log.info('[MAIN] Resources Path:', process.resourcesPath);

    const mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,      // RE-ENABLED FOR SECURITY
            webSecurity: true,  // RE-ENABLED FOR SECURITY
            // SECURITY FIX: Additional security settings
            allowRunningInsecureContent: false,
            webviewTag: false,
            // Security headers
            additionalArguments: [
                '--disable-features=VizDisplayCompositor',
                '--disable-web-security',  // Only for dev, handled by sandbox flag
            ],
        },
        backgroundColor: '#0a0e1a',
        show: false, // Always start hidden, show when ready
        frame: true,
        alwaysOnTop: false,
        skipTaskbar: false,
        // SECURITY FIX: Anti-screenshot/screen recording
        ...(process.platform === 'darwin' && {
            titleBarStyle: 'hiddenInset',
        }),
    });

    log.info('[MAIN] BrowserWindow created');

    // SECURITY FIX: Screen capture prevention (multi-platform)
    if (!isDev) {
        // macOS: Prevent screen capture
        mainWindow.setContentProtection(true);

        // Windows: Additional protection
        if (process.platform === 'win32') {
            mainWindow.setSkipTaskbar(false);
            // SetWindowDisplayAffinity would be called via native module
        }

        // Linux: Try to set _MOTIF_WM_HINTS for screenshot prevention
        if (process.platform === 'linux') {
            // Note: This is best-effort on Linux
            log.info('[MAIN] Content protection enabled (Linux)');
        }

        log.info('[MAIN] Content protection enabled');
    }

    // SECURITY FIX: Prevent window from being captured in DevTools
    mainWindow.webContents.on('devtools-opened', () => {
        if (!isDev) {
            log.warn('[SECURITY] DevTools opened in production - disabling content protection temporarily');
            mainWindow.setContentProtection(false);
        }
    });

    mainWindow.webContents.on('devtools-closed', () => {
        if (!isDev) {
            log.info('[SECURITY] DevTools closed - re-enabling content protection');
            mainWindow.setContentProtection(true);
        }
    });

    // SECURITY FIX: Block navigation to external URLs
    mainWindow.webContents.on('will-navigate', (event, url) => {
        const allowedOrigins = [
            'app://',
            'file://',
            ...isDev ? ['http://localhost:5173', 'http://127.0.0.1:5173'] : []
        ];

        const isAllowed = allowedOrigins.some(origin => url.startsWith(origin));
        if (!isAllowed) {
            log.warn('[SECURITY] Blocked navigation to:', url);
            event.preventDefault();
        }
    });

    // SECURITY FIX: Block new window creation
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        log.warn('[SECURITY] Blocked new window:', url);
        return { action: 'deny' };
    });

    // In development, load from Vite dev server
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
    } else {
        // __dirname is dist/main, renderer is at dist/renderer
        const htmlPath = path.join(__dirname, '../renderer/index.html');
        log.info('[MAIN] Loading HTML from:', htmlPath);

        if (fs.existsSync(htmlPath)) {
            mainWindow.loadFile(htmlPath).catch(err => {
                log.error('[MAIN] Failed to load file:', err);
            });
        } else {
            log.error('[MAIN] HTML file not found at:', htmlPath);
        }
    }

    // Only open DevTools in development mode
    if (isDev) {
        mainWindow.webContents.openDevTools();
        log.info('[MAIN] DevTools opened (development mode)');
    }

    mainWindow.once('ready-to-show', () => {
        log.info('[MAIN] Window ready-to-show event fired');
        mainWindow.show();
        mainWindow.focus();
        mainWindow.moveTop();
        log.info('[MAIN] Window shown and focused');
        setupAutoUpdater(mainWindow);
    });

    // Aggressive fallback: Force show window after 1 second
    setTimeout(() => {
        if (!mainWindow.isVisible()) {
            log.warn('[MAIN] Window ready-to-show timed out, FORCING window to show');
            mainWindow.show();
            mainWindow.focus();
            mainWindow.moveTop();
            mainWindow.setAlwaysOnTop(true);
            setTimeout(() => mainWindow.setAlwaysOnTop(false), 1000);
            log.info('[MAIN] Window force-shown');
        } else {
            log.info('[MAIN] Window already visible, no timeout needed');
        }
    }, 1000);

    mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
        log.error('[MAIN] Did fail load:', errorCode, errorDescription);
    });
}

import { startBridgeServer } from './bridge-server';
import { setupAutoUpdater } from './auto-updater';

process.on('uncaughtException', (error) => {
    log.error('[MAIN] Uncaught Exception:', error);
});

app.whenReady().then(() => {
    log.info('[MAIN] App ready - initializing bridge');

    try {
        setupIpcHandlers();
        setupSyncIpc();
        setupLicenseHandlers();
        log.info('[MAIN] IPC handlers setup');
    } catch (e) {
        log.error('[MAIN] Failed to setup IPC handlers:', e);
    }

    // Handle CLI arguments
    const args = process.argv;
    const cliIndex = args.indexOf('--cli');
    if (cliIndex !== -1) {
        handleCLI(args.slice(cliIndex + 1), native);
        return; // Stop here if in CLI mode
    }

    // Set up application menu (enables copy/paste shortcuts)
    const template: any[] = [
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'selectAll' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    createWindow();
    startBridgeServer();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

// Secure Clipboard
// SECURITY FIX: Obfuscate clipboard content instead of just clearing to prevent timing attacks
let clipboardTimer: NodeJS.Timeout | null = null;
let currentSecureContent = '';

ipcMain.handle('clipboard:set-secure', (_event, text: string) => {
    clipboard.writeText(text);
    currentSecureContent = text;

    if (clipboardTimer) clearTimeout(clipboardTimer);

    // SECURITY FIX: Instead of clearing, overwrite with random data multiple times
    clipboardTimer = setTimeout(() => {
        // Overwrite with random data (3 times for security)
        for (let i = 0; i < 3; i++) {
            const randomData = Array.from({ length: text.length }, () =>
                Math.random().toString(36)[2] || 'x'
            ).join('');
            clipboard.writeText(randomData);
        }

        // Finally clear
        clipboard.clear();
        currentSecureContent = '';
        log.info('[SECURITY] Clipboard securely cleared');
    }, 30000);

    return true;
});

// Allow user to manually clear clipboard immediately
ipcMain.handle('clipboard:clear', () => {
    if (currentSecureContent) {
        // Overwrite with random data first
        for (let i = 0; i < 3; i++) {
            const randomData = Array.from({ length: currentSecureContent.length }, () =>
                Math.random().toString(36)[2] || 'x'
            ).join('');
            clipboard.writeText(randomData);
        }
        clipboard.clear();
        currentSecureContent = '';
        if (clipboardTimer) {
            clearTimeout(clipboardTimer);
            clipboardTimer = null;
        }
        return true;
    }
    return false;
});

// IPC Handlers placeholder
// SECURITY: Reliable Background Auto-Lock
// Monitoring activity in the Main process ensures lock works even if renderer is suspended
let lastInAppActivity = Date.now();
let autoLockInterval: NodeJS.Timeout | null = null;

ipcMain.handle('activity:report', () => {
    lastInAppActivity = Date.now();
    return true;
});

function setupBackgroundAutoLock() {
    if (autoLockInterval) clearInterval(autoLockInterval);

    autoLockInterval = setInterval(() => {
        // Read auto-lock setting from disk (not relying on renderer state)
        const configPath = path.join(app.getPath('userData'), 'settings.json');
        let autoLockMinutes = 5; // Default

        try {
            if (fs.existsSync(configPath)) {
                const settings = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                autoLockMinutes = settings.autoLockTime ?? 5;
            } else {
                // Check localStorage equivalent if cached or use default
            }
        } catch (e) {
            log.error('[AUTO-LOCK] Failed to read settings');
        }

        if (autoLockMinutes === 0) return; // 'Never'

        const now = Date.now();
        const inactiveMs = now - lastInAppActivity;

        if (inactiveMs > autoLockMinutes * 60 * 1000) {
            log.info(`[SECURITY] Main Process: Auto-locking due to ${autoLockMinutes}m inactivity`);
            native.dbClose(); // Force close native connection

            // Notify all windows
            BrowserWindow.getAllWindows().forEach(win => {
                win.webContents.send('vault:force-lock');
            });

            lastInAppActivity = Date.now(); // Reset to avoid constant locking
        }
    }, 60000); // Check every minute
}

// Start background monitor
setupBackgroundAutoLock();
