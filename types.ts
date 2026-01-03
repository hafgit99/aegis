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