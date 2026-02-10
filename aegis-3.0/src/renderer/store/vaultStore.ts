import { create } from 'zustand';

export type EntryType = 'login' | 'note' | 'file' | 'wallet' | 'identity' | 'card' | 'license' | 'ssh';

export const PASSWORD_POLICIES = {
    standard: 'standard',
    strict: 'strict',
    pin: 'pin',
    web: 'web',
    legacy: 'legacy'
};

export interface VaultEntry {
    id: string;
    title: string;
    type: EntryType;
    website?: string;
    username?: string;
    password?: string;
    notes?: string;
    fileData?: string; // Base64 encoded encrypted file
    fileName?: string;
    fileSize?: number;
    walletAddress?: string;
    seedPhrase?: string;
    // Card
    cardNumber?: string;
    cardHolder?: string;
    expiryDate?: string;
    cvv?: string;
    // Identity
    idNumber?: string;
    fullName?: string;
    // License
    licenseKey?: string;
    version?: string;
    // SSH
    privateKey?: string;
    publicKey?: string;
    passphrase?: string;
    totpSecret?: string;
    category?: string;
    tags?: string;
    lastUsed?: string;
    strength?: 'Weak' | 'Medium' | 'Strong';
    data?: string; // Hex payload for IPC
}

interface VaultState {
    entries: VaultEntry[];
    isLocked: boolean;
    isLoading: boolean;
    isDuressMode: boolean;
    error: string | null;
    breachedEntriesCount: number;
    breachedEntryIds: string[];
    lastBreachScan: number | null;

    // Actions
    unlock: (password: string) => Promise<boolean>;
    completeLogin: () => void;
    lock: () => void;
    fetchEntries: () => Promise<void>;
    saveEntry: (entry: VaultEntry) => Promise<void>;
    moveToTrash: (entry: VaultEntry) => Promise<void>;
    restoreFromTrash: (entry: VaultEntry) => Promise<void>;
    deleteEntry: (id: string) => Promise<void>;
    generatePassword: (options?: any) => Promise<string>;
    checkBreach: (target: string) => Promise<any>;
    scanAllBreaches: (onProgress?: (current: number, total: number) => void) => Promise<number>;

    // Watchtower UI state
    watchtowerOpen: boolean;
    watchtowerCategory: 'all' | 'weak' | 'reused' | 'old' | 'breached';
    setWatchtowerOpen: (open: boolean, category?: 'all' | 'weak' | 'reused' | 'old' | 'breached') => void;

    // Editing state
    editingEntry: VaultEntry | null;
    setEditingEntry: (entry: VaultEntry | null) => void;

    addEntryModalOpen: boolean;
    setAddEntryModalOpen: (open: boolean) => void;

    // License state
    licenseStatus: {
        isPremium: boolean;
        trialDaysLeft: number;
        isExpired: boolean;
        expirationDate: number;
    } | null;
    checkLicense: () => Promise<void>;
    activateLicense: (key: string) => Promise<{ success: boolean; error?: string }>;
}

// Şifre gücü hesaplama fonksiyonu
function calculatePasswordStrength(password: string): 'Weak' | 'Medium' | 'Strong' {
    if (!password) return 'Weak';

    let score = 0;

    // Uzunluk kontrolü
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;

    // Karakter çeşitliliği kontrolü
    if (/[a-z]/.test(password)) score += 1; // Küçük harf
    if (/[A-Z]/.test(password)) score += 1; // Büyük harf
    if (/[0-9]/.test(password)) score += 1; // Rakam
    if (/[^a-zA-Z0-9]/.test(password)) score += 1; // Özel karakter

    // Skor değerlendirmesi
    if (score >= 6) return 'Strong';
    if (score >= 4) return 'Medium';
    return 'Weak';
}

