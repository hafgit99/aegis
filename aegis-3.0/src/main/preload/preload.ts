/**
 * Aegis Vault 3.0 - Security-Enhanced Preload Script
 *
 * This script runs in a privileged context and exposes a secure API to the renderer.
 * It implements strict validation and sanitization to prevent security issues.
 */

import { contextBridge, ipcRenderer } from 'electron';

// SECURITY: Define the exact API that will be exposed to the renderer
// This prevents any unintended access to Node.js or Electron APIs

// Audit logging helper (security event tracking)
async function logSecurityEvent(event: string, details?: any) {
    try {
        await ipcRenderer.invoke('security:log-event', event, details);
    } catch (error) {
        // Silent fail to not disrupt user experience
        console.error('[PRELOAD] Failed to log security event:', error);
    }
}

// Input validation helpers
function validateString(input: unknown, fieldName: string): string {
    if (typeof input !== 'string') {
        throw new Error(`${fieldName} must be a string`);
    }
    if (input.length > 10000) {
        throw new Error(`${fieldName} is too long`);
    }
    return input;
}

// Secure API exposed to renderer
const aegisAPI = {
    // ==================== VAULT OPERATIONS ====================
    vault: {
        exists: () => ipcRenderer.invoke('vault:exists'),
        create: (password: string, mnemonicHash?: string) =>
            ipcRenderer.invoke('vault:create', validateString(password, 'password'), mnemonicHash),
        open: (password: string) => {
            logSecurityEvent('vault:open_attempt');
            return ipcRenderer.invoke('vault:open', validateString(password, 'password'));
        },
        close: () => ipcRenderer.invoke('db:close'),
        reset: () => ipcRenderer.invoke('vault:reset'),
        recover: (phrase: string, newPassword: string) =>
            ipcRenderer.invoke('vault:recover', validateString(phrase, 'phrase'), validateString(newPassword, 'newPassword')),
        setDuressPassword: (password: string) =>
            ipcRenderer.invoke('vault:set-duress-password', validateString(password, 'password')),
        onForceLock: (callback: () => void) => {
            ipcRenderer.on('vault:force-lock', () => callback());
        }
    },

    // ==================== DATABASE OPERATIONS ====================
    database: {
        isOpen: () => ipcRenderer.invoke('db:is-open'),
        getAll: () => ipcRenderer.invoke('db:get-all'),
        save: (entry: any) => ipcRenderer.invoke('db:save', entry),
        delete: (id: string) => ipcRenderer.invoke('db:delete', validateString(id, 'id')),
        export: (options?: any) => ipcRenderer.invoke('db:export', options),
        import: (options?: any) => ipcRenderer.invoke('db:import', options),
        setMetadata: (key: string, value: string) =>
            ipcRenderer.invoke('db:set-metadata', validateString(key, 'key'), validateString(value, 'value')),
        getMetadata: (key: string) => ipcRenderer.invoke('db:get-metadata', validateString(key, 'key')),
    },

    // ==================== CRYPTOGRAPHY ====================
    crypto: {
        generatePassword: (options?: any) => ipcRenderer.invoke('password:generate', options),
        encryptPQC: (plaintext: string, publicKey: string) =>
            ipcRenderer.invoke('pqc:encrypt', validateString(plaintext, 'plaintext'), validateString(publicKey, 'publicKey')),
        decryptPQC: (ciphertext: string, secretKey: string) =>
            ipcRenderer.invoke('pqc:decrypt', validateString(ciphertext, 'ciphertext'), validateString(secretKey, 'secretKey')),
        generateKeyPair: () => ipcRenderer.invoke('pqc:generate-keypair'),
    },

    // ==================== BIOMETRICS & HARDWARE KEY ====================
    biometrics: {
        isAvailable: () => ipcRenderer.invoke('biometric:available'),
        check: () => ipcRenderer.invoke('biometric:check'),
    },
    fido2: {
        isAvailable: () => ipcRenderer.invoke('fido2:is-available'),
        register: (options: { username: string; displayName?: string }) =>
            ipcRenderer.invoke('fido2:register', options),
        authenticate: (credentialId: string) =>
            ipcRenderer.invoke('fido2:authenticate', validateString(credentialId, 'credentialId')),
        getCredentials: () => ipcRenderer.invoke('fido2:get-credentials'),
        deregister: (credentialId: string) =>
            ipcRenderer.invoke('fido2:deregister', validateString(credentialId, 'credentialId')),
    },

    // ==================== 2FA ====================
    totp: {
        generateSecret: (length?: number) => ipcRenderer.invoke('2fa:generate-secret', length),
        generateCode: (secret: string) => ipcRenderer.invoke('2fa:generate-code', validateString(secret, 'secret')),
        verify: (code: string, secret: string) =>
            ipcRenderer.invoke('2fa:verify', validateString(code, 'code'), validateString(secret, 'secret')),
        syncTime: () => ipcRenderer.invoke('2fa:sync-time'),
        generateBackupCodes: (count?: number, length?: number) => ipcRenderer.invoke('2fa:generate-backup-codes', count, length),
        generateOTPAuthURI: (secret: string, accountName: string, issuer?: string) =>
            ipcRenderer.invoke('2fa:generate-otpauth-uri', validateString(secret, 'secret'), validateString(accountName, 'accountName'), issuer),
    },

    // ==================== MNEMONIC ====================
    mnemonic: {
        generate: () => ipcRenderer.invoke('mnemonic:generate'),
        validate: (phrase: string) => ipcRenderer.invoke('mnemonic:validate', validateString(phrase, 'phrase')),
        getEntropy: (phrase: string) => ipcRenderer.invoke('mnemonic:entropy', validateString(phrase, 'phrase')),
    },

    // ==================== SECURITY & AUDIT ====================
    security: {
        audit: () => ipcRenderer.invoke('security:audit'),
        checkBreach: (target: string) => {
            logSecurityEvent('breach:check', { targetLength: target?.length });
            return ipcRenderer.invoke('security:check-breach', validateString(target, 'target'));
        },
        encryptBreachDB: (data: any) => ipcRenderer.invoke('security:encrypt-breach-db', data),
        logEvent: (event: string, details?: any) => logSecurityEvent(event, details),
    },

    // ==================== EMERGENCY CONTACTS ====================
    emergency: {
        list: () => ipcRenderer.invoke('emergency:list'),
        save: (contact: any) => ipcRenderer.invoke('emergency:save', contact),
        delete: (id: string) => ipcRenderer.invoke('emergency:delete', validateString(id, 'id')),
    },

    // ==================== P2P SYNC ====================
    p2p: {
        start: () => ipcRenderer.invoke('p2p:start'),
        stop: () => ipcRenderer.invoke('p2p:stop'),
        getStatus: () => ipcRenderer.invoke('p2p:status'),
    },

    // ==================== CLOUD SYNC ====================
    cloudSync: {
        getConfig: () => ipcRenderer.invoke('sync:get-config'),
        saveConfig: (config: any) => ipcRenderer.invoke('sync:save-config', config),
        test: (config: any) => ipcRenderer.invoke('sync:test', config),
        push: () => ipcRenderer.invoke('sync:push'),
        pull: () => ipcRenderer.invoke('sync:pull'),
    },

    // ==================== AUTO UPDATE ====================
    update: {
        check: () => ipcRenderer.invoke('update:check'),
        quitAndInstall: () => ipcRenderer.invoke('update:quit-and-install'),
        onStatus: (callback: (status: any) => void) =>
            ipcRenderer.on('update:status', (_event, status) => callback(status)),
        onProgress: (callback: (progress: any) => void) =>
            ipcRenderer.on('update:download-progress', (_event, progress) => callback(progress)),
    },

    // ==================== CLIPBOARD (SECURE) ====================
    clipboard: {
        setSecure: (text: string) => {
            logSecurityEvent('clipboard:write', { length: text?.length });
            return ipcRenderer.invoke('clipboard:set-secure', validateString(text, 'text'));
        },
        clear: () => ipcRenderer.invoke('clipboard:clear'),
    },

    // ==================== WINDOW MANAGEMENT ====================
    window: {
        openVaultExplorer: () => ipcRenderer.invoke('window:open-vault-explorer'),
    },

    // ==================== SYSTEM & SETTINGS ====================
    system: {
        getDeviceId: () => ipcRenderer.invoke('system:get-device-id'),
        getLanguage: () => {
            try {
                return localStorage.getItem('language') || 'en';
            } catch (e) {
                return 'en';
            }
        },
        getVaultStatus: () => ipcRenderer.invoke('get-vault-status'),
        reportActivity: () => ipcRenderer.invoke('activity:report'),
        getSettings: () => ipcRenderer.invoke('settings:get'),
        saveSettings: (settings: any) => ipcRenderer.invoke('settings:save', settings),
        checkLicense: () => ipcRenderer.invoke('license:check'),
        activateLicense: (key: string) => ipcRenderer.invoke('license:activate', key),
    },
};

// Expose the protected API to the renderer process
// SECURITY: This is the ONLY bridge between renderer and main process
contextBridge.exposeInMainWorld('aegis', aegisAPI);

// SECURITY: Remove dangerous globals
delete (window as any).require;
delete (window as any).module;
delete (window as any).process;

// Log successful preload
console.info('[PRELOAD] Secure API exposed to renderer');
