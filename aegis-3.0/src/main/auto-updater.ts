import { autoUpdater } from 'electron-updater';
import { ipcMain, BrowserWindow } from 'electron';
import log from 'electron-log';

let updateWindow: BrowserWindow | null = null;
let initialized = false;

export function setupAutoUpdater(window: BrowserWindow) {
    updateWindow = window;

    if (initialized) return;
    initialized = true;

    log.transports.file.level = 'info';
    autoUpdater.logger = log;

    // Check for updates periodically
    setInterval(() => {
        autoUpdater.checkForUpdates();
    }, 60 * 60 * 1000); // Every hour

    autoUpdater.on('checking-for-update', () => {
        log.info('Checking for update...');
        if (updateWindow) updateWindow.webContents.send('update:status', { status: 'checking' });
    });

    autoUpdater.on('update-available', (info) => {
        log.info('Update available:', info);
        if (updateWindow) updateWindow.webContents.send('update:status', { status: 'available', info });
    });

    autoUpdater.on('update-not-available', (info) => {
        log.info('Update not available:', info);
        if (updateWindow) updateWindow.webContents.send('update:status', { status: 'not-available', info });
    });

    autoUpdater.on('error', (err) => {
        log.error('Error in auto-updater:', err);
        if (updateWindow) updateWindow.webContents.send('update:status', { status: 'error', error: err.message });
    });

    autoUpdater.on('download-progress', (progressObj) => {
        let log_message = "Download speed: " + progressObj.bytesPerSecond;
        log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
        log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
        log.info(log_message);
        if (updateWindow) updateWindow.webContents.send('update:download-progress', progressObj);
    });

    autoUpdater.on('update-downloaded', (info) => {
        log.info('Update downloaded');
        if (updateWindow) updateWindow.webContents.send('update:status', { status: 'downloaded', info });
    });

    // IPC Handlers
    ipcMain.handle('update:check', () => {
        autoUpdater.checkForUpdates();
    });

    ipcMain.handle('update:quit-and-install', () => {
        autoUpdater.quitAndInstall();
    });
}