export const useVaultStore = create<VaultState>((set, get) => ({
    entries: [],
    isLocked: true,
    isLoading: false,
    isDuressMode: false,
    error: null,
    breachedEntriesCount: 0,
    breachedEntryIds: [],
    lastBreachScan: null,
    watchtowerOpen: false,
    watchtowerCategory: 'all',
    licenseStatus: null,

    setWatchtowerOpen: (open, category) => {
        set({ watchtowerOpen: open, watchtowerCategory: category || 'all' });
    },

    checkLicense: async () => {
        try {
            const status = await window.aegis.system.checkLicense();
            set({ licenseStatus: status });
        } catch (err) {
            console.error('License check failed:', err);
        }
    },

    activateLicense: async (key: string) => {
        try {
            const result = await window.aegis.system.activateLicense(key);
            if (result.success) {
                await get().checkLicense();
            }
            return result;
        } catch (err: any) {
            return { success: false, error: err.message };
        }
    },

    editingEntry: null,
    setEditingEntry: (entry) => set({ editingEntry: entry }),

    addEntryModalOpen: false,
    setAddEntryModalOpen: (open) => set({ addEntryModalOpen: open }),

    unlock: async (password: string) => {
        set({ isLoading: true, error: null });
        try {
            const result = await window.aegis.vault.open(password);
            if (result.success === true) {
                // Vault is open, but UI remains locked until 2FA is verified (if enabled)
                // We fetch entries so we can check metadata for 2FA settings from the LockScreen
                await get().fetchEntries();
                set({ isDuressMode: result.isDuress, isLoading: false });
                return true;
            }
            set({ isLoading: false, error: 'Hatalı şifre veya veritabanı açılamadı.' });
            return false;
        } catch (err: any) {
            console.error('Unlock error:', err);
            set({ error: err.message || 'Bilinmeyen bir hata oluştu', isLoading: false });
            return false;
        }
    },

    completeLogin: () => {
        set({ isLocked: false });
    },

    lock: () => {
        set({ isLocked: true, entries: [], breachedEntriesCount: 0, breachedEntryIds: [], lastBreachScan: null, isLoading: false, error: null });
    },

    fetchEntries: async () => {
        set({ isLoading: true });
        try {
            const rawEntries = await window.aegis.database.getAll();
            console.log('[STORE] Entries fetched:', rawEntries.length);

            const entriesWithStrength = rawEntries.map((entry: VaultEntry) => {
                if (entry.type === 'login' && entry.password) {
                    const strength = calculatePasswordStrength(entry.password);
                    return { ...entry, strength };
                }
                return entry;
            });

            console.log('[STORE] Entries with strength calculated');
            set({ entries: entriesWithStrength, isLoading: false });
        } catch (err: any) {
            console.error('[STORE] Fetch error:', err);
            set({ error: err.message, isLoading: false });
        }
    },

    saveEntry: async (entry: VaultEntry) => {
        try {
            await window.aegis.database.save(entry);
            await get().fetchEntries();
        } catch (err: any) {
            set({ error: err.message });
            throw err;
        }
    },

    moveToTrash: async (entry: VaultEntry) => {
        try {
            const trashEntry = {
                ...entry,
                category: 'Trash',
                deletedAt: Date.now()
            };
            await window.aegis.database.save(trashEntry);
            await get().fetchEntries();
        } catch (err: any) {
            set({ error: err.message });
            throw err;
        }
    },

    restoreFromTrash: async (entry: VaultEntry) => {
        try {
            const restoredEntry = {
                ...entry,
                category: 'Genel',
                deletedAt: undefined
            };
            await window.aegis.database.save(restoredEntry);
            await get().fetchEntries();
        } catch (err: any) {
            set({ error: err.message });
            throw err;
        }
    },

    deleteEntry: async (id: string) => {
        try {
            await window.aegis.database.delete(id);
            await get().fetchEntries();
        } catch (err: any) {
            set({ error: err.message });
            throw err;
        }
    },

    generatePassword: async (options) => {
        return window.aegis.crypto.generatePassword(options);
    },

    checkBreach: async (target) => {
        // target can be email or password
        return window.aegis.security.checkBreach(target);
    },

    scanAllBreaches: async (onProgress?: (current: number, total: number) => void) => {
        const { entries } = get();
        const loginEntries = entries.filter(e => e.type === 'login' && e.password && e.category !== 'Trash');
        let breachedCount = 0;
        const breachedIds: string[] = [];
        const total = loginEntries.length;

        // Perform scan in background
        for (let i = 0; i < total; i++) {
            const entry = loginEntries[i];
            try {
                const result = await window.aegis.security.checkBreach(entry.password || '') as any;
                if (result && result.breached) {
                    breachedCount++;
                    breachedIds.push(entry.id);
                }
            } catch (err) {
                console.error('Scan error for:', entry.title, err);
            }

            if (onProgress) {
                onProgress(i + 1, total);
            }

            // Small delay to avoid blocking or rate limiting too hard
            await new Promise(r => setTimeout(r, 50));
        }

        set({ breachedEntriesCount: breachedCount, breachedEntryIds: breachedIds, lastBreachScan: Date.now() });
        return breachedCount;
    }

}));

