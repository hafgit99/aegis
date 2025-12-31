
export enum Category {
  LOGIN = 'Login',
  CARD = 'Credit Card',
  NOTE = 'Secure Note',
  FILE = 'Secure File'
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
  customFields?: CustomField[];
}