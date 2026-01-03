const { contextBridge, ipcRenderer } = require('electron');

console.log('[Preload] Loading preload script...');

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
  getAppVersion: () => process.env.npm_package_version,

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
  platform: process.platform,

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

  // Brute Force Protection (Server-side, tamper-proof)
  bruteforce: {
    checkStatus: (deviceId) => ipcRenderer.invoke('bruteforce:check-status', deviceId),
    recordFailure: (deviceId) => ipcRenderer.invoke('bruteforce:record-failure', deviceId),
    recordSuccess: (deviceId) => ipcRenderer.invoke('bruteforce:record-success', deviceId)
  },

  // Windows Credential Manager (Optional biometric/recovery)
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
  }
});

console.log('[Preload] electronAPI exposed to renderer');