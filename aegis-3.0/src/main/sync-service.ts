import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { app, ipcMain } from 'electron';
import log from 'electron-log';

export interface SyncConfig {
    provider: 'webdav' | 'nextcloud' | 's3' | 'google';
    endpoint: string;
    username: string;
    password: string; // App password or API Key
    bucket?: string;
    region?: string;
    remotePath: string;
    enabled: boolean;
    autoSync: boolean;
    e2ee: boolean; // Mandatory for security audit
}

export class CloudSyncService {
    private static instance: CloudSyncService;
    private config: SyncConfig | null = null;
    private syncKey: Buffer | null = null;

    private constructor() {
        this.loadConfig();
    }

    public static getInstance(): CloudSyncService {
        if (!CloudSyncService.instance) {
            CloudSyncService.instance = new CloudSyncService();
        }
        return CloudSyncService.instance;
    }

    private loadConfig() {
        const configPath = path.join(app.getPath('userData'), 'sync_config.json');
        if (fs.existsSync(configPath)) {
            try {
                this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            } catch (e) {
                log.error('[SYNC] Failed to load sync config');
            }
        }
    }

    private saveConfig() {
        const configPath = path.join(app.getPath('userData'), 'sync_config.json');
        fs.writeFileSync(configPath, JSON.stringify(this.config, null, 2), 'utf8');
    }

    public updateConfig(newConfig: SyncConfig) {
        this.config = newConfig;
        this.saveConfig();
    }

    public async testConnection(config: SyncConfig): Promise<boolean> {
        try {
            if (config.provider === 'webdav' || config.provider === 'nextcloud') {
                const response = await axios({
                    method: 'PROPFIND',
                    url: config.endpoint,
                    auth: {
                        username: config.username,
                        password: config.password
                    },
                    headers: {
                        Depth: '0'
                    }
                });
                return response.status >= 200 && response.status < 300;
            } else if (config.provider === 's3') {
                // Simplified S3 check (HEAD request)
                // Note: Real S3 requires complex signing. For now, we favor WebDAV/Nextcloud.
                // In a real implementation, we'd use @aws-sdk/client-s3 or a lighter alternative.
                return false;
            }
            return false;
        } catch (error: any) {
            log.error('[SYNC] Connection test failed');
            return false;
        }
    }

    public setSyncKey(masterHash: string) {
        // Derive a separate sync key from the master password hash
        // Using a different salt and purpose string
        const salt = 'aegis-sync-e2ee-v1';
        this.syncKey = crypto.scryptSync(masterHash, salt, 32);
        log.info('[SYNC] Sync key initialized for E2EE');
    }

    public clearSyncKey() {
        if (this.syncKey) {
            this.syncKey.fill(0); // Zero out memory
            this.syncKey = null;
            log.info('[SYNC] Sync key purged from memory');
        }
    }

    private encrypt(data: Buffer): Buffer {
        if (!this.syncKey) throw new Error('Sync key not initialized. Please unlock vault first.');

        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', this.syncKey, iv);

        const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
        const authTag = cipher.getAuthTag();

        // Structure: [IV (16)] [AuthTag (16)] [Encrypted Data]
        // Plus a magic header to identify Aegis E2EE packages
        const magic = Buffer.from('AEGIS_E2EE_V1');
        return Buffer.concat([magic, iv, authTag, encrypted]);
    }

    private decrypt(data: Buffer): Buffer {
        if (!this.syncKey) throw new Error('Sync key not initialized');

        const magic = data.subarray(0, 13);
        if (magic.toString() !== 'AEGIS_E2EE_V1') {
            // Check if it's an old unencrypted backup or corrupted
            log.warn('[SYNC] Package magic mismatch or unencrypted data');
            return data;
        }

        const iv = data.subarray(13, 13 + 16);
        const authTag = data.subarray(13 + 16, 13 + 16 + 16);
        const encrypted = data.subarray(13 + 16 + 16);

        const decipher = crypto.createDecipheriv('aes-256-gcm', this.syncKey, iv);
        decipher.setAuthTag(authTag);

        return Buffer.concat([decipher.update(encrypted), decipher.final()]);
    }

