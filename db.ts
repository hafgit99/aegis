
import Dexie, { type EntityTable } from 'dexie';
import { VaultEntry, Folder } from './types';

export const db = new Dexie('AegisVaultDB') as Dexie & {
  vault: EntityTable<VaultEntry, 'id'>;
  folders: EntityTable<Folder, 'id'>;
};

// Version 3: Changed encryption data from Base64 strings to binary (Uint8Array)
// This reduces storage size by 33% and improves performance
db.version(3).stores({
  vault: 'id, title, username, category, folderId, updatedAt',
  folders: 'id, parentId, updatedAt'
});
