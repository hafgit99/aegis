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

    // Google Drive Handlers (Simplified - requires real ClientID/Secret from user)
    // For production, these would be in .env and use a dedicated OAuth flow
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        'http://localhost:3000/oauth2callback'
    );

    ipcMain.handle('cloud:google:authenticate', async () => {
        // In a real app, this would trigger the system browser and handle the redirect
        // For now, we'll return a placeholder or use saved tokens
        console.log('[Cloud] Google OAuth requested');
        return true;
    });

    ipcMain.handle('cloud:google:list', async () => {
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        const res = await drive.files.list({
            q: "name contains 'aegis-sync' and mimeType = 'application/octet-stream'",
            fields: 'files(id, name, modifiedTime, size)',
        });
        return res.data.files.map(f => ({
            id: f.id,
            name: f.name,
            lastModified: new Date(f.modifiedTime).getTime(),
            size: parseInt(f.size)
        }));
    });

    ipcMain.handle('cloud:google:upload', async (event, name, buffer) => {
        const drive = google.drive({ version: 'v3', auth: oauth2Client });
        await drive.files.create({
            requestBody: { name, mimeType: 'application/octet-stream' },
            media: { mimeType: 'application/octet-stream', body: Buffer.from(buffer) }
        });
    });
}
