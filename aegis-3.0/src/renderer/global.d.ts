interface Aegis {
    // ==================== VAULT OPERATIONS ====================
    vault: {
        exists: () => Promise<boolean>;
        create: (password: string, mnemonicHash?: string) => Promise<any>;
        open: (password: string) => Promise<any>;
        close: () => Promise<void>;
        reset: () => Promise<void>;
        recover: (phrase: string, newPassword: string) => Promise<any>;
        setDuressPassword: (password: string) => Promise<boolean>;
        onForceLock: (callback: () => void) => void;
    };

    // ==================== DATABASE OPERATIONS ====================
    database: {
        isOpen: () => Promise<boolean>;
        getAll: () => Promise<any[]>;
        save: (entry: any) => Promise<void>;
        delete: (id: string) => Promise<void>;
        export: (options?: any) => Promise<any>;
        import: (options?: any) => Promise<any>;
        setMetadata: (key: string, value: string) => Promise<void>;
        getMetadata: (key: string) => Promise<any>;
    };

    // ==================== CRYPTOGRAPHY ====================
    crypto: {
        generatePassword: (options?: any) => Promise<string>;
        encryptPQC: (plaintext: string, publicKey: string) => Promise<string>;
        decryptPQC: (ciphertext: string, secretKey: string) => Promise<string>;
        generateKeyPair: () => Promise<{ publicKey: string; secretKey: string }>;
    };

    // ==================== BIOMETRICS & HARDWARE KEY ====================
    biometrics: {
        isAvailable: () => Promise<boolean>;
        check: () => Promise<boolean>;
    };

    fido2: {
        isAvailable: () => Promise<boolean>;
        register: (options?: { username: string; displayName?: string }) => Promise<any>;
        authenticate: (credentialId: string) => Promise<any>;
        getCredentials: () => Promise<any[]>;
        deregister: (credentialId: string) => Promise<void>;
    };

    // ==================== 2FA ====================
    totp: {
        generateSecret: (length?: number) => Promise<string>;
        generateCode: (secret: string) => Promise<string>;
        verify: (code: string, secret: string) => Promise<boolean>;
        syncTime: () => Promise<void>;
        generateBackupCodes: (count?: number, length?: number) => Promise<string[]>;
        generateOTPAuthURI: (secret: string, accountName: string, issuer?: string) => Promise<string>;
    };

    // ==================== MNEMONIC ====================
    mnemonic: {
        generate: () => Promise<string>;
        validate: (phrase: string) => Promise<boolean>;
        getEntropy: (phrase: string) => Promise<string>;
    };

    // ==================== SECURITY & AUDIT ====================
    security: {
        audit: () => Promise<any>;
        checkBreach: (target: string) => Promise<{
            breached: boolean;
            found_in: string[];
            risk_level: string;
            checked_at: number;
            source: string;
        }>;
        encryptBreachDB: (data: any) => Promise<any>;
        logEvent: (event: string, details?: any) => Promise<void>;
    };

    // ==================== EMERGENCY CONTACTS ====================
    emergency: {
        list: () => Promise<any[]>;
        save: (contact: any) => Promise<void>;
        delete: (id: string) => Promise<void>;
    };

    // ==================== P2P SYNC ====================
    p2p: {
        start: () => Promise<boolean>;
        stop: () => Promise<boolean>;
        getStatus: () => Promise<any>;
    };

    // ==================== CLOUD SYNC ====================
    cloudSync: {
        getConfig: () => Promise<any>;
        saveConfig: (config: any) => Promise<boolean>;
        test: (config: any) => Promise<boolean>;
        push: () => Promise<{ success: boolean; error?: string }>;
        pull: () => Promise<{ success: boolean; data?: any; error?: string }>;
    };

    // ==================== UPDATER ====================
    update: {
        check: () => Promise<void>;
        quitAndInstall: () => Promise<void>;
        onStatus: (callback: (status: any) => void) => void;
        onProgress: (callback: (progress: any) => void) => void;
    };

    // ==================== CLIPBOARD (SECURE) ====================
    clipboard: {
        setSecure: (text: string) => Promise<boolean>;
        clear: () => Promise<boolean>;
    };

    // ==================== WINDOW MANAGEMENT ====================
    window: {
        openVaultExplorer: () => Promise<void>;
    };

    // ==================== SYSTEM INFO ====================
    system: {
        getDeviceId: () => Promise<string>;
        getLanguage: () => string;
        getVaultStatus: () => Promise<{ status: string; pqc: boolean }>;
        reportActivity: () => Promise<void>;
        getSettings: () => Promise<any>;
        saveSettings: (settings: any) => Promise<void>;
        checkLicense: () => Promise<{
            isPremium: boolean;
            installDate: number;
            trialDaysLeft: number;
            isExpired: boolean;
            expirationDate: number;
        }>;
        activateLicense: (key: string) => Promise<{ success: boolean; error?: string }>;
    };
}

interface Window {
    aegis: Aegis;
}

declare module '*.png' {
    const value: string;
    export default value;
}

declare module '*.jpg' {
    const value: string;
    export default value;
}

declare module '*.jpeg' {
    const value: string;
    export default value;
}

declare module '*.svg' {
    const value: string;
    export default value;
}

declare module '*.gif' {
    const value: string;
    export default value;
}

declare module '*.webp' {
    const value: string;
    export default value;
}