    public async uploadVault(): Promise<{ success: boolean; error?: string }> {
        if (!this.config || !this.config.enabled) return { success: false, error: 'Sync not configured or disabled' };
        if (!this.syncKey) return { success: false, error: 'Vault is locked. Please unlock to sync.' };

        try {
            const dbPath = path.join(app.getPath('userData'), 'vault.db');
            if (!fs.existsSync(dbPath)) return { success: false, error: 'Database file not found' };

            let fileData = fs.readFileSync(dbPath);

            // E2EE Wrapper: Encrypt the entire database file
            // This prevents metadata leakage (file format, version info, etc.)
            log.info('[SYNC] Encrypting vault for cloud storage...');
            fileData = this.encrypt(fileData as any) as any;

            const remoteUrl = this.getRemoteUrl();

            if (this.config.provider === 'webdav' || this.config.provider === 'nextcloud') {
                const response = await axios({
                    method: 'PUT',
                    url: remoteUrl,
                    data: fileData,
                    auth: {
                        username: this.config.username,
                        password: this.config.password
                    },
                    headers: {
                        'Content-Type': 'application/octet-stream'
                    }
                });
                return { success: response.status >= 200 && response.status < 300 };
            } else if (this.config.provider === 'google') {
                // Google Drive integration would use the native bridge or a dedicated library
                // Mocking implementation for now as per audit requirement
                log.info('[SYNC] Google Drive upload initiated (E2EE active)');
                return { success: false, error: 'Google Drive integration requires browser-based OAuth2. Use WebDAV for now.' };
            }

            return { success: false, error: 'Provider not fully implemented' };
        } catch (error: any) {
            log.error('[SYNC] Upload failed:', error.message);
            return { success: false, error: 'Upload failed' };
        }
    }

    public async downloadVault(): Promise<{ success: boolean; data?: any; error?: string }> {
        if (!this.config || !this.config.enabled) return { success: false, error: 'Sync not configured' };
        if (!this.syncKey) return { success: false, error: 'Vault is locked' };

        try {
            const remoteUrl = this.getRemoteUrl();

            if (this.config.provider === 'webdav' || this.config.provider === 'nextcloud') {
                const response = await axios({
                    method: 'GET',
                    url: remoteUrl,
                    responseType: 'arraybuffer',
                    auth: {
                        username: this.config.username,
                        password: this.config.password
                    }
                });

                if (response.status === 200) {
                    let data = Buffer.from(response.data);

                    // Decrypt E2EE package
                    try {
                        log.info('[SYNC] Decrypting downloaded vault...');
                        data = this.decrypt(data);
                    } catch (e) {
                        log.error('[SYNC] Decryption failed. Wrong key or corrupted data.');
                        return { success: false, error: 'Decryption failed' };
                    }

                    return { success: true, data: data as any };
                }
            }

            return { success: false, error: 'Download failed or file not found' };
        } catch (error: any) {
            log.error('[SYNC] Download failed');
            return { success: false, error: 'Download failed' };
        }
    }

    private getRemoteUrl(): string {
        if (!this.config) return '';
        let base = this.config.endpoint;
        if (!base.endsWith('/')) base += '/';

        // Use a generic name to hide the application identity in cloud metadata
        // Instead of 'aegis_vault_backup.db', we use a blob name.
        let fileName = 'ebdc4a_data.bin';
        let remotePath = this.config.remotePath || '';
        if (remotePath.startsWith('/')) remotePath = remotePath.substring(1);
        if (remotePath && !remotePath.endsWith('/')) remotePath += '/';

        return base + remotePath + fileName;
    }
}

export function setupSyncIpc() {
    const syncService = CloudSyncService.getInstance();

    ipcMain.handle('sync:get-config', () => {
        const configPath = path.join(app.getPath('userData'), 'sync_config.json');
        if (fs.existsSync(configPath)) {
            return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }
        return null;
    });

    ipcMain.handle('sync:save-config', (_event, config) => {
        syncService.updateConfig(config);
        return true;
    });

    ipcMain.handle('sync:test', async (_event, config) => {
        return await syncService.testConnection(config);
    });

    ipcMain.handle('sync:push', async () => {
        return await syncService.uploadVault();
    });

    ipcMain.handle('sync:pull', async () => {
        return await syncService.downloadVault();
    });
}
