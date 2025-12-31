
import { Folder } from '../types';
import { CryptoService } from './cryptoService';
import { db } from '../db';

export interface Breadcrumb {
  id: string;
  name: string;
}

export class FolderService {
  static async createFolder(name: string, color: string, icon: string, parentId: string | undefined, masterKey: CryptoKey): Promise<Folder> {
    const { ciphertext, iv, tag } = await CryptoService.encrypt(name, masterKey);

    const folder: Folder = {
      id: crypto.randomUUID(),
      parentId,
      color,
      icon,
      updatedAt: Date.now(),
      encryptedName: CryptoService.arrayBufferToBase64(ciphertext.buffer),
      iv: CryptoService.arrayBufferToBase64(iv.buffer),
      tag: CryptoService.arrayBufferToBase64(tag.buffer)
    };

    await db.folders.add(folder);
    return folder;
  }

  static async decryptFolderName(folder: Folder, masterKey: CryptoKey): Promise<string> {
    const encryptedBuffer = new Uint8Array(CryptoService.base64ToArrayBuffer(folder.encryptedName));
    const ivBuffer = new Uint8Array(CryptoService.base64ToArrayBuffer(folder.iv));
    const tagBuffer = new Uint8Array(CryptoService.base64ToArrayBuffer(folder.tag || ""));

    try {
      return await CryptoService.decrypt(encryptedBuffer, masterKey, ivBuffer, tagBuffer);
    } catch (e) {
      return "Unknown Collection";
    }
  }

  static async getAllFolders(masterKey: CryptoKey): Promise<(Folder & { name: string })[]> {
    const folders = await db.folders.toArray();
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

    while (currentId) {
      const folder = await db.folders.get(currentId);
      if (!folder) break;

      const name = await this.decryptFolderName(folder, masterKey);
      crumbs.unshift({ id: folder.id, name });
      currentId = folder.parentId;
    }

    return crumbs;
  }

  static async deleteFolder(id: string): Promise<void> {
    await db.vault.where('folderId').equals(id).modify({ folderId: undefined });
    await db.folders.delete(id);
    await db.folders.where('parentId').equals(id).modify({ parentId: undefined });
  }

  static async moveEntry(entryId: string, folderId: string | undefined): Promise<void> {
    await db.vault.update(entryId, { folderId });
  }

  static async updateFolder(id: string, name: string, color: string, icon: string, masterKey: CryptoKey): Promise<void> {
    const { ciphertext, iv, tag } = await CryptoService.encrypt(name, masterKey);
    await db.folders.update(id, {
      encryptedName: CryptoService.arrayBufferToBase64(ciphertext.buffer),
      iv: CryptoService.arrayBufferToBase64(iv.buffer),
      tag: CryptoService.arrayBufferToBase64(tag.buffer),
      color,
      icon,
      updatedAt: Date.now()
    });
  }
}
