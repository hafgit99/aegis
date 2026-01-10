import { db } from '../db';
import { CryptoService } from './cryptoService';
import { ExportService } from './exportService';
import { VaultService } from './vaultService';
import { BackupSchedule, BackupMetadata, BackupFile } from '../types';

export class BackupService {
    private static STORAGE_KEY = 'aegis_backup_config';
    private static METADATA_KEY = 'aegis_backup_metadata';

    static async getConfig(): Promise<BackupSchedule> {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (!stored) {
            return {
                enabled: false,
                frequency: 'manual',
                maxBackups: 10
            };
        }
        return JSON.parse(stored);
    }

    static async saveConfig(config: BackupSchedule): Promise<void> {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(config));

        // Electron varsa main process'e haber ver (scheduler için)
        if ((window as any).electronAPI?.backup) {
            await (window as any).electronAPI.backup.schedule(config);
        }
    }

    static async createBackup(masterKey: CryptoKey): Promise<BackupMetadata | null> {
        const entries = await db.vault.toArray();
        const decryptedEntries = [];

        for (const entry of entries) {
            try {
                const sensitive = await VaultService.decryptEntry(entry, masterKey);
                const metadata = await VaultService.decryptEntryMetadata(entry, masterKey);

                decryptedEntries.push({
                    ...entry,
                    ...metadata,
                    sensitive: {
                        ...sensitive,
                        fileBlob: sensitive.fileBlob instanceof Uint8Array
                            ? CryptoService.arrayBufferToBase64(sensitive.fileBlob)
                            : sensitive.fileBlob
                    },
                    category: metadata.category || entry.category
                });
            } catch (e) {
                console.error("Backup: Entry decryption failed", entry.id, e);
            }
        }

        const bundle = {
            version: "1.1",
            exportDate: Date.now(),
            entries: decryptedEntries,
            app: "Aegis Vault"
        };

        const payloadContent = JSON.stringify(bundle);
        const vaultMetadata = JSON.parse(localStorage.getItem('aegis_vault_metadata') || '{}');
        const { ciphertext, iv, tag } = await CryptoService.encrypt(payloadContent, masterKey);

        const backupData = {
            payload: CryptoService.arrayBufferToBase64(ciphertext),
            iv: CryptoService.arrayBufferToBase64(iv.buffer as ArrayBuffer),
            tag: CryptoService.arrayBufferToBase64(tag.buffer as ArrayBuffer),
            salt: vaultMetadata.salt,
            iterations: vaultMetadata.iterations,
            hint: "AEGIS_VAULT_BACKUP",
            encrypted: true
        };

        const backupId = crypto.randomUUID();
        const timestamp = Date.now();
        const dataString = JSON.stringify(backupData, null, 2);
        const checksum = await this.calculateChecksum(dataString);

        const metadata: BackupMetadata = {
            id: backupId,
            timestamp,
            version: "1.1",
            size: dataString.length,
            location: 'local',
            verified: true
        };

        // Electron API üzerinden kaydet
        if ((window as any).electronAPI?.backup) {
            const result = await (window as any).electronAPI.backup.saveLocalBackup({
                id: backupId,
                encryptedData: dataString,
                timestamp
            });

            if (result.success) {
                await this.addMetadata({ ...metadata, checksum });
                return metadata;
            }
        }

        return null;
    }

    private static async addMetadata(meta: BackupMetadata & { checksum: string }): Promise<void> {
        const existing = await this.getHistory();
        const updated = [meta, ...existing].slice(0, 50); // Son 50 yedeği tut
        localStorage.setItem(this.METADATA_KEY, JSON.stringify(updated));
    }

    static async getHistory(): Promise<BackupMetadata[]> {
        const stored = localStorage.getItem(this.METADATA_KEY);
        return stored ? JSON.parse(stored) : [];
    }

    static async clearHistory(): Promise<void> {
        localStorage.removeItem(this.METADATA_KEY);
        if ((window as any).electronAPI?.backup) {
            await (window as any).electronAPI.backup.clearAllBackups();
        }
    }

    static async deleteBackup(id: string): Promise<void> {
        const history = await this.getHistory();
        const updated = history.filter(m => m.id !== id);
        localStorage.setItem(this.METADATA_KEY, JSON.stringify(updated));

        if ((window as any).electronAPI?.backup) {
            await (window as any).electronAPI.backup.deleteBackup(id, 'local');
        }
    }

    private static async calculateChecksum(text: string): Promise<string> {
        const msgUint8 = new TextEncoder().encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
}
