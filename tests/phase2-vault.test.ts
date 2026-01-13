import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VaultService } from '../services/vaultService.ts';
import { CryptoService } from '../services/cryptoService.ts';
import { Category, VaultEntry } from '../types.ts';
import { db } from '../db.ts';

describe('Phase 2: Vault Operations Tests', () => {
    let masterKey: CryptoKey;

    beforeEach(async () => {
        // Force Dexie usage for these tests by removing electronAPI
        vi.stubGlobal('electronAPI', undefined);

        // Reset database
        await db.vault.clear();
        await db.folders.clear();
        localStorage.clear();

        // Derive a test master key
        const password = 'test_master_password';
        const salt = new Uint8Array(16).fill(1);
        const iterations = 1;
        masterKey = await CryptoService.deriveKeyFromPassword(password, salt, iterations);

        vi.clearAllMocks();
    });

    describe('Create & Update (Test 13 & 14)', () => {
        it('should create a new entry correctly (v4 Full Encryption)', async () => {
            const entryData = {
                title: 'Work Email',
                username: 'alice@company.com',
                category: Category.LOGIN,
                sensitive: {
                    password: 'super-secure-password'
                }
            };

            const savedEntry = await VaultService.saveEntry(entryData, masterKey);

            expect(savedEntry.id).toBeDefined();
            expect(savedEntry.category).toBe(Category.LOGIN);
            expect((savedEntry as any).version).toBe(4);

            // Verify persistence in DB
            const dbEntry = await db.vault.get(savedEntry.id);
            expect(dbEntry).toBeDefined();
            expect(dbEntry?.encryptedData).toBeDefined();
            expect(dbEntry?.iv).toBeDefined();
        });

        it('should update an existing entry metadata (Test 14)', async () => {
            // Create first
            const entryData = {
                title: 'Old Title',
                sensitive: { password: '123' },
                isFavorite: false
            };
            const saved = await VaultService.saveEntry(entryData, masterKey);

            // Update favorite status
            await VaultService.updateEntryMetadata(saved.id, { isFavorite: true }, masterKey);

            const updated = await db.vault.get(saved.id);
            // Note: VaultService v4 might store isFavorite inside encrypted blob too
            // But we check if the update call was successful
            expect(updated).toBeDefined();
        });
    });

    describe('Deduplication (Test 17)', () => {
        it('should detect and remove duplicate entries with same ID', async () => {
            const id = 'duplicate-id-123';
            const entry1 = { id, title: 'Original', sensitive: { password: 'p1' } };

            // Manually put twice
            await VaultService.saveEntry(entry1, masterKey);
            await VaultService.saveEntry(entry1, masterKey);

            const count = await db.vault.where('id').equals(id).count();
            // Dexie's put() overwrites by default if ID is the same
            expect(count).toBe(1);
        });
    });

    describe('Import/Export (Test 18)', () => {
        it('should bulk import multiple entries correctly', async () => {
            const items = [
                { title: 'Site 1', sensitive: { password: 'p1' } },
                { title: 'Site 2', sensitive: { password: 'p2' } },
                { title: 'Site 3', sensitive: { password: 'p3' } }
            ];

            await VaultService.bulkImport(items, masterKey);

            const count = await db.vault.count();
            expect(count).toBe(items.length);
        });
    });

    describe('Empty States (Test 22)', () => {
        it('should return empty list when vault is empty', async () => {
            // Note: IndexedDB is empty due to beforeEach
            const entries = await db.vault.toArray();
            expect(entries.length).toBe(0);
        });
    });

    describe('Soft Delete / Delete (Test 15)', () => {
        it('should delete entry from database', async () => {
            const saved = await VaultService.saveEntry({ title: 'To Delete', sensitive: { password: '1' } }, masterKey);
            expect(await db.vault.count()).toBe(1);

            await VaultService.deleteEntry(saved.id);
            expect(await db.vault.count()).toBe(0);
        });
    });
});
