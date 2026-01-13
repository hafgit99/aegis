const { contextBridge, ipcRenderer } = require('electron');

console.log('[Preload] Loading Aegis Secure Preload (CJS)...');

contextBridge.exposeInMainWorld('electronAPI', {
    // Pano İşlemleri
    copyToClipboard: (text, duration) => ipcRenderer.send('clipboard:write', text, duration),

    // Donanım Kimliği
    getDeviceId: () => ipcRenderer.invoke('get-device-id'),

    // Panik Butonu Sinyali
    panicApp: () => ipcRenderer.send('vault:panic'),

    // Olay Dinleyicileri
    onClipboardCleared: (callback) => ipcRenderer.on('clipboard:cleared', (_event, value) => callback(value)),
    onLockTrigger: (callback) => {
        const subscription = (_event) => callback();
        ipcRenderer.on('vault:lock-trigger', subscription);
        return () => ipcRenderer.removeListener('vault:lock-trigger', subscription);
    },

    // Uygulama Bilgileri
    getAppVersion: () => "1.1.1",

    // Pencere Kontrolleri
    minimize: () => {
        console.log('[Preload] minimize() called');
        ipcRenderer.send('window:minimize');
    },
    maximize: () => {
        console.log('[Preload] maximize() called');
        ipcRenderer.send('window:maximize');
    },
    close: () => {
        console.log('[Preload] close() called');
        ipcRenderer.send('window:close');
    },

    // Platform Bilgisi
    platform: 'win32',

    // Secure Vault Crypto (IPC)
    vault: {
        setKey: (raw) => ipcRenderer.invoke('vault:set-key', raw),
        clearKey: () => ipcRenderer.invoke('vault:clear-key'),
        setVerifier: (blob) => ipcRenderer.invoke('vault:set-verifier', blob),
        getVerifier: () => ipcRenderer.invoke('vault:get-verifier'),
        encrypt: (text) => ipcRenderer.invoke('vault:encrypt', text),
        decrypt: (ciphertext, iv, tag) => ipcRenderer.invoke('vault:decrypt', ciphertext, iv, tag),
        encryptBinary: (buffer) => ipcRenderer.invoke('vault:encrypt-binary', buffer),
        decryptBinary: (ciphertext, iv, tag) => ipcRenderer.invoke('vault:decrypt-binary', ciphertext, iv, tag)
    },

    // Brute Force Protection
    bruteforce: {
        checkStatus: (deviceId) => ipcRenderer.invoke('bruteforce:check-status', deviceId),
        recordFailure: (deviceId) => ipcRenderer.invoke('bruteforce:record-failure', deviceId),
        recordSuccess: (deviceId) => ipcRenderer.invoke('bruteforce:record-success', deviceId)
    },

    // Windows Credential Manager
    credentials: {
        saveMasterKey: (saltB64, keyB64) => ipcRenderer.invoke('credentials:save-master-key', saltB64, keyB64),
        retrieveMasterKey: () => ipcRenderer.invoke('credentials:retrieve-master-key'),
        clearMasterKey: () => ipcRenderer.invoke('credentials:clear-master-key'),
        saveBiometricSecret: (secretB64) => ipcRenderer.invoke('credentials:save-biometric-secret', secretB64),
        retrieveBiometricSecret: () => ipcRenderer.invoke('credentials:retrieve-biometric-secret'),
        clearBiometricSecret: () => ipcRenderer.invoke('credentials:clear-biometric-secret')
    },

    // Audit Logging
    audit: {
        logEvent: (action, metadata) => ipcRenderer.invoke('audit:log-event', action, metadata),
        flush: () => ipcRenderer.invoke('audit:flush'),
        getLogs: (limit) => ipcRenderer.invoke('audit:get-logs', limit)
    },

    // Secure Memory Control
    secureMemory: {
        lockPages: () => ipcRenderer.invoke('secure-memory:lock-pages'),
        getStatus: () => ipcRenderer.invoke('secure-memory:get-status')
    },

    // Browser Extension Integration
    extension: {
        onSearch: (callback) => ipcRenderer.on('extension:search', callback),
        onGetCreds: (callback) => ipcRenderer.on('extension:get-creds', callback),
        sendResult: (id, data) => ipcRenderer.send(`extension:${id}`, data),
    },

    // Backup System
    backup: {
        saveLocalBackup: (backup) => ipcRenderer.invoke('backup:saveLocalBackup', backup),
        listLocalBackups: () => ipcRenderer.invoke('backup:listLocalBackups'),
        deleteBackup: (id, location) => ipcRenderer.invoke('backup:deleteBackup', id, location),
        schedule: (config) => ipcRenderer.invoke('backup:schedule', config),
        clearAllBackups: () => ipcRenderer.invoke('backup:clearAllBackups'),
        selectDirectory: () => ipcRenderer.invoke('backup:select-directory'),
        getDefaultPath: () => ipcRenderer.invoke('backup:get-default-path')
    },

    // SQLite Veritabanı (db) - EN SONDA
    db: {
        saveEntry: (entry) => ipcRenderer.invoke('db:save-entry', entry),
        deleteEntry: (id) => ipcRenderer.invoke('db:delete-entry', id),
        getEntry: (id) => ipcRenderer.invoke('db:get-entry', id),
        bulkSaveEntries: (entries) => ipcRenderer.invoke('db:bulk-save-entries', entries),
        getAllEntries: () => ipcRenderer.invoke('db:get-all-entries'),
        saveFolder: (folder) => ipcRenderer.invoke('db:save-folder', folder),
        deleteFolder: (id) => ipcRenderer.invoke('db:delete-folder', id),
        getAllFolders: () => ipcRenderer.invoke('db:get-all-folders'),
        setConfig: (key, value) => ipcRenderer.invoke('db:set-config', key, value),
        getConfig: (key) => ipcRenderer.invoke('db:get-config', key)
    }
});

console.log('[Preload] electronAPI exposed to renderer successfully (WITH DB)');
