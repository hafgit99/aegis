export enum Category {
  LOGIN = 'Login',
  CARD = 'Credit Card',
  NOTE = 'Secure Note',
  FILE = 'Secure File',
  CRYPTO = 'Crypto Wallet',
  PASSKEY = 'Passkey'
}

export interface CustomField {
  id: string;
  label: string;
  value: string;
  isSecret: boolean;
}

export interface CardDetails {
  number: string;
  expiry: string;
  cvv: string;
  holder: string;
}

export interface CryptoDetails {
  walletName: string; // e.g. "Main MetaMask"
  network: string; // e.g. "Ethereum"
  address: string; // Public Address
  seed: string; // Mnemonic (12/24 words) - Masked UI
  privateKey?: string; // Optional
}

export interface PasskeyDetails {
  credentialId: string; // Base64URL
  publicKey: string; // Base64URL (Public Key for verification/storage)
  signCount: number;
  transports?: string[]; // e.g. ['usb', 'nfc', 'ble', 'internal']
  createdAt: number;
  rpId: string; // Relying Party ID (domain)
  displayName: string; // User-facing name for this passkey
  privateKey?: string; // Encrypted private key blob
}

export interface Folder {
  id: string;
  parentId?: string;
  color: string;
  icon: string;
  updatedAt: number;
  encryptedName: string;
  iv: string;
  tag: string;
}

export interface VaultEntry {
  id: string;
  // Metadata (şifreli olarak indexed/searchable hale getirilmiş)
  encryptedTitle: Uint8Array;
  encryptedUsername: Uint8Array;

  // Encrypted System Metadata (Category, FolderId, UpdatedAt, etc.)
  // This blob contains: { category, folderId, updatedAt, isFavorite, fileSize, deletedAt }
  encryptedMetadata?: Uint8Array;
  metadataIv?: Uint8Array;
  metadataTag?: Uint8Array;

  // Legacy/Masked Plain Fields (kept for type compatibility, but may contain dummy data)
  category: Category;
  updatedAt: number;
  deletedAt?: number;
  isFavorite?: boolean;
  folderId?: string;
  tags?: string[];

  // Metadata encryption details (binary)
  titleIv: Uint8Array;
  titleTag: Uint8Array;
  usernameIv: Uint8Array;
  usernameTag: Uint8Array;

  securityScore?: number;
  fileSize?: number;
  encryptedFile?: Uint8Array;
  fileIv?: Uint8Array;
  fileTag?: Uint8Array;

  // Sensitive data (password, notes, etc.) - binary format
  encryptedData: Uint8Array;
  iv: Uint8Array;
  tag: Uint8Array;

  // Display fields (decrypted in memory)
  title?: string;
  username?: string;
}

export interface SensitiveData {
  password?: string;
  notes?: string;
  url?: string;
  fileBlob?: string | Uint8Array;
  fileName?: string;
  fileMime?: string;
  cardDetails?: CardDetails;
  cryptoDetails?: CryptoDetails;
  passkeyDetails?: PasskeyDetails;
  customFields?: CustomField[];
}

// ==================== BREACH CHECK TYPES ====================

export interface BreachCheckResult {
  isBreached: boolean;
  strength: number;
  patterns: string[];
  breachCount?: number;
}

export interface BreachDatabaseEntry {
  hash: string; // SHA-1 hash
  count: number;
}

export interface BreachEntry {
  hash: string; // SHA-1 hash (hex, 40 chars)
  occurrenceCount: number; // How many breaches it appeared in
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface BreachDatabase {
  version: string;
  lastUpdated: number;
  source: 'haveibeenpwned-top1m' | 'custom';
  entries: BreachEntry[];
}

export interface BreachDatabaseStats {
  patternCount: number;
  initialized: boolean;
  version?: string;
  lastUpdated?: number;
  totalChecks?: number;
}

// ==================== BACKUP SYSTEM TYPES ====================

export interface BackupFile {
  id: string;
  timestamp: number;
  version: string;
  encryptedData: Uint8Array;
  iv: Uint8Array;
  tag: Uint8Array;
  checksum: string;
  size: number;
  isCloud: boolean;
  cloudProvider?: 'dropbox' | 'google' | 'onedrive' | 'custom';
  cloudPath?: string;
}

export interface BackupMetadata {
  id: string;
  timestamp: number;
  version: string;
  size: number;
  location: 'local' | 'cloud';
  cloudProvider?: string;
  verified: boolean;
}

export interface BackupVerification {
  isValid: boolean;
  checksumMatch: boolean;
  encryptionValid: boolean;
  metadataConsistent: boolean;
}

export type CloudProvider = 'dropbox' | 'google' | 'onedrive' | 'custom';

export interface CloudConfig {
  provider: CloudProvider;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface BackupSchedule {
  enabled: boolean;
  frequency: 'manual' | 'daily' | 'weekly' | 'monthly';
  lastBackup?: number;
  nextBackup?: number;
  maxBackups: number;
  cloudEnabled?: boolean;
  cloudProvider?: CloudProvider;
}

// ==================== INCIDENT RESPONSE TYPES ====================

export interface AnomalyAlert {
  id: string;
  type: 'time' | 'device' | 'location' | 'frequency' | 'behavioral';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: number;
  details: {
    [key: string]: any;
  };
}

export interface TrustedContact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  relation: string;
  publicEncryptedKey: string;
  createdAt: number;
  verified: boolean;
}

export interface EmergencyAccessGrant {
  id: string;
  contactId: string;
  reason: string;
  grantedAt: number;
  expiresAt: number;
  duration: number;
  accessLogs: EmergencyAccessLog[];
}

export interface EmergencyAccessLog {
  timestamp: number;
  action: 'granted' | 'accessed' | 'revoked' | 'expired';
  ipAddress?: string;
  deviceId?: string;
}

export interface IncidentReport {
  id: string;
  incidentType: IncidentType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  evidence: string[];
  timestamp: number;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  reportedBy?: string;
  resolvedAt?: number;
}

export type IncidentType =
  | 'unauthorized_access'
  | 'data_breach'
  | 'brute_force_attempt'
  | 'anomaly_detected'
  | 'emergency_access_used'
  | 'backup_failure'
  | 'system_tampering'
  | 'other';

// ==================== QR SHARE SYSTEM TYPES ====================

export interface QRSharePayload {
  version: "1.0";
  type: "AEGIS_SHARE";
  createdAt: number;
  expiresAt: number;

