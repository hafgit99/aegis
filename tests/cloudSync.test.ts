import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CloudSyncService } from '../services/cloud/CloudSyncService.ts';
import { VaultService } from '../services/vaultService.ts';
import { CryptoService } from '../services/cryptoService.ts';
import { db } from '../db.ts';

// Mock providers
vi.mock('../services/cloud/WebDAVProvider.ts', () => {
    return {
        WebDAVProvider: class {
            name = "WebDAV";
            initialize = vi.fn();
            uploadVaultFile = vi.fn();
            listVaultFiles = vi.fn().mockResolvedValue([{ name: 'aegis-sync-old.aegis', lastModified: 100 }, { name: 'aegis-sync-new.aegis', lastModified: 200 }]);
            downloadVaultFile = vi.fn();
            isAuthenticated = vi.fn().mockReturnValue(true);
            deleteVaultFile = vi.fn();
            logout = vi.fn();
        }
    };
});

vi.mock('../services/cloud/GoogleDriveProvider.ts', () => {
    return {
        GoogleDriveProvider: class {
            name = "Google Drive";
        }
    };
});

describe('CloudSyncService', () => {
    let syncService: CloudSyncService;
    let mockMasterKey: CryptoKey;

    beforeEach(async () => {
        vi.clearAllMocks();
        syncService = new CloudSyncService('webdav');
        mockMasterKey = {} as CryptoKey; // Mock key
    });

    it('should create an encrypted bundle for cloud upload', async () => {
        // Mock DB entries
        vi.spyOn(db.vault, 'toArray').mockResolvedValue([
            { id: '1', encryptedData: new Uint8Array([1, 2, 3]), iv: new Uint8Array(12), tag: new Uint8Array(16) }
        ] as any);

        // Mock VaultService decryption
        vi.spyOn(VaultService, 'decryptEntry').mockResolvedValue({ password: 'test-password' } as any);
        vi.spyOn(VaultService, 'decryptEntryMetadata').mockResolvedValue({ title: 'Test Entry' } as any);

        // Mock CryptoService encryption
        vi.spyOn(CryptoService, 'encrypt').mockResolvedValue({
            ciphertext: new Uint8Array([9, 9, 9]),
            iv: new Uint8Array(12),
            tag: new Uint8Array(16)
        });

        const uploadSpy = vi.spyOn((syncService as any).provider, 'uploadVaultFile');

        await syncService.syncToCloud(mockMasterKey);

        expect(uploadSpy).toHaveBeenCalled();
        const callArgs = uploadSpy.mock.calls[0];
        console.log('UPLOAD ARGS:', callArgs[0], typeof callArgs[1], callArgs[1]);
        expect(callArgs[0]).toMatch(/aegis-sync-.*\.aegis/);
        expect(callArgs[1]).toBeDefined();
        expect(callArgs[1].constructor.name).toBe('ArrayBuffer');
    });

    it('should download and merge the newest bundle from cloud', async () => {
        const downloadSpy = vi.spyOn((syncService as any).provider, 'downloadVaultFile')
            .mockResolvedValue(new ArrayBuffer(10));

        // Mock decryption/import logic
        vi.spyOn(syncService as any, 'decryptAndMergeBundle').mockResolvedValue(undefined);

        await syncService.pullFromCloud(mockMasterKey);

        expect(downloadSpy).toHaveBeenCalledWith('aegis-sync-new.aegis');
    });
});
