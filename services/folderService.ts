
import { Folder } from '../types';
import { CryptoService } from './cryptoService';
import { db } from '../db';

export interface Breadcrumb {
  id: string;
  name: string;
}

export class FolderService {
  static async createFolder(name: string, color: string, icon: string, parentId: string | undefined, masterKey: CryptoKey): Promise<Folder> {
    const folder = await this.encryptFolderHelper(name, color, icon, parentId, masterKey);
    await db.folders.add(folder);

    if ((window as any).electronAPI?.db) {
      await (window as any).electronAPI.db.saveFolder(folder);
    }

    return folder;
  }

  static async encryptFolderHelper(name: string, color: string, icon: string, parentId: string | undefined, masterKey: CryptoKey): Promise<Folder> {
    const { ciphertext, iv, tag } = await CryptoService.encrypt(name, masterKey);

    return {
      id: crypto.randomUUID(),
      parentId,
      color,
      icon,
      updatedAt: Date.now(),
      encryptedName: CryptoService.arrayBufferToBase64(ciphertext.buffer),
      iv: CryptoService.arrayBufferToBase64(iv.buffer),
      tag: CryptoService.arrayBufferToBase64(tag.buffer)
    };
  }

  static async decryptFolderName(folder: any, masterKey: CryptoKey): Promise<string> {
    const encName = folder.encryptedName || folder.name; // Support both legacy and new schema
    if (!encName) return "Unnamed Collection";

    const iv = folder.iv;
    const tag = folder.tag;

    if (!iv || !tag) return encName; // Fallback if data is plaintext legacy

    const encryptedBuffer = new Uint8Array(CryptoService.base64ToArrayBuffer(encName));
    const ivBuffer = new Uint8Array(CryptoService.base64ToArrayBuffer(iv));
    const tagBuffer = new Uint8Array(CryptoService.base64ToArrayBuffer(tag));

    try {
      return await CryptoService.decrypt(encryptedBuffer, masterKey, ivBuffer, tagBuffer);
    } catch (e) {
      console.warn("[Folder] Decryption failed for folder:", folder.id);
      return "Secure Collection";
    }
  }

  static async getAllFolders(masterKey: CryptoKey): Promise<(Folder & { name: string })[]> {
    let folders: any[] = [];
    const electronDB = (window as any).electronAPI?.db;

    if (electronDB) {
      folders = await electronDB.getAllFolders();
    } else {
      folders = await db.folders.toArray();
    }

    const result = [];
    for (const f of folders) {
      const name = await this.decryptFolderName(f, masterKey);
      result.push({ ...f, name });
    }
    return result;
  }

  static async getBreadcrumbs(folderId: string, masterKey: CryptoKey): Promise<Breadcrumb[]> {
    const crumbs: Breadcrumb[] = [];
    let currentId: string | undefined = folderId;
    const electronDB = (window as any).electronAPI?.db;

    while (currentId) {
      let folder: any;
      if (electronDB) {
        const all = await electronDB.getAllFolders();
        folder = all.find((f: any) => f.id === currentId);
      } else {
        folder = await db.folders.get(currentId);
      }

      if (!folder) break;

      const name = await this.decryptFolderName(folder, masterKey);
      crumbs.unshift({ id: folder.id, name });
      currentId = folder.parentId || folder.parent_id;
    }

    return crumbs;
  }

  static async deleteFolder(id: string): Promise<void> {
    await db.vault.where('folderId').equals(id).modify({ folderId: undefined });
    await db.folders.delete(id);
    await db.folders.where('parentId').equals(id).modify({ parentId: undefined });

    if ((window as any).electronAPI?.db) {
      await (window as any).electronAPI.db.deleteFolder(id);
    }
  }

  static async moveEntry(entryId: string, folderId: string | undefined): Promise<void> {
    await db.vault.update(entryId, { folderId });
    // SQLite sync happens via VaultService saveEntry usually
  }

  static async updateFolder(id: string, name: string, color: string, icon: string, masterKey: CryptoKey): Promise<void> {
    const { ciphertext, iv, tag } = await CryptoService.encrypt(name, masterKey);
    const update = {
      encryptedName: CryptoService.arrayBufferToBase64(ciphertext.buffer),
      iv: CryptoService.arrayBufferToBase64(iv.buffer),
      tag: CryptoService.arrayBufferToBase64(tag.buffer),
      color,
      icon,
      updatedAt: Date.now()
    };

    await db.folders.update(id, update);

    if ((window as any).electronAPI?.db) {
      await (window as any).electronAPI.db.saveFolder({
        id,
        ...update
      });
    }
  }
}
