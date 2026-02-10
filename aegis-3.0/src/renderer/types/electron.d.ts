export { };

declare global {
    interface AuditReport {
        score: number;
        weakEntries: string[];
        reusedEntries: { [hash: string]: string[] };
        oldEntries: string[];
        breachedEntries: string[];
        summary: {
            total: number;
            weak: number;
            reused: number;
            old: number;
            breached: number;
        };
    }

    interface Window {
        aegis: {
            vault: {
                exists: () => Promise<boolean>;
                create: (password: string, mnemonicHash?: string) => Promise<boolean>;
                open: (password: string) => Promise<{ success: boolean, isDuress: boolean }>;
                close: () => Promise<boolean>;
                reset: () => Promise<boolean>;
                recover: (phrase: string, newPassword: string) => Promise<boolean>;
                setDuressPassword: (password: string) => Promise<boolean>;
            };
            database: {
                isOpen: () => Promise<boolean>;
                getAll: () => Promise<any[]>;
                save: (entry: any) => Promise<void>;
                delete: (id: string) => Promise<void>;
                export: (options: any) => Promise<any>;
                import: (options: any) => Promise<any>;
                setMetadata: (key: string, value: string) => Promise<void>;
                getMetadata: (key: string) => Promise<string | null>;
            };
            crypto: {
                generatePassword: (options?: any) => Promise<string>;
                encryptPQC: (plaintext: string, publicKey: string) => Promise<string>;
                decryptPQC: (ciphertext: string, secretKey: string) => Promise<string>;
                generateKeyPair: () => Promise<{ publicKey: string; secretKey: string }>;
            };
            biometrics: {
                isAvailable: () => Promise<boolean>;
                check: () => Promise<boolean>;
            };
            fido2: {
                isAvailable: () => Promise<boolean>;
                register: (options?: any) => Promise<any>;
                authenticate: (credentialId: string) => Promise<boolean>;
                getCredentials: () => Promise<any[]>;
                deregister: (credentialId: string) => Promise<boolean>;
            };
            totp: {
                generateSecret: () => Promise<string>;
                verify: (code: string, secret: string) => Promise<boolean>;
                syncTime: () => Promise<void>;
            };
            mnemonic: {
                generate: () => Promise<string>;
                validate: (phrase: string) => Promise<boolean>;
                getEntropy: (phrase: string) => Promise<string>;
            };
            security: {
                audit: () => Promise<AuditReport>;
                checkBreach: (target: string) => Promise<any>;
                encryptBreachDB: (data: any) => Promise<string>;
                logEvent: (event: string, details?: any) => void;
            };
            emergency: {
                list: () => Promise<any[]>;
                save: (contact: any) => Promise<void>;
                delete: (id: string) => Promise<void>;
            };
            p2p: {
                start: () => Promise<boolean>;
                stop: () => Promise<boolean>;
                getStatus: () => Promise<{ active: boolean; status: string }>;
            };
            cloudSync: {
                getConfig: () => Promise<any>;
                saveConfig: (config: any) => Promise<boolean>;
                test: (config: any) => Promise<boolean>;
                push: () => Promise<{ success: boolean; error?: string }>;
                pull: () => Promise<{ success: boolean; data?: any; error?: string }>;
            };
            update: {
                check: () => Promise<void>;
                quitAndInstall: () => Promise<void>;
                onStatus: (callback: (status: any) => void) => void;
                onProgress: (callback: (progress: any) => void) => void;
            };
            clipboard: {
                setSecure: (text: string) => Promise<boolean>;
                clear: () => Promise<boolean>;
            };
            window: {
                openVaultExplorer: () => Promise<void>;
            };
            system: {
                getDeviceId: () => Promise<string>;
                getLanguage: () => string;
                getVaultStatus: () => Promise<{ status: string; pqc: boolean }>;
            };
        };
    }
}
