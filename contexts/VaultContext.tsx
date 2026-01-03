
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
    isInitialized: boolean;
    isLoading: boolean;
}

const VaultContext = createContext<VaultContextType | undefined>(undefined);

export const VaultProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [entries, setEntries] = useState<VaultEntry[]>([]);
    const [folders, setFolders] = useState<(Folder & { name: string })[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { masterKey, setKey, logout, setDeriving, setVerifying2FA, setTempMasterKey } = useAuth();

    const handleLock = useCallback(async () => {
        // Önce RAM üzerindeki verileri temizle (Hızlı UI geçişi için)
        setEntries([]);
        setFolders([]);
        // AuthContext üzerindeki logout'u çağır (Key'leri temizler)
        await logout();
    }, [logout]);

    const loadEntries = useCallback(async () => {
        const data = await db.vault.toArray();

        if (masterKey) {
            const decryptedData = await Promise.all(
                data.map(async (entry) => {
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
                })
            );
            setEntries(decryptedData.sort((a, b) => b.updatedAt - a.updatedAt));

            const fData = await FolderService.getAllFolders(masterKey);
            setFolders(fData);
        } else {
            setEntries(data.sort((a, b) => b.updatedAt - a.updatedAt));
        }
        setIsLoading(false);
    }, [masterKey]);

    useEffect(() => {
        if (masterKey) {
            loadEntries();
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
            const { key, raw } = await VaultService.setup(password);
            setKey(key, raw);
            setEntries([]);
            setFolders([]);
        } finally {
            setDeriving(false);
        }
    }, [setKey, setDeriving]);

    const saveEntry = useCallback(async (plain: Partial<VaultEntry> & { sensitive: SensitiveData }) => {
        if (!masterKey) throw new Error("Vault locked");
        await VaultService.saveEntry(plain, masterKey);
        await loadEntries();
    }, [masterKey, loadEntries]);

    const deleteEntry = useCallback(async (id: string) => {
        if (!masterKey) throw new Error("Vault locked");
        await VaultService.updateEntryMetadata(id, { deletedAt: Date.now() }, masterKey);
        await loadEntries();
    }, [masterKey, loadEntries]);

    const restoreEntry = useCallback(async (id: string) => {
        if (!masterKey) throw new Error("Vault locked");
        await VaultService.updateEntryMetadata(id, { deletedAt: undefined }, masterKey);
        await loadEntries();
    }, [masterKey, loadEntries]);

    const permanentDelete = useCallback(async (id: string) => {
        await VaultService.deleteEntry(id);
        await loadEntries();
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
        await loadEntries();
    }, [entries, masterKey, loadEntries]);

    const createFolder = useCallback(async (name: string, color: string, icon: string, parentId?: string) => {
        if (!masterKey) return;
        await FolderService.createFolder(name, color, icon, parentId, masterKey);
        await loadEntries();
    }, [masterKey, loadEntries]);

    const resetVault = async () => {
        await db.vault.clear();
        await db.folders.clear();
        await loadEntries();
    };

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
