
import Dexie, { type EntityTable } from 'dexie';
import { VaultEntry, Folder } from './types';

export const db = new Dexie('AegisVaultDB') as Dexie & {
  vault: EntityTable<VaultEntry, 'id'>;
  folders: EntityTable<Folder, 'id'>;
};

// Version 3: Changed encryption data from Base64 strings to binary (Uint8Array)
// This reduces storage size by 33% and improves performance
// Version 4: Full Record Encryption (Metadata included)
// Everything except the ID is moved into the encrypted binary blob
// Version 5: Added 'title' index to support conflict detection during import
db.version(5).stores({
  vault: 'id, title, category, updatedAt, isFavorite, folderId',
  folders: 'id, parentId'
});
