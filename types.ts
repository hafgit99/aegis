export enum Category {
  LOGIN = 'Login',
  CARD = 'Credit Card',
  NOTE = 'Secure Note',
  FILE = 'Secure File',
  CRYPTO = 'Crypto Wallet'
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