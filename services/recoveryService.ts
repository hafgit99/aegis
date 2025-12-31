import { CryptoService } from './cryptoService';

const RECOVERY_WORDS_POOL = [
  "alpha", "bravo", "delta", "echo", "foxtrot", "golf", "hotel", "india", "juliet", "kilo", "lima", "mike", "november", "oscar", "papa", "quebec", "romeo", "sierra", "tango", "uniform", "victor", "whiskey", "xray", "yankee", "zulu",
  "apple", "bridge", "cloud", "dance", "eagle", "forest", "giant", "honey", "island", "jungle", "knight", "lemon", "mountain", "night", "ocean", "planet", "queen", "river", "silver", "tiger", "under", "valley", "winter", "yellow", "zebra",
  "nebula", "cipher", "matrix", "shield", "nexus", "orbit", "quantum", "vector", "zenith", "apex", "beacon", "crypto", "ether", "flux", "glitch", "hazard", "ion", "jolt", "kinetic", "lunar", "marrow", "neon", "oxide", "plasma", "radar"
];

const encoder = new TextEncoder();

// Recovery words versioning
const RECOVERY_VERSION = "4.0";
const RECOVERY_WORDS_COUNT = 16;
const RECOVERY_STORAGE_KEY = 'aegis_recovery_blob';
const RECOVERY_HASH_KEY = 'aegis_recovery_hash';
const RECOVERY_METADATA_KEY = 'aegis_recovery_metadata';

export interface RecoveryMetadata {
  version: string;
  timestamp: number;
  deviceId: string;
  wordCount: number;
  checksum: string;
  createdAt: number;
  lastVerified?: number;
  verificationCount: number;
  isActive: boolean;
}

export interface RecoveryBackup {
  payload: string; // encrypted
  iv: string;
  tag: string;
  metadata: RecoveryMetadata;
}

// SECURITY: Helper to get device ID (same as Electron main.js)
async function getDeviceIdFromElectron(): Promise<string> {
  if ((window as any).electronAPI?.getDeviceId) {
    return await (window as any).electronAPI.getDeviceId();
  }
  // Fallback for testing
  return "AEGIS-LOCAL-TEST-DEVICE";
}

// Calculate checksum of words for integrity verification
function calculateWordsChecksum(words: string[]): string {
  const combined = words.join('');
  const data = new TextEncoder().encode(combined);
  // Simple checksum (not cryptographic, just for UI feedback)
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    hash = ((hash << 5) - hash) + data[i];
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16);
}

