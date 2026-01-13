import { db } from '../../db.ts';
import { CryptoService } from '../cryptoService.ts';
import { VaultService } from '../vaultService.ts';
import { ICloudProvider, CloudFileInfo } from './ICloudProvider.ts';
import { WebDAVProvider } from './WebDAVProvider.ts';
import { GoogleDriveProvider } from './GoogleDriveProvider.ts';

export class CloudSyncService {
    private provider: ICloudProvider | null = null;

    constructor(providerType: 'google' | 'webdav' | null) {
        if (providerType === 'google') {
            this.provider = new GoogleDriveProvider();
        } else if (providerType === 'webdav') {
            this.provider = new WebDAVProvider();
        }
    }

    async syncToCloud(masterKey: CryptoKey): Promise<void> {
        if (!this.provider) throw new Error("Cloud provider not configured");

        // 1. Export entire vault to an encrypted bundle
        const bundle = await this.createEncryptedBundle(masterKey);

        // 2. Upload to cloud
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `aegis-sync-${timestamp}.aegis`;

        await this.provider.uploadVaultFile(fileName, bundle);
    }

    async pullFromCloud(masterKey: CryptoKey): Promise<void> {
        if (!this.provider) throw new Error("Cloud provider not configured");

        // 1. List files and find the newest
        const files = await this.provider.listVaultFiles();
        if (files.length === 0) throw new Error("No sync files found in cloud");

        const newest = files.sort((a, b) => b.lastModified - a.lastModified)[0];

        // 2. Download
        const encryptedData = await this.provider.downloadVaultFile(newest.id || newest.name);

        // 3. Decrypt and Sync
        await this.decryptAndMergeBundle(encryptedData, masterKey);
    }

    private async createEncryptedBundle(masterKey: CryptoKey): Promise<ArrayBuffer> {
        const entries = await db.vault.toArray();
        const decryptedEntries = [];

        for (const entry of entries) {
            try {
                const sensitive = await VaultService.decryptEntry(entry, masterKey);
                const metadata = await VaultService.decryptEntryMetadata(entry, masterKey);
                decryptedEntries.push({ ...entry, ...metadata, sensitive });
            } catch (e) {
                console.error("Sync: Decryption failed for entry", entry.id, e);
            }
        }

        const payload = JSON.stringify({
            version: "2.0.2",
            timestamp: Date.now(),
            entries: decryptedEntries
        });

        const { ciphertext, iv, tag } = await CryptoService.encrypt(payload, masterKey);

        // Create a simple envelope
        const envelope = {
            ciphertext: CryptoService.arrayBufferToBase64(ciphertext.buffer),
            iv: CryptoService.arrayBufferToBase64(iv.buffer),
            tag: CryptoService.arrayBufferToBase64(tag.buffer),
            app: "Aegis-Vault-Sync"
        };

        return new TextEncoder().encode(JSON.stringify(envelope)).buffer;
    }

    private async decryptAndMergeBundle(data: ArrayBuffer, masterKey: CryptoKey): Promise<void> {
        const jsonStr = new TextDecoder().decode(data);
        const envelope = JSON.parse(jsonStr);

        const ciphertext = CryptoService.base64ToArrayBuffer(envelope.ciphertext);
        const iv = CryptoService.base64ToArrayBuffer(envelope.iv);
        const tag = CryptoService.base64ToArrayBuffer(envelope.tag);

        const decryptedJson = await CryptoService.decrypt(
            new Uint8Array(ciphertext),
            masterKey,
            new Uint8Array(iv),
            new Uint8Array(tag)
        );

        const bundle = JSON.parse(decryptedJson);

        // Merge logic (simple for now: bulk import and deduplicate)
        await VaultService.bulkImport(bundle.entries, masterKey);
        await VaultService.deduplicateVault(masterKey);
    }
}
