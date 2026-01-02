
import { VaultEntry, SensitiveData, Category } from '../types.ts';
import { CryptoService } from './cryptoService.ts';
import { RecoveryService } from './recoveryService.ts';
import { db } from '../db.ts';
import zxcvbn from 'zxcvbn';

const MASTER_METADATA_KEY = 'aegis_vault_metadata';
const MASTER_VERIFIER_KEY = 'aegis_vault_verifier';
const VALIDATOR_TEXT = "AEGIS_VAULT_ACTIVE_SESSION_VALIDATOR";

export class VaultService {
  static getSalt(): Uint8Array {
    const metadata = localStorage.getItem(MASTER_METADATA_KEY);
    if (!metadata) throw new Error("Vault not setup");
    try {
      const { salt: saltB64 } = JSON.parse(metadata);
      return new Uint8Array(CryptoService.base64ToArrayBuffer(saltB64));
    } catch (e) {
      throw new Error("Vault metadata corrupted");
    }
  }

  static async deriveMasterKey(password: string): Promise<{ key: CryptoKey; raw: Uint8Array }> {
    const metadataStr = localStorage.getItem(MASTER_METADATA_KEY);
    if (!metadataStr) throw new Error("Vault not setup");

    let salt: Uint8Array;
    let iterations = CryptoService.DEFAULT_ITERATIONS;

    try {
      const metadata = JSON.parse(metadataStr);
      salt = new Uint8Array(CryptoService.base64ToArrayBuffer(metadata.salt));
      if (metadata.iterations) {
        iterations = metadata.iterations;
      }
    } catch (e) {
      throw new Error("Vault metadata corrupted");
    }

    const { key, raw } = await CryptoService.deriveKeyWithRaw(password, salt, iterations);

    // Verifier'ı localStorage'dan al (kalıcı depolama)
    const verifierStr = localStorage.getItem(MASTER_VERIFIER_KEY);
    if (!verifierStr) {
      throw new Error("WRONG_PASSWORD");
    }

    try {
      const verifier = JSON.parse(verifierStr);
      const encryptedBuffer = new Uint8Array(CryptoService.base64ToArrayBuffer(verifier.payload));
      const tagBuffer = new Uint8Array(CryptoService.base64ToArrayBuffer(verifier.tag));
      const ivBuffer = new Uint8Array(CryptoService.base64ToArrayBuffer(verifier.iv));

      // IMPORTANT: Doğrudan Web Crypto API kullan, Electron IPC değil
      // Çünkü sessionKey henüz ayarlanmamış olabilir
      const combined = new Uint8Array(encryptedBuffer.byteLength + tagBuffer.byteLength);
      combined.set(encryptedBuffer, 0);
      combined.set(tagBuffer, encryptedBuffer.byteLength);

      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivBuffer as any },
        key,
        combined.buffer as any
      );

      const decoder = new TextDecoder();
      const decrypted = decoder.decode(decryptedBuffer);

      if (decrypted !== VALIDATOR_TEXT) {
        throw new Error("WRONG_PASSWORD");
      }

