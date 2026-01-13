import { ipcMain } from 'electron';
import { createClient } from 'webdav';
import { google } from 'googleapis';

export function setupCloudSyncHandlers() {
    // WebDAV Handlers
    ipcMain.handle('cloud:webdav:test', async (event, config) => {
        try {
            const client = createClient(config.url, {
                username: config.username,
                password: config.password
            });
            await client.getDirectoryContents('/');
            return true;
        } catch (e) {
            console.error('[Cloud] WebDAV Test Failed:', e);
            return false;
        }
    });

    ipcMain.handle('cloud:webdav:list', async (event, config) => {
        const client = createClient(config.url, {
            username: config.username,
            password: config.password
        });
        const contents = await client.getDirectoryContents(config.remotePath || '/');
        return contents
            .filter(f => f.type === 'file' && f.filename.endsWith('.aegis'))
            .map(f => ({
                name: f.filename,
                lastModified: new Date(f.lastmod).getTime(),
                size: f.size
            }));
    });

    ipcMain.handle('cloud:webdav:upload', async (event, config, name, buffer) => {
        const client = createClient(config.url, {
            username: config.username,
            password: config.password
        });
        const remoteFile = `${config.remotePath || '/'}/${name}`.replace(/\/+/g, '/');
        await client.putFileContents(remoteFile, Buffer.from(buffer));
    });

    ipcMain.handle('cloud:webdav:download', async (event, config, name) => {
        const client = createClient(config.url, {
            username: config.username,
            password: config.password
        });
        const remoteFile = `${config.remotePath || '/'}/${name}`.replace(/\/+/g, '/');
        const content = await client.getFileContents(remoteFile);
        return content.buffer;
    });

    // Google Drive Handlers
    let oauth2Client = null;

    ipcMain.handle('cloud:google:authenticate', async (event, customConfig) => {
        const { BrowserWindow } = require('electron');

        oauth2Client = new google.auth.OAuth2(
            customConfig.clientId,
            customConfig.clientSecret,
            'http://localhost:3000/oauth2callback'
        );

        const authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: ['https://www.googleapis.com/auth/drive.file'],
            prompt: 'consent'
        });

        return new Promise((resolve, reject) => {
            const authWindow = new BrowserWindow({
                width: 600,
                height: 800,
                show: true,
                alwaysOnTop: true,
                autoHideMenuBar: true,
                title: 'Aegis Vault - Google Login'
            });

            authWindow.loadURL(authUrl);

            const handleNavigation = (url) => {
                if (url.includes('code=')) {
                    const code = new URL(url).searchParams.get('code');
                    authWindow.destroy();

                    oauth2Client.getToken(code, (err, tokens) => {
                        if (err) return reject(err);
                        oauth2Client.setCredentials(tokens);

                        // Save tokens for next session
                        const keytar = require('keytar');
                        keytar.setPassword('AegisVault', 'google_drive_tokens', JSON.stringify(tokens));
                        keytar.setPassword('AegisVault', 'google_drive_api_keys', JSON.stringify(customConfig));

                        resolve(true);
                    });
                }
            };

            authWindow.webContents.on('will-navigate', (event, url) => handleNavigation(url));
            authWindow.webContents.on('will-redirect', (event, url) => handleNavigation(url));

            authWindow.on('closed', () => resolve(false));
        });
    });

    // Helper to restore session
    async function refreshTokens() {
        const keytar = require('keytar');
        const saved = await keytar.getPassword('AegisVault', 'google_drive_tokens');
        const savedKeys = await keytar.getPassword('AegisVault', 'google_drive_api_keys');

        if (saved && savedKeys) {
            const tokens = JSON.parse(saved);
            const keys = JSON.parse(savedKeys);

            oauth2Client = new google.auth.OAuth2(
                keys.clientId,
                keys.clientSecret,
                'http://localhost:3000/oauth2callback'
            );
            oauth2Client.setCredentials(tokens);

            // Check if expired
            if (tokens.expiry_date < Date.now()) {
                const { credentials } = await oauth2Client.refreshAccessToken();
                keytar.setPassword('AegisVault', 'google_drive_tokens', JSON.stringify(credentials));
            }
            return true;
        }
        return false;
    }

    ipcMain.handle('cloud:google:list', async () => {
        await refreshTokens();
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const res = await drive.files.list({
            q: "name contains 'aegis-sync' and mimeType = 'application/octet-stream'",
            fields: 'files(id, name, modifiedTime, size)',
        });
        return (res.data.files || []).map(f => ({
            id: f.id,
            name: f.name,
            lastModified: new Date(f.modifiedTime).getTime(),
            size: parseInt(f.size)
        }));
    });

    ipcMain.handle('cloud:google:upload', async (event, name, buffer) => {
        await refreshTokens();
        const drive = google.drive({ version: 'v3', auth: oauth2Client });

        // Find existing to update or create new
        const existing = await drive.files.list({
            q: `name = '${name}' and trashed = false`,
            fields: 'files(id)'
        });

        if (existing.data.files.length > 0) {
            await drive.files.update({
                fileId: existing.data.files[0].id,
                media: { mimeType: 'application/octet-stream', body: Buffer.from(buffer) }
            });
        } else {
            await drive.files.create({
                requestBody: { name, mimeType: 'application/octet-stream' },
                media: { mimeType: 'application/octet-stream', body: Buffer.from(buffer) }
            });
        }
    });

    ipcMain.handle('cloud:google:logout', async () => {
        const keytar = require('keytar');
        await keytar.deletePassword('AegisVault', 'google_drive_tokens');
        oauth2Client.setCredentials(null);
    });
}