  encryptedEntry: {
    payload: string;
    iv: string;
    tag: string;
  };

  keyEncryption: {
    algorithm: "argon2id-aes256-gcm";
    salt: string;
    iterations: number;
    encryptedKey: {
      payload: string;
      iv: string;
      tag: string;
    };
  };

  metadata: {
    titleHint: string;
    category: Category;
    hasPassword: true;
    isExpired: boolean;
  };

  checksum: string;
}

export interface ChunkedPayload {
  totalChunks: number;
  chunkIndex: number;
  chunkId: string;
  data: string;
  checksum: string;
}

export interface DecryptedShareEntry {
  title: string;
  username: string;
  category: Category;
  sensitive: SensitiveData;
  folderId?: string;
  isFavorite?: boolean;
}

export type ShareErrorType =
  | 'SHARE_EXPIRED'
  | 'SHARE_TAMPERED'
  | 'PASSWORD_REQUIRED'
  | 'INVALID_SHARE_FORMAT'
  | 'NO_QR_FOUND'
  | 'PASSWORD_TOO_WEAK'
  | 'DECRYPTION_FAILED';

declare global {
  interface Window {
    electronAPI: {
      copyToClipboard: (text: string, duration?: number) => void;
      getDeviceId: () => Promise<string>;
      panicApp: () => void;
      onClipboardCleared: (callback: () => void) => void;
      onLockTrigger: (callback: () => void) => () => void;
      getAppVersion: () => string;
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      platform: string;
      vault: {
        setKey: (raw: Uint8Array, verifier?: any) => Promise<boolean>;
        clearKey: () => Promise<boolean>;
        setVerifier: (blob: any) => Promise<boolean>;
        getVerifier: () => Promise<any>;
        encrypt: (text: string) => Promise<{ ciphertext: Uint8Array; iv: Uint8Array; tag: Uint8Array }>;
        decrypt: (ciphertext: Uint8Array, iv: Uint8Array, tag: Uint8Array) => Promise<string>;
        encryptBinary: (buffer: ArrayBuffer | Uint8Array) => Promise<{ ciphertext: Uint8Array; iv: Uint8Array; tag: Uint8Array }>;
        decryptBinary: (ciphertext: Uint8Array, iv: Uint8Array, tag: Uint8Array) => Promise<Uint8Array>;
      };
      credentials: {
        saveMasterKey: (saltB64: string, keyB64: string) => Promise<boolean>;
        retrieveMasterKey: () => Promise<{ saltB64: string; keyB64: string } | null>;
        clearMasterKey: () => Promise<boolean>;
        saveBiometricSecret: (secretB64: string, tag?: string) => Promise<boolean>;
        retrieveBiometricSecret: (tag?: string) => Promise<string | null>;
        clearBiometricSecret: (tag?: string) => Promise<boolean>;
      };
      audit: {
        logEvent: (action: string, metadata?: any) => Promise<boolean>;
        flush: () => Promise<boolean>;
        getLogs: (limit?: number) => Promise<any[]>;
      };
      secureMemory: {
        lockPages: (buffer: Uint8Array) => Promise<boolean>;
        getStatus: () => Promise<{ locked: boolean; supported: boolean; native: boolean; platform: string }>;
      };
      db: {
        saveEntry: (entry: any) => Promise<any>;
        deleteEntry: (id: string) => Promise<any>;
        getEntry: (id: string) => Promise<any>;
        bulkSaveEntries: (entries: any[]) => Promise<any>;
        getAllEntries: () => Promise<any[]>;
        saveFolder: (folder: any) => Promise<any>;
        deleteFolder: (id: string) => Promise<any>;
        getAllFolders: () => Promise<any[]>;
        setConfig: (key: string, value: string) => Promise<any>;
        getConfig: (key: string) => Promise<string | null>;
      };
    };
  }
}