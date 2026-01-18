
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VaultService } from '../services/vaultService';
import { db } from '../db';
import { Category } from '../types';

// Mock electronAPI
const mockElectronDB = {
    getConfig: vi.fn(),
    setConfig: vi.fn(),
    saveFolder: vi.fn(),
    saveEntry: vi.fn(),
};

(window as any).electronAPI = {
    db: mockElectronDB,
};

// CRITICAL for JSDOM
(window as any).atob = (s: any) => s || "";
(window as any).btoa = (s: any) => s || "";

describe('Migration Wipe Test', () => {
    beforeEach(async () => {
        await db.vault.clear();
        await db.folders.clear();
        vi.clearAllMocks();
    });

    it('should wipe IndexedDB after successful migration to SQLite', async () => {
        // 1. Setup IndexedDB with some data
        await db.vault.put({
            id: 'test-1',
            category: Category.LOGIN,
            encryptedData: new Uint8Array([1, 2, 3]),
            iv: new Uint8Array(12),
            tag: new Uint8Array(16),
            updatedAt: Date.now(),
            isFavorite: false,
        } as any);

        await db.folders.put({
            id: 'folder-1',
            name: 'Test Folder',
        } as any);

        // Verify data exists
        expect(await db.vault.count()).toBe(1);
        expect(await db.folders.count()).toBe(1);

        // 2. Mock SQLite interaction
        mockElectronDB.getConfig.mockResolvedValue('false');
        mockElectronDB.setConfig.mockResolvedValue(undefined);
        mockElectronDB.saveFolder.mockResolvedValue(undefined);
        mockElectronDB.saveEntry.mockResolvedValue(undefined);

        // 3. Run migration
        const mockKey = {} as CryptoKey;
        await VaultService.migrateToSQLite(mockKey);

        // 4. Verify result
        expect(mockElectronDB.setConfig).toHaveBeenCalledWith('migration_v1_complete', 'true');

        // THE CRITICAL CHECK: IndexedDB should be empty now
        const vaultCount = await db.vault.count();
        const folderCount = await db.folders.count();

        expect(vaultCount).toBe(0);
        expect(folderCount).toBe(0);
    });
});