// Validate recovery words format
export function validateRecoveryWords(words: string[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!words || !Array.isArray(words)) {
    return { valid: false, errors: ['Words must be an array'] };
  }

  if (words.length !== RECOVERY_WORDS_COUNT) {
    errors.push(`Expected ${RECOVERY_WORDS_COUNT} words, got ${words.length}`);
  }

  const invalidWords = words.filter(w => !RECOVERY_WORDS_POOL.includes(w.toLowerCase().trim()));
  if (invalidWords.length > 0) {
    errors.push(`Invalid words found: ${invalidWords.join(', ')}`);
  }

  const duplicates = words.filter((w, i) => words.indexOf(w) !== i);
  if (duplicates.length > 0) {
    errors.push(`Duplicate words not recommended: ${[...new Set(duplicates)].join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Generate recovery PIN (optional 4-6 digit PIN)
export function generateRecoveryPIN(): string {
  const array = new Uint32Array(1);
  window.crypto.getRandomValues(array);
  const pin = (array[0] % 1000000).toString().padStart(6, '0');
  return pin;
}

// Hash recovery PIN for secure storage
async function hashRecoveryPIN(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  return CryptoService.arrayBufferToBase64(hashBuffer);
}

export class RecoveryService {
  static generateWords(): string[] {
    const array = new Uint32Array(RECOVERY_WORDS_COUNT);
    window.crypto.getRandomValues(array);
    return Array.from(array).map(val => RECOVERY_WORDS_POOL[val % RECOVERY_WORDS_POOL.length]);
  }

  static async deriveKeyFromWords(words: string[], deviceId?: string): Promise<CryptoKey> {
    const cleanWords = words
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length > 0);

    if (cleanWords.length !== RECOVERY_WORDS_COUNT) {
      throw new Error("INVALID_WORD_COUNT");
    }

    const combined = cleanWords.join(' ');

    // SECURITY: Include device ID in salt for device-specific recovery
    const device = deviceId || await getDeviceIdFromElectron();
    const salt = encoder.encode(`aegis_vault_recovery_device_${device}_argon2id_${RECOVERY_VERSION}_secure`);

    // CryptoService üzerinden Argon2id kullanarak anahtar türetiyoruz
    return await CryptoService.deriveKeyFromPassword(combined, salt);
  }

  static async setupRecovery(masterKey: CryptoKey, pinProtection?: boolean): Promise<{ 
    words: string[];
    pin?: string;
    checksum: string;
  }> {
    if (!masterKey) throw new Error("MASTER_KEY_MISSING");

    try {
      const words = this.generateWords();
      const deviceId = await getDeviceIdFromElectron();
      const recoveryKey = await this.deriveKeyFromWords(words, deviceId);
      const checksum = calculateWordsChecksum(words);

      // SECURITY: Encrypt master key with recovery key
      const recoveryKeyMaterial = await window.crypto.subtle.exportKey('raw', masterKey);
      const recoveryKeyB64 = CryptoService.arrayBufferToBase64(recoveryKeyMaterial);

      const { ciphertext, iv, tag } = await CryptoService.encrypt(recoveryKeyB64, recoveryKey);

      // Generate optional PIN protection
      let pin: string | undefined;
      let pinHash: string | undefined;
      if (pinProtection) {
        pin = generateRecoveryPIN();
        pinHash = await hashRecoveryPIN(pin);
      }

      const metadata: RecoveryMetadata = {
        version: RECOVERY_VERSION,
        timestamp: Date.now(),
        deviceId: deviceId,
        wordCount: RECOVERY_WORDS_COUNT,
        checksum: checksum,
        createdAt: Date.now(),
        verificationCount: 0,
        isActive: true
      };

      const backup: RecoveryBackup = {
        payload: CryptoService.arrayBufferToBase64(ciphertext.buffer),
        iv: CryptoService.arrayBufferToBase64(iv.buffer),
        tag: CryptoService.arrayBufferToBase64(tag.buffer),
        metadata: metadata
      };

      localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(backup));
      localStorage.setItem(RECOVERY_METADATA_KEY, JSON.stringify(metadata));
      
      if (pinHash) {
        localStorage.setItem(RECOVERY_HASH_KEY, pinHash);
      }

      // AUDIT: Log recovery setup
      if ((window as any).electronAPI?.audit) {
        await (window as any).electronAPI.audit.logEvent('RECOVERY_WORDS_GENERATED', {
          timestamp: Date.now(),
          version: RECOVERY_VERSION,
          checksum: checksum,
          pinProtected: !!pin
        });
      }

      // SECURITY: Do NOT store recovery words in localStorage
      // Return to user for manual backup only
      return { 
        words,
        pin: pin,
        checksum: checksum
      };
    } catch (e: any) {
      console.error("Kurtarma kurulumu başarısız:", e);
      throw new Error(e.message || "RECOVERY_SETUP_FAILED");
    }
  }

  static getRecoveryMetadata(): RecoveryMetadata | null {
    const metadata = localStorage.getItem(RECOVERY_METADATA_KEY);
    return metadata ? JSON.parse(metadata) : null;
  }

  static async verifyRecoveryPIN(pin: string): Promise<boolean> {
    const storedHash = localStorage.getItem(RECOVERY_HASH_KEY);
    if (!storedHash) return true; // No PIN protection
    
    const providedHash = await hashRecoveryPIN(pin);
    const isValid = providedHash === storedHash;
    
    if (isValid) {
      // Update last verified timestamp
      const metadata = this.getRecoveryMetadata();
      if (metadata) {
        metadata.lastVerified = Date.now();
        metadata.verificationCount = (metadata.verificationCount || 0) + 1;
        localStorage.setItem(RECOVERY_METADATA_KEY, JSON.stringify(metadata));
      }
    }
    
    return isValid;
  }

  // Verify recovery checksum matches current metadata
  static verifyChecksumIntegrity(words: string[], expectedChecksum: string): boolean {
    const calculatedChecksum = calculateWordsChecksum(words);
    return calculatedChecksum === expectedChecksum;
  }

  // Get recovery status and metadata
  static getRecoveryStatus(): { 
    isSetup: boolean; 
    metadata?: RecoveryMetadata;
    needsVerification: boolean;
    daysUntilVerificationNeeded?: number;
  } {
    const metadata = this.getRecoveryMetadata();
    if (!metadata) {
      return { isSetup: false, needsVerification: false };
    }

    const daysSinceCreation = (Date.now() - (metadata.createdAt || metadata.timestamp)) / (1000 * 60 * 60 * 24);
    const needsVerification = !metadata.lastVerified || daysSinceCreation > 90;
    
    return {
      isSetup: true,
      metadata,
      needsVerification,
      daysUntilVerificationNeeded: needsVerification ? 0 : Math.ceil(90 - daysSinceCreation)
    };
  }

  // Reset recovery (clear all recovery data)
  static resetRecovery(): boolean {
    try {
      localStorage.removeItem(RECOVERY_STORAGE_KEY);
      localStorage.removeItem(RECOVERY_HASH_KEY);
      localStorage.removeItem(RECOVERY_METADATA_KEY);

      // AUDIT: Log recovery reset
      if ((window as any).electronAPI?.audit) {
        (window as any).electronAPI.audit.logEvent('RECOVERY_WORDS_RESET', {
          timestamp: Date.now()
        }).catch(() => {});
      }

      return true;
    } catch (e) {
      console.error("Kurtarma sıfırlama başarısız:", e);
      return false;
    }
  }

  // Export recovery data as encrypted JSON
  static exportRecoveryAsJSON(): string {
    const backup = localStorage.getItem(RECOVERY_STORAGE_KEY);
    const metadata = localStorage.getItem(RECOVERY_METADATA_KEY);
    
    if (!backup || !metadata) {
      throw new Error("RECOVERY_NOT_SETUP");
    }

    const exportData = {
      version: "4.0",
      exportedAt: new Date().toISOString(),
      backup: JSON.parse(backup),
      // DO NOT export words or PIN - only encrypted backup
      _notice: "This backup contains encrypted recovery data. Keep it safe and offline."
    };

    return JSON.stringify(exportData, null, 2);
  }

  // Import recovery data from JSON
  static async importRecoveryFromJSON(jsonData: string): Promise<{ success: boolean; message: string }> {
    try {
      const data = JSON.parse(jsonData);
      
      if (!data.backup || !data.backup.metadata) {
        throw new Error("INVALID_BACKUP_FORMAT");
      }

      const backup = data.backup;
      localStorage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(backup));
      localStorage.setItem(RECOVERY_METADATA_KEY, JSON.stringify(backup.metadata));

      // AUDIT: Log recovery import
      if ((window as any).electronAPI?.audit) {
        (window as any).electronAPI.audit.logEvent('RECOVERY_WORDS_IMPORTED', {
          timestamp: Date.now(),
          version: backup.metadata.version
        }).catch(() => {});
      }

      return { 
        success: true, 
        message: "Recovery data imported successfully" 
      };
    } catch (e: any) {
      return { 
        success: false, 
        message: e.message || "IMPORT_FAILED" 
      };
    }
  }

  // Validate device binding for recovery
  static async validateDeviceBinding(): Promise<{ 
    isValid: boolean; 
    currentDevice: string;
    recoveryDevice: string;
  }> {
    const metadata = this.getRecoveryMetadata();
    const currentDevice = await getDeviceIdFromElectron();

    if (!metadata) {
      return {
        isValid: false,
        currentDevice,
        recoveryDevice: "NOT_SET"
      };
    }

    return {
      isValid: currentDevice === metadata.deviceId,
      currentDevice,
      recoveryDevice: metadata.deviceId
    };
  }

  static async deriveKeyFromWordsLegacy(words: string[]): Promise<CryptoKey> {
    const combined = words.join(' ');
    const salt = encoder.encode("aegis_vault_recovery_v1_fixed_salt_2025_secure");

    const keyMaterial = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(combined),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 600000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  static async recoverVault(words: string[], pin?: string): Promise<CryptoKey> {
    // Validate words format first
    const validation = validateRecoveryWords(words);
    if (!validation.valid) {
      throw new Error(`INVALID_RECOVERY_WORDS: ${validation.errors.join('; ')}`);
    }

    // Check PIN if required
    if (localStorage.getItem(RECOVERY_HASH_KEY) && !pin) {
      throw new Error("PIN_REQUIRED");
    }

    if (pin && !(await this.verifyRecoveryPIN(pin))) {
      throw new Error("INVALID_PIN");
    }

    const blobStr = localStorage.getItem(RECOVERY_STORAGE_KEY);
    if (!blobStr) throw new Error("NO_RECOVERY_BLOB");

    const blob: RecoveryBackup = JSON.parse(blobStr);

    // Verify device ID match for v4.0+
    if (blob.metadata.version === RECOVERY_VERSION) {
      const currentDeviceId = await getDeviceIdFromElectron();
      if (blob.metadata.deviceId !== currentDeviceId) {
        throw new Error("RECOVERY_DEVICE_MISMATCH");
      }
    }

    const ciphertext = CryptoService.base64ToArrayBuffer(blob.payload);
    const iv = new Uint8Array(CryptoService.base64ToArrayBuffer(blob.iv));
    const tag = new Uint8Array(CryptoService.base64ToArrayBuffer(blob.tag));

    // Try modern method first (v4.0 / v3.0)
    try {
      const deviceId = await getDeviceIdFromElectron();
      const recoveryKey = await this.deriveKeyFromWords(words, deviceId);
      const decryptedRawKeyB64 = await CryptoService.decrypt(
        new Uint8Array(ciphertext),
        recoveryKey,
        iv,
        tag
      );
      const rawKey = CryptoService.base64ToArrayBuffer(decryptedRawKeyB64);
      return await window.crypto.subtle.importKey(
        'raw',
        rawKey,
        { name: 'AES-GCM' },
        true,
        ['encrypt', 'decrypt']
      );
    } catch (e) {
      // Try legacy method (v2.1)
      try {
        const legacyKey = await this.deriveKeyFromWordsLegacy(words);
        const decryptedRawKeyB64 = await CryptoService.decrypt(
          new Uint8Array(ciphertext),
          legacyKey,
          iv,
          tag
        );
        const rawKey = CryptoService.base64ToArrayBuffer(decryptedRawKeyB64);
        return await window.crypto.subtle.importKey(
          'raw',
          rawKey,
          { name: 'AES-GCM' },
          true,
          ['encrypt', 'decrypt']
        );
      } catch (legacyErr) {
        throw new Error("RECOVERY_AUTH_FAILED");
      }
    }
  }

  static isSetup(): boolean {
    return !!localStorage.getItem(RECOVERY_STORAGE_KEY);
  }
}