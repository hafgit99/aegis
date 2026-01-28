
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { VaultEntry, SensitiveData, Folder } from '../types';
import { VaultService } from '../services/vaultService';
import { BruteForceService } from '../services/bruteForceService';
import { useAuth } from './AuthContext';
import { db } from '../db';
import { FolderService } from '../services/folderService';

interface VaultContextType {
    entries: VaultEntry[];
    folders: (Folder & { name: string })[];
    loadEntries: () => Promise<void>;
    saveEntry: (plain: Partial<VaultEntry> & { sensitive: SensitiveData }) => Promise<void>;
    deleteEntry: (id: string) => Promise<void>;
    restoreEntry: (id: string) => Promise<void>;
    permanentDelete: (id: string) => Promise<void>;
    decryptData: (entry: VaultEntry) => Promise<SensitiveData>;
    toggleFavorite: (id: string) => Promise<void>;
    createFolder: (name: string, color: string, icon: string, parentId?: string) => Promise<void>;
    unlock: (password: string) => Promise<void>;
    setup: (password: string) => Promise<void>;
    resetVault: () => Promise<void>;
    lock: () => Promise<void>;
    deduplicateVault: () => Promise<{ deletedCount: number }>;
    isInitialized: boolean;
    isLoading: boolean;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export const VaultProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [entries, setEntries] = useState<VaultEntry[]>([]);
    const [folders, setFolders] = useState<(Folder & { name: string })[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { masterKey, setKey, logout, setDeriving, setVerifying2FA, setTempMasterKey } = useAuth();

    // Track previous masterKey to prevent infinite loop
    const prevMasterKeyRef = React.useRef<CryptoKey | null>(null);
    const isMountedRef = React.useRef(false);

    const handleLock = useCallback(async () => {
        // Önce verileri temizle (UI için anlık güncelleme)
        setEntries([]);
        setFolders([]);

        // AuthContext üzerindeki logout'u çağır (Key'leri temizler)
        await logout();

        // Brute Force durumu temizle
        try {
            await BruteForceService.clear();
        } catch (e) {
            console.error("Brute Force clear error:", e);
        }
    }, [logout]);

    const loadEntries = useCallback(async (silent = false) => {
        if (!silent) setIsLoading(true);
        try {
            let data: VaultEntry[] = [];
            const electronDB = (window as any).electronAPI?.db;

            if (masterKey && electronDB) {
                // Check for migration
                const isMigrated = await VaultService.isMigratedToSQLite();
                if (!isMigrated) {
                    const indexedDbItems = await db.vault.toArray();
                    console.log(`[Migration] Starting migration... Found ${indexedDbItems.length} items in IndexedDB.`);
                    await VaultService.migrateToSQLite(masterKey);
                    console.log("[Migration] Migration to SQLite completed.");
                }
                data = await VaultService.loadAllFromSQLite();
                console.log(`[Database] Loaded ${data.length} entries from SQLite.`);
            } else {
                data = await db.vault.toArray();
            }

            if (masterKey) {
                const decryptedData = await Promise.all(
                    data.map(async (entry) => {
                        try {
                            const metadata = await VaultService.decryptEntryMetadata(entry, masterKey);
                            return {
                                ...entry,
                                title: metadata.title,
                                username: metadata.username,
                                category: metadata.category || entry.category,
                                folderId: metadata.folderId,
                                isFavorite: metadata.isFavorite ?? entry.isFavorite,
                                deletedAt: metadata.deletedAt,
                                fileSize: metadata.fileSize ?? entry.fileSize
                            };
                        } catch (e) {
                            console.error("[VaultContext] Failed to decrypt entry metadata:", entry.id, e);
                            return {
                                ...entry,
                                title: '[Decryption Error]',
                                username: '[Decryption Error]',
                                category: entry.category,
                                folderId: entry.folderId,
                                updatedAt: entry.updatedAt,
                                isFavorite: entry.isFavorite,
                                deletedAt: entry.deletedAt,
                                fileSize: entry.fileSize
                            };
                        }
                    })
                );
                console.log(`[VaultContext] Successfully decrypted ${decryptedData.length} entries`);
                setEntries(decryptedData.sort((a, b) => b.updatedAt - a.updatedAt));

                const fData = await FolderService.getAllFolders(masterKey);
                setFolders(fData);

                // Sync 2FA config to DB for CLI access
                const twoFactorConfigB64 = localStorage.getItem('aegis_2fa_config');
                if (twoFactorConfigB64 && (window as any).electronAPI?.db) {
                    try {
                        await (window as any).electronAPI.db.setConfig('aegis_2fa_config', twoFactorConfigB64);
                    } catch (e) {
                        console.error("Failed to sync 2FA to DB in loadEntries:", e);
                    }
                }
            } else {
                setEntries(data.sort((a, b) => b.updatedAt - a.updatedAt));
            }
        } catch (error) {
            console.error("[VaultContext] Load failed:", error);
        } finally {
            if (!silent) setIsLoading(false);
        }
    }, [masterKey]);

    useEffect(() => {
        // Track the actual instance of masterKey to avoid infinite loops during setup
        const currentMasterKey = masterKey;

        if (currentMasterKey && currentMasterKey !== prevMasterKeyRef.current) {
            console.log('[VaultContext] masterKey changed, triggering loadEntries');
            prevMasterKeyRef.current = currentMasterKey;
            loadEntries();
        } else if (!currentMasterKey) {
            prevMasterKeyRef.current = null;
            if (isMountedRef.current) {
                // If it was mounted and now no key, we are locked
                setIsLoading(false);
            } else {
                isMountedRef.current = true;
                setIsLoading(false);
            }
        }
    }, [masterKey, loadEntries]);

    const unlock = useCallback(async (password: string) => {
        const status = await BruteForceService.checkStatus();
        if (status.locked) throw new Error("BRUTE_FORCE_LOCKED");

        setDeriving(true);
        try {
            const { key, raw } = await VaultService.deriveMasterKey(password);
            const twoFactorConfigB64 = localStorage.getItem('aegis_2fa_config');

            if (twoFactorConfigB64) {
                setTempMasterKey(key, raw);
                setVerifying2FA(true);
                return;
            }

            await BruteForceService.recordSuccess();
            setKey(key, raw);
        } catch (err: any) {
            await BruteForceService.recordFailure();
            throw err;
        } finally {
            setDeriving(false);
        }
    }, [setKey, setDeriving, setVerifying2FA, setTempMasterKey]);

    const setup = useCallback(async (password: string) => {
        setDeriving(true);
        try {
            console.log('[VaultContext] Starting setup...');
            const { key, raw } = await VaultService.setup(password);
            console.log('[VaultContext] VaultService.setup completed, calling setKey...');
            await setKey(key, raw);
            console.log('[VaultContext] setKey completed successfully');
            setEntries([]);
            setFolders([]);
        } catch (error) {
            console.error('[VaultContext] Setup failed:', error);
            throw error;
        } finally {
            setDeriving(false);
        }
    }, [setKey, setDeriving]);

    const saveEntry = useCallback(async (plain: Partial<VaultEntry> & { sensitive: SensitiveData }) => {
        if (!masterKey) throw new Error("Vault locked");
        await VaultService.saveEntry(plain, masterKey);
        await loadEntries(true);
    }, [masterKey, loadEntries]);

    const deleteEntry = useCallback(async (id: string) => {
        if (!masterKey) throw new Error("Vault locked");
        await VaultService.updateEntryMetadata(id, { deletedAt: Date.now() }, masterKey);
        await loadEntries(true);
    }, [masterKey, loadEntries]);

    const restoreEntry = useCallback(async (id: string) => {
        if (!masterKey) throw new Error("Vault locked");
        await VaultService.updateEntryMetadata(id, { deletedAt: undefined }, masterKey);
        await loadEntries(true);
    }, [masterKey, loadEntries]);

    const permanentDelete = useCallback(async (id: string) => {
        await VaultService.deleteEntry(id);
        await loadEntries(true);
    }, [loadEntries]);

    const decryptData = useCallback(async (entry: VaultEntry) => {
        if (!masterKey) throw new Error("Vault locked");
        return await VaultService.decryptEntry(entry, masterKey);
    }, [masterKey]);

    const toggleFavorite = useCallback(async (id: string) => {
        if (!masterKey) throw new Error("Vault locked");
        const entry = entries.find(e => e.id === id);
        if (!entry) return;
        await VaultService.updateEntryMetadata(id, { isFavorite: !entry.isFavorite }, masterKey);
        await loadEntries(true);
    }, [entries, masterKey, loadEntries]);

    const createFolder = useCallback(async (name: string, color: string, icon: string, parentId?: string) => {
        if (!masterKey) return;
        await FolderService.createFolder(name, color, icon, parentId, masterKey);
        await loadEntries(true);
    }, [masterKey, loadEntries]);

    const resetVault = async () => {
        await db.vault.clear();
        await db.folders.clear();
        await loadEntries();
    };

    const deduplicateVault = useCallback(async () => {
        if (!masterKey) throw new Error("Vault locked");
        const result = await VaultService.deduplicateVault(masterKey);
        await loadEntries();
        return result;
    }, [masterKey, loadEntries]);

    return (
        <VaultContext.Provider value={{
            entries,
            folders,
            loadEntries,
            saveEntry,
            deleteEntry,
            restoreEntry,
            permanentDelete,
            decryptData,
            toggleFavorite,
            createFolder,
            unlock,
            setup,
            resetVault,
            lock: handleLock,
            deduplicateVault,
            isLoading,
            isInitialized: VaultService.isInitialized()
        }}>
            {children}
        </VaultContext.Provider>
    );
};

export const useVault = () => {
    const context = useContext(VaultContext);
    if (!context) throw new Error("useVault must be used within VaultProvider");
    return context;
};