      // Electron varsa verifier'ı RAM'e de yükle (session için)
      if ((window as any).electronAPI?.vault) {
        await (window as any).electronAPI.vault.setVerifier(verifier);
      }
    } catch (e) {
      throw new Error("WRONG_PASSWORD");
    }

    return { key, raw };
  }

  static async setup(password: string): Promise<{ key: CryptoKey; raw: Uint8Array }> {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const saltB64 = CryptoService.arrayBufferToBase64(salt.buffer);

    try {
      // Benchmark hardware for optimal security (takes ~600ms)
      const iterations = await CryptoService.benchmarkIterations();
      const { key, raw } = await CryptoService.deriveKeyWithRaw(password, salt, iterations);

      // IMPORTANT: Verifier şifrelemesini doğrudan Web Crypto API ile yap
      // Electron IPC'ye bağımlı olmamak için
      const encoder = new TextEncoder();
      const dataBytes = encoder.encode(VALIDATOR_TEXT);
      const iv = window.crypto.getRandomValues(new Uint8Array(12));

      const encrypted = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv as any },
        key,
        dataBytes as any
      );

      const fullBuffer = new Uint8Array(encrypted);
      const ciphertext = fullBuffer.slice(0, fullBuffer.length - 16);
      const tag = fullBuffer.slice(fullBuffer.length - 16);

      const verifierBlob = {
        payload: CryptoService.arrayBufferToBase64(ciphertext.buffer),
        iv: CryptoService.arrayBufferToBase64(iv.buffer),
        tag: CryptoService.arrayBufferToBase64(tag.buffer)
      };

      localStorage.setItem(MASTER_METADATA_KEY, JSON.stringify({
        salt: saltB64,
        iterations: iterations,
        version: 5,
        createdAt: Date.now()
      }));

      // AUDIT: Log vault setup
      if ((window as any).electronAPI?.audit) {
        await (window as any).electronAPI.audit.logEvent('VAULT_SETUP', {
          timestamp: Date.now(),
          version: 4
        });
      }
      // Verifier'ı her zaman localStorage'a kaydet (kalıcı depolama)
      localStorage.setItem(MASTER_VERIFIER_KEY, JSON.stringify(verifierBlob));

      // Electron varsa RAM'e de kaydet (session için)
      if ((window as any).electronAPI?.vault) {
        await (window as any).electronAPI.vault.setVerifier(verifierBlob);
      }

      // Kurulum sırasında kurtarma kelimelerini oluştur ve kaydet
      // Pass RAW key for encryption
      await RecoveryService.setupRecovery(raw);

      return { key, raw };
    } catch (error) {
      console.error("Setup error:", error);
      throw error;
    }
  }

  private static calculateStrength(password: string): number {
    if (!password) return 0;

    // Use zxcvbn for advanced password strength analysis
    // zxcvbn returns a score from 0-4, we'll map it to 0-100 percentage
    const result = zxcvbn(password);

    // Map zxcvbn score (0-4) to percentage (0-100)
    // 0: Very weak (0-20)
    // 1: Weak (20-40)
    // 2: Fair (40-60)
    // 3: Good (60-80)
    // 4: Very strong (80-100)
    const percentageMap = [10, 30, 50, 75, 100];
    return percentageMap[result.score];
  }

  static async saveEntry(
    plainEntry: Partial<VaultEntry> & { sensitive: SensitiveData; title?: string; username?: string },
    masterKey: CryptoKey
  ): Promise<VaultEntry> {
    const sensitiveCopy = { ...plainEntry.sensitive };
    let encryptedFile: Uint8Array | undefined;
    let fileIv: Uint8Array | undefined;
    let fileTag: Uint8Array | undefined;

    const electronVault = (window as any).electronAPI?.vault;

    // Optimization: Store files as binary to avoid Base64 inflation
    if (sensitiveCopy.fileBlob instanceof Uint8Array) {
      if (electronVault) {
        const fileResult = await electronVault.encryptBinary(sensitiveCopy.fileBlob);
        encryptedFile = new Uint8Array(fileResult.ciphertext);
        fileIv = new Uint8Array(fileResult.iv);
        fileTag = new Uint8Array(fileResult.tag);
      } else {
        const fileResult = await CryptoService.encryptBinary(sensitiveCopy.fileBlob, masterKey);
        encryptedFile = fileResult.ciphertext;
        fileIv = fileResult.iv;
        fileTag = fileResult.tag;
      }
      delete sensitiveCopy.fileBlob; // Remove from JSON payload
    }

    // SECURITY: Encrypt sensitive data (password, notes, etc.)
    const sensitiveJson = JSON.stringify(sensitiveCopy);
    let ciphertext: Uint8Array, iv: Uint8Array, tag: Uint8Array;
    let titleCiphertext: Uint8Array, titleIv: Uint8Array, titleTag: Uint8Array;
    let usernameCiphertext: Uint8Array, usernameIv: Uint8Array, usernameTag: Uint8Array;

    const displayTitle = plainEntry.title || (plainEntry.category === Category.FILE ? `Secure-Asset-${crypto.randomUUID().slice(0, 8)}` : 'Unnamed Entry');
    const displayUsername = plainEntry.username || '';

    if (electronVault) {
      // IPC Encryption (Main Process)
      const sensitiveResult = await electronVault.encrypt(sensitiveJson);
      ciphertext = new Uint8Array(sensitiveResult.ciphertext);
      iv = new Uint8Array(sensitiveResult.iv);
      tag = new Uint8Array(sensitiveResult.tag);

      const titleResult = await electronVault.encrypt(displayTitle);
      titleCiphertext = new Uint8Array(titleResult.ciphertext);
      titleIv = new Uint8Array(titleResult.iv);
      titleTag = new Uint8Array(titleResult.tag);

      const usernameResult = await electronVault.encrypt(displayUsername);
      usernameCiphertext = new Uint8Array(usernameResult.ciphertext);
      usernameIv = new Uint8Array(usernameResult.iv);
      usernameTag = new Uint8Array(usernameResult.tag);
    } else {
      // Web Crypto Fallback
      const sensitiveResult = await CryptoService.encrypt(sensitiveJson, masterKey);
      ciphertext = sensitiveResult.ciphertext;
      iv = sensitiveResult.iv;
      tag = sensitiveResult.tag;

      const titleResult = await CryptoService.encrypt(displayTitle, masterKey);
      titleCiphertext = titleResult.ciphertext;
      titleIv = titleResult.iv;
      titleTag = titleResult.tag;

      const usernameResult = await CryptoService.encrypt(displayUsername, masterKey);
      usernameCiphertext = usernameResult.ciphertext;
      usernameIv = usernameResult.iv;
      usernameTag = usernameResult.tag;
    }

    // Encrypt System Metadata
    const metadataPayload = JSON.stringify({
      category: plainEntry.category || Category.LOGIN,
      folderId: plainEntry.folderId,
      updatedAt: Date.now(),
      isFavorite: plainEntry.isFavorite,
      fileSize: plainEntry.fileSize,
      deletedAt: plainEntry['deletedAt']
    });

    let encryptedMetadata: Uint8Array, metadataIv: Uint8Array, metadataTag: Uint8Array;

    if (electronVault) {
      const metaResult = await electronVault.encrypt(metadataPayload);
      encryptedMetadata = new Uint8Array(metaResult.ciphertext);
      metadataIv = new Uint8Array(metaResult.iv);
      metadataTag = new Uint8Array(metaResult.tag);
    } else {
      const metaResult = await CryptoService.encrypt(metadataPayload, masterKey);
      encryptedMetadata = metaResult.ciphertext;
      metadataIv = metaResult.iv;
      metadataTag = metaResult.tag;
    }

    const securityScore = this.calculateStrength(plainEntry.sensitive.password || '');

    const entry: VaultEntry = {
      id: plainEntry.id || crypto.randomUUID(),
      encryptedTitle: titleCiphertext,
      titleIv: titleIv,
      titleTag: titleTag,
      encryptedUsername: usernameCiphertext,
      usernameIv: usernameIv,
      usernameTag: usernameTag,

      encryptedMetadata,
      metadataIv,
      metadataTag,

      category: Category.LOGIN,
      updatedAt: 0,
      isFavorite: false,
      folderId: undefined,
      deletedAt: undefined,

      securityScore,
      fileSize: plainEntry.fileSize,
      encryptedData: ciphertext,
      iv: iv,
      tag: tag,
      encryptedFile,
      fileIv,
      fileTag
    };

    await db.vault.put(entry);

    // AUDIT: Log entry save
    if ((window as any).electronAPI?.audit) {
      await (window as any).electronAPI.audit.logEvent('ENTRY_SAVED', {
        entryId: entry.id,
        category: entry.category,
        timestamp: entry.updatedAt
      });
    }

    return {
      ...entry,
      title: displayTitle,
      username: displayUsername
    } as VaultEntry;
  }

  // Fix: Adding missing bulkImport method to handle batch operations from PortabilityWizard
  static async bulkImport(
    items: (Partial<VaultEntry> & { sensitive: SensitiveData; title?: string; username?: string })[],
    masterKey: CryptoKey
  ): Promise<void> {
    const electronVault = (window as any).electronAPI?.vault;

    // Perform encryptions in parallel for better speed
    const encryptedEntries = await Promise.all(items.map(async (plainEntry) => {
      try {
        const sensitiveJson = JSON.stringify(plainEntry.sensitive);
        let ciphertext: Uint8Array, iv: Uint8Array, tag: Uint8Array;
        let titleCiphertext: Uint8Array, titleIv: Uint8Array, titleTag: Uint8Array;
        let usernameCiphertext: Uint8Array, usernameIv: Uint8Array, usernameTag: Uint8Array;

        const displayTitle = plainEntry.title || (plainEntry.category === Category.FILE ? `Secure-Asset-${crypto.randomUUID().slice(0, 8)}` : 'Unnamed Entry');
        const displayUsername = plainEntry.username || '';

        if (electronVault) {
          const sensitiveResult = await electronVault.encrypt(sensitiveJson);
          ciphertext = new Uint8Array(sensitiveResult.ciphertext);
          iv = new Uint8Array(sensitiveResult.iv);
          tag = new Uint8Array(sensitiveResult.tag);

          const titleResult = await electronVault.encrypt(displayTitle);
          titleCiphertext = new Uint8Array(titleResult.ciphertext);
          titleIv = new Uint8Array(titleResult.iv);
          titleTag = new Uint8Array(titleResult.tag);

          const usernameResult = await electronVault.encrypt(displayUsername);
          usernameCiphertext = new Uint8Array(usernameResult.ciphertext);
          usernameIv = new Uint8Array(usernameResult.iv);
          usernameTag = new Uint8Array(usernameResult.tag);
        } else {
          const sensitiveResult = await CryptoService.encrypt(sensitiveJson, masterKey);
          ciphertext = sensitiveResult.ciphertext;
          iv = sensitiveResult.iv;
          tag = sensitiveResult.tag;

          const titleResult = await CryptoService.encrypt(displayTitle, masterKey);
          titleCiphertext = titleResult.ciphertext;
          titleIv = titleResult.iv;
          titleTag = titleResult.tag;

          const usernameResult = await CryptoService.encrypt(displayUsername, masterKey);
          usernameCiphertext = usernameResult.ciphertext;
          usernameIv = usernameResult.iv;
          usernameTag = usernameResult.tag;
        }

        // Encrypt Metadata
        const metadataPayload = JSON.stringify({
          category: plainEntry.category || Category.LOGIN,
          folderId: plainEntry.folderId,
          updatedAt: Date.now(),
          isFavorite: plainEntry.isFavorite,
          fileSize: plainEntry.fileSize
        });

        let encryptedMetadata: Uint8Array, metadataIv: Uint8Array, metadataTag: Uint8Array;
        if (electronVault) {
          const res = await electronVault.encrypt(metadataPayload);
          encryptedMetadata = new Uint8Array(res.ciphertext);
          metadataIv = new Uint8Array(res.iv);
          metadataTag = new Uint8Array(res.tag);
        } else {
          const res = await CryptoService.encrypt(metadataPayload, masterKey);
          encryptedMetadata = res.ciphertext;
          metadataIv = res.iv;
          metadataTag = res.tag;
        }

        const securityScore = this.calculateStrength(plainEntry.sensitive.password || '');

        return {
          id: plainEntry.id || crypto.randomUUID(),
          encryptedTitle: titleCiphertext,
          titleIv: titleIv,
          titleTag: titleTag,
          encryptedUsername: usernameCiphertext,
          usernameIv: usernameIv,
          usernameTag: usernameTag,

          encryptedMetadata,
          metadataIv,
          metadataTag,

          category: Category.LOGIN,
          updatedAt: 0,
          isFavorite: false,
          folderId: undefined,

          securityScore,
          fileSize: plainEntry.fileSize,
          encryptedData: ciphertext,
          iv: iv,
          tag: tag
        } as VaultEntry;
      } catch (e) {
        console.error("Bulk Import: Failed to process entry", e);
        return null;
      }
    }));

    // Başarılı şekilde şifrelenmiş girişleri filtrele
    const validEntries = encryptedEntries.filter((entry): entry is VaultEntry => entry !== null);

    if (validEntries.length > 0) {
      await db.vault.bulkPut(validEntries);
    }
  }

  static async decryptEntry(entry: VaultEntry, masterKey: CryptoKey): Promise<SensitiveData> {
    try {
      const electronVault = (window as any).electronAPI?.vault;
      let decryptedJson = "";

      if (electronVault) {
        decryptedJson = await electronVault.decrypt(entry.encryptedData, entry.iv, entry.tag);
      } else {
        decryptedJson = await CryptoService.decrypt(entry.encryptedData, masterKey, entry.iv, entry.tag);
      }

      const sensitive: SensitiveData = JSON.parse(decryptedJson);

      // Memory Optimized: If a separate binary file exists, decrypt it directly
      if (entry.encryptedFile && entry.fileIv && entry.fileTag) {
        if (electronVault) {
          const decryptedBuffer = await electronVault.decryptBinary(entry.encryptedFile, entry.fileIv, entry.fileTag);
          sensitive.fileBlob = new Uint8Array(decryptedBuffer);
        } else {
          const decryptedFile = await CryptoService.decryptBinary(entry.encryptedFile, masterKey, entry.fileIv, entry.fileTag);
          sensitive.fileBlob = decryptedFile; // returns Uint8Array
        }
      }

      return sensitive;
    } catch (e) {
      console.error("Decryption Error:", e);
      throw new Error("Decryption failed");
    }
  }

  // SECURITY: Decrypt metadata (title, username, category, folderId, etc.) for display
  static async decryptEntryMetadata(entry: VaultEntry, masterKey: CryptoKey): Promise<{
    title: string;
    username: string;
    category?: Category;
    folderId?: string;
    updatedAt?: number;
    isFavorite?: boolean;
    deletedAt?: number;
    fileSize?: number;
  }> {
    try {
      const electronVault = (window as any).electronAPI?.vault;
      let decryptedTitle = "";
      let decryptedUsername = "";

      if (electronVault) {
        decryptedTitle = await electronVault.decrypt(entry.encryptedTitle, entry.titleIv, entry.titleTag);
        decryptedUsername = await electronVault.decrypt(entry.encryptedUsername, entry.usernameIv, entry.usernameTag);
      } else {
        decryptedTitle = await CryptoService.decrypt(entry.encryptedTitle, masterKey, entry.titleIv, entry.titleTag);
        decryptedUsername = await CryptoService.decrypt(entry.encryptedUsername, masterKey, entry.usernameIv, entry.usernameTag);
      }

      let extendedMeta: any = {};

      // Decrypt System Metadata if available
      if (entry.encryptedMetadata && entry.metadataIv && entry.metadataTag) {
        let metaJson = "";
        if (electronVault) {
          metaJson = await electronVault.decrypt(entry.encryptedMetadata, entry.metadataIv, entry.metadataTag);
        } else {
          metaJson = await CryptoService.decrypt(entry.encryptedMetadata, masterKey, entry.metadataIv, entry.metadataTag);
        }
        extendedMeta = JSON.parse(metaJson);
      } else {
        // Fallback for legacy entries (Plain fields)
        extendedMeta = {
          category: entry.category,
          folderId: entry.folderId,
          updatedAt: entry.updatedAt,
          isFavorite: entry.isFavorite,
          deletedAt: entry.deletedAt,
          fileSize: entry.fileSize
        };
      }

      return { title: decryptedTitle, username: decryptedUsername, ...extendedMeta };
    } catch (e) {
      console.error("Metadata Decryption Error:", e);
      return { title: '[Decryption Error]', username: '[Decryption Error]' };
    }
  }

  static async updateEntryMetadata(
    id: string,
    changes: { isFavorite?: boolean; deletedAt?: number | undefined; folderId?: string | undefined },
    masterKey: CryptoKey
  ): Promise<void> {
    const entry = await db.vault.get(id);
    if (!entry) throw new Error("Entry not found");

    const electronVault = (window as any).electronAPI?.vault;

    // 1. Decrypt current metadata to get base
    let currentMeta: any = {
      category: entry.category,
      folderId: entry.folderId,
      updatedAt: entry.updatedAt,
      isFavorite: entry.isFavorite,
      fileSize: entry.fileSize,
      deletedAt: entry.deletedAt
    };

    if (entry.encryptedMetadata && entry.metadataIv && entry.metadataTag) {
      let metaJson = "";
      if (electronVault) {
        metaJson = await electronVault.decrypt(entry.encryptedMetadata, entry.metadataIv, entry.metadataTag);
      } else {
        metaJson = await CryptoService.decrypt(entry.encryptedMetadata, masterKey, entry.metadataIv, entry.metadataTag);
      }
      currentMeta = JSON.parse(metaJson);
    }

    // 2. Apply changes
    const newMeta = {
      ...currentMeta,
      ...changes,
      updatedAt: Date.now()
    };

    // 3. Encrypt new metadata
    const metadataPayload = JSON.stringify(newMeta);
    let encryptedMetadata: Uint8Array, metadataIv: Uint8Array, metadataTag: Uint8Array;

    if (electronVault) {
      const metaResult = await electronVault.encrypt(metadataPayload);
      encryptedMetadata = new Uint8Array(metaResult.ciphertext);
      metadataIv = new Uint8Array(metaResult.iv);
      metadataTag = new Uint8Array(metaResult.tag);
    } else {
      const metaResult = await CryptoService.encrypt(metadataPayload, masterKey);
      encryptedMetadata = metaResult.ciphertext;
      metadataIv = metaResult.iv;
      metadataTag = metaResult.tag;
    }

    // 4. Update DB
    await db.vault.update(id, {
      encryptedMetadata,
      metadataIv,
      metadataTag,
      updatedAt: 0, // Dummy
      isFavorite: false, // Dummy
      folderId: undefined, // Dummy
      deletedAt: undefined, // Dummy
      // Update specific dummy fields if needed? No, always mask.
    });
  }

  static async deleteEntry(id: string): Promise<void> {
    await db.vault.delete(id);

    // AUDIT: Log entry deletion
    if ((window as any).electronAPI?.audit) {
      await (window as any).electronAPI.audit.logEvent('ENTRY_DELETED', {
        entryId: id,
        timestamp: Date.now()
      });
    }
  }

  static isInitialized(): boolean {
    return !!localStorage.getItem(MASTER_METADATA_KEY);
  }
}
