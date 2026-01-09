
import { VaultEntry, SensitiveData, Category, Folder } from '../types.ts';
import { CryptoService } from './cryptoService.ts';
import { RecoveryService } from './recoveryService.ts';
import { FolderService } from './folderService.ts';
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

      // SECURITY UPGRADE: If iterations is less than default, migrate automatically
      const metadata = JSON.parse(metadataStr!);
      if (iterations < CryptoService.DEFAULT_ITERATIONS) {
        return await this.migrateVault(password, salt, { key, raw }, CryptoService.DEFAULT_ITERATIONS, metadata);
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

    // Optimization: Store large files as separate binary blobs
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
      delete sensitiveCopy.fileBlob;
    }

    // SECURITY: Combine EVERYTHING into one "Full Package" for encryption
    // This hides metadata (title, username) and structure from the DB layer
    const fullPackage = {
      title: plainEntry.title || (plainEntry.category === Category.FILE ? `Secure-Asset-${crypto.randomUUID().slice(0, 8)}` : 'Unnamed Entry'),
      username: plainEntry.username || '',
      category: plainEntry.category || Category.LOGIN,
      folderId: plainEntry.folderId,
      updatedAt: Date.now(),
      isFavorite: plainEntry.isFavorite,
      fileSize: plainEntry.fileSize,
      deletedAt: (plainEntry as any).deletedAt,
      sensitive: sensitiveCopy
    };

    const packageJson = JSON.stringify(fullPackage);
    let ciphertext: Uint8Array, iv: Uint8Array, tag: Uint8Array;

    if (electronVault) {
      const result = await electronVault.encrypt(packageJson);
      ciphertext = new Uint8Array(result.ciphertext);
      iv = new Uint8Array(result.iv);
      tag = new Uint8Array(result.tag);
    } else {
      const result = await CryptoService.encrypt(packageJson, masterKey);
      ciphertext = result.ciphertext;
      iv = result.iv;
      tag = result.tag;
    }

    const securityScore = this.calculateStrength(plainEntry.sensitive.password || '');

    const entry: VaultEntry = {
      id: plainEntry.id || crypto.randomUUID(),
      // FULL ENCRYPTION MODE: These fields are now empty or masked in DB
      encryptedTitle: new Uint8Array(0),
      titleIv: new Uint8Array(0),
      titleTag: new Uint8Array(0),
      encryptedUsername: new Uint8Array(0),
      usernameIv: new Uint8Array(0),
      usernameTag: new Uint8Array(0),
      encryptedMetadata: new Uint8Array(0),
      metadataIv: new Uint8Array(0),
      metadataTag: new Uint8Array(0),

      // Store everything in the main data blob
      encryptedData: ciphertext,
      iv: iv,
      tag: tag,

      // Non-sensitive indexing fields (optional, but needed for Dexie stores if defined)
      category: fullPackage.category,
      updatedAt: fullPackage.updatedAt,
      isFavorite: fullPackage.isFavorite || false,
      folderId: fullPackage.folderId,
      deletedAt: fullPackage.deletedAt,

      securityScore,
      fileSize: plainEntry.fileSize,
      encryptedFile,
      fileIv,
      fileTag,
      version: 4 // Mark as Full Encryption
    } as any;

    await db.vault.put(entry);

    if ((window as any).electronAPI?.audit) {
      await (window as any).electronAPI.audit.logEvent('ENTRY_SAVED', {
        entryId: entry.id,
        category: entry.category,
        fullEncryption: true
      });
    }

    return {
      ...entry,
      title: fullPackage.title,
      username: fullPackage.username
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
        // --- 1. TITLE & USERNAME RECOVERY ---
        let displayTitle = plainEntry.title;
        let displayUsername = plainEntry.username || (plainEntry.sensitive as any)?.username || (plainEntry.sensitive as any)?.email || (plainEntry.sensitive as any)?.user || (plainEntry.sensitive as any)?.login || (plainEntry.sensitive as any)?.id || (plainEntry.sensitive as any)?.login_name || (plainEntry.sensitive as any)?.loginuser || (plainEntry.sensitive as any)?.loginemail;

        // If title is missing, try to get it from sensitive data or notes as a last resort
        if (!displayTitle) {
          displayTitle = (plainEntry.sensitive as any)?.title || (plainEntry.sensitive as any)?.name;
        }

        // If plaintext fields are still missing (older backup), try to decrypt encrypted counterparts
        if (!displayTitle && plainEntry.encryptedTitle && plainEntry.titleIv && plainEntry.titleTag) {
          try {
            if (electronVault) {
              displayTitle = await electronVault.decrypt(plainEntry.encryptedTitle, plainEntry.titleIv, plainEntry.titleTag);
            } else {
              displayTitle = await CryptoService.decrypt(plainEntry.encryptedTitle, masterKey, plainEntry.titleIv, plainEntry.titleTag);
            }
          } catch (e) {
            console.warn(`Bulk Import: Failed to decrypt legacy title for ${plainEntry.id}, using fallback.`);
          }
        }

        if (!displayUsername && plainEntry.encryptedUsername && plainEntry.usernameIv && plainEntry.usernameTag) {
          try {
            if (electronVault) {
              displayUsername = await electronVault.decrypt(plainEntry.encryptedUsername, plainEntry.usernameIv, plainEntry.usernameTag);
            } else {
              displayUsername = await CryptoService.decrypt(plainEntry.encryptedUsername, masterKey, plainEntry.usernameIv, plainEntry.usernameTag);
            }
          } catch (e) {
            console.warn(`Bulk Import: Failed to decrypt legacy username for ${plainEntry.id}.`);
          }
        }

        // Additional username fallbacks from sensitive data
        if (!displayUsername || displayUsername.trim() === '') {
          const sensitive = plainEntry.sensitive as any;
          if (sensitive) {
            displayUsername = sensitive.email || sensitive.user || sensitive.login || sensitive.id || sensitive.login_username || sensitive.loginuser || sensitive.loginemail || '';
          }
        }

        // Final UI fallbacks
        displayTitle = displayTitle || (plainEntry.category === Category.FILE ? `Secure-Asset-${crypto.randomUUID().slice(0, 8)}` : 'Unnamed Entry');
        displayUsername = displayUsername || '';

        // Debug log
        console.log('[BulkImport] Entry processed - ID:', plainEntry.id, 'Title:', displayTitle, 'Username:', displayUsername);

        // --- 2. ATTACHMENT HANDLING ---
        const sensitiveCopy = { ...plainEntry.sensitive };
        let encryptedFile: Uint8Array | undefined;
        let fileIv: Uint8Array | undefined;
        let fileTag: Uint8Array | undefined;

        let fileData = sensitiveCopy.fileBlob || (plainEntry as any).fileBlob;

        // Convert Base64 (from export JSON) back to binary
        if (typeof fileData === 'string' && fileData.length > 0) {
          try {
            fileData = new Uint8Array(CryptoService.base64ToArrayBuffer(fileData));
          } catch (e) {
            console.error("Bulk Import: Base64 decode failed for attachment", e);
          }
        }

        // Re-encrypt for the current vault
        if (fileData instanceof Uint8Array && fileData.length > 0) {
          if (electronVault) {
            const fileResult = await electronVault.encryptBinary(fileData);
            encryptedFile = new Uint8Array(fileResult.ciphertext);
            fileIv = new Uint8Array(fileResult.iv);
            fileTag = new Uint8Array(fileResult.tag);
          } else {
            const fileResult = await CryptoService.encryptBinary(fileData, masterKey);
            encryptedFile = fileResult.ciphertext;
            fileIv = fileResult.iv;
            fileTag = fileResult.tag;
          }
          // Remove binary from metadata payload to save space
          delete sensitiveCopy.fileBlob;
        }

        // --- 3. CORE CONTENT ENCRYPTION ---
        const sensitiveJson = JSON.stringify(sensitiveCopy);
        let ciphertext: Uint8Array, iv: Uint8Array, tag: Uint8Array;
        let titleCiphertext: Uint8Array, titleIv: Uint8Array, titleTag: Uint8Array;
        let usernameCiphertext: Uint8Array, usernameIv: Uint8Array, usernameTag: Uint8Array;

        if (electronVault) {
          const resSensitive = await electronVault.encrypt(sensitiveJson);
          ciphertext = new Uint8Array(resSensitive.ciphertext);
          iv = new Uint8Array(resSensitive.iv);
          tag = new Uint8Array(resSensitive.tag);

          const resTitle = await electronVault.encrypt(displayTitle);
          titleCiphertext = new Uint8Array(resTitle.ciphertext);
          titleIv = new Uint8Array(resTitle.iv);
          titleTag = new Uint8Array(resTitle.tag);

          const resUser = await electronVault.encrypt(displayUsername);
          usernameCiphertext = new Uint8Array(resUser.ciphertext);
          usernameIv = new Uint8Array(resUser.iv);
          usernameTag = new Uint8Array(resUser.tag);
        } else {
          const resSensitive = await CryptoService.encrypt(sensitiveJson, masterKey);
          ciphertext = resSensitive.ciphertext;
          iv = resSensitive.iv;
          tag = resSensitive.tag;

          const resTitle = await CryptoService.encrypt(displayTitle, masterKey);
          titleCiphertext = resTitle.ciphertext;
          titleIv = resTitle.iv;
          titleTag = resTitle.tag;

          const resUser = await CryptoService.encrypt(displayUsername, masterKey);
          usernameCiphertext = resUser.ciphertext;
          usernameIv = resUser.iv;
          usernameTag = resUser.tag;
        }

        // --- 4. METADATA & CATEGORY ---
        const category = plainEntry.category || Category.LOGIN;
        const metadataPayload = JSON.stringify({
          category: category,
          folderId: plainEntry.folderId,
          updatedAt: Date.now(),
          isFavorite: plainEntry.isFavorite,
          fileSize: plainEntry.fileSize || (fileData instanceof Uint8Array ? fileData.length : 0)
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

        const securityScore = this.calculateStrength(plainEntry.sensitive?.password || '');

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

          category: category, // FIXED: Use actual category
          updatedAt: Date.now(),
          isFavorite: plainEntry.isFavorite || false,
          folderId: plainEntry.folderId,

          securityScore,
          fileSize: plainEntry.fileSize || (fileData instanceof Uint8Array ? fileData.length : 0),
          encryptedData: ciphertext,
          iv: iv,
          tag: tag,
          encryptedFile, // ADDED: file support
          fileIv,
          fileTag
        } as VaultEntry;
      } catch (e) {
        console.error("Bulk Import: Critical processing error for entry", plainEntry.id, e);
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

      const parsed = JSON.parse(decryptedJson);

      // Handle Full Encryption Package (v4+)
      let sensitive: SensitiveData;
      if (parsed.sensitive) {
        sensitive = parsed.sensitive;
      } else {
        sensitive = parsed; // Legacy format
      }

      // Memory Optimized: If a separate binary file exists, decrypt it directly
      if (entry.encryptedFile && entry.fileIv && entry.fileTag) {
        if (electronVault) {
          const decryptedBuffer = await electronVault.decryptBinary(entry.encryptedFile, entry.fileIv, entry.fileTag);
          sensitive.fileBlob = new Uint8Array(decryptedBuffer);
        } else {
          const decryptedFile = await CryptoService.decryptBinary(entry.encryptedFile, masterKey, entry.fileIv, entry.fileTag);
          sensitive.fileBlob = decryptedFile;
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

      // Handle Full Encryption Package (v4+)
      // If encryptedTitle is empty, it's a v4+ entry
      if (!entry.encryptedTitle || entry.encryptedTitle.length === 0) {
        let packageJson = "";
        if (electronVault) {
          packageJson = await electronVault.decrypt(entry.encryptedData, entry.iv, entry.tag);
        } else {
          packageJson = await CryptoService.decrypt(entry.encryptedData, masterKey, entry.iv, entry.tag);
        }
        const fullPackage = JSON.parse(packageJson);
        return {
          title: fullPackage.title,
          username: fullPackage.username,
          category: fullPackage.category,
          folderId: fullPackage.folderId,
          updatedAt: fullPackage.updatedAt,
          isFavorite: fullPackage.isFavorite,
          deletedAt: fullPackage.deletedAt,
          fileSize: fullPackage.fileSize
        };
      }

      // Legacy Decryption (v3 and below)
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
      if (entry.encryptedMetadata && entry.metadataIv && entry.metadataTag) {
        let metaJson = "";
        if (electronVault) {
          metaJson = await electronVault.decrypt(entry.encryptedMetadata, entry.metadataIv, entry.metadataTag);
        } else {
          metaJson = await CryptoService.decrypt(entry.encryptedMetadata, masterKey, entry.metadataIv, entry.metadataTag);
        }
        extendedMeta = JSON.parse(metaJson);
      } else {
        extendedMeta = {
          category: entry.category,
          folderId: entry.folderId,
          updatedAt: entry.updatedAt,
          isFavorite: entry.isFavorite,
          deletedAt: entry.deletedAt,
          fileSize: entry.fileSize
        };
      }

      return {
        ...extendedMeta,
        title: decryptedTitle,
        username: decryptedUsername
      };
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
  static async deduplicateVault(masterKey: CryptoKey): Promise<{ deletedCount: number }> {
    try {
      const allEntries = await db.vault.toArray();
      const entryMap = new Map<string, VaultEntry>();
      const toDelete: string[] = [];

      for (const entry of allEntries) {
        try {
          const meta = await this.decryptEntryMetadata(entry, masterKey);
          const key = `${(meta.title || '').toLowerCase().trim()}|${(meta.username || '').toLowerCase().trim()}`;

          const existing = entryMap.get(key);
          if (existing) {
            const existingMeta = await this.decryptEntryMetadata(existing, masterKey);
            if ((meta.updatedAt || 0) > (existingMeta.updatedAt || 0)) {
              toDelete.push(existing.id);
              entryMap.set(key, entry);
            } else {
              toDelete.push(entry.id);
            }
          } else {
            entryMap.set(key, entry);
          }
        } catch (e) {
          console.error("Deduplication error", e);
        }
      }

      if (toDelete.length > 0) {
        console.log(`[Deduplication] ${toDelete.length} duplicate siliniyor...`);
        await db.vault.bulkDelete(toDelete);
        if ((window as any).electronAPI?.audit) {
          await (window as any).electronAPI.audit.logEvent('VAULT_CLEANUP', { deletedCount: toDelete.length, timestamp: Date.now() });
        }
        console.log(`[Deduplication] ${toDelete.length} duplicate başarıyla silindi!`);
      }

      return { deletedCount: toDelete.length };
    } catch (e) {
      console.error("Deduplication failed", e);
      throw e;
    }
  }

  static isInitialized(): boolean {
    return !!localStorage.getItem(MASTER_METADATA_KEY);
  }

  private static async migrateVault(
    password: string,
    salt: Uint8Array,
    oldData: { key: CryptoKey; raw: Uint8Array },
    targetIterations: number,
    oldMetadata: any
  ): Promise<{ key: CryptoKey; raw: Uint8Array }> {
    try {
      // 1. Derive NEW key
      const { key: newKey, raw: newRaw } = await CryptoService.deriveKeyWithRaw(password, salt, targetIterations);

      // 2. Transcribe entries (Decrypt with old, encrypt with new)
      const allEntries = await db.vault.toArray();
      const migratedEntries: VaultEntry[] = [];

      for (const entry of allEntries) {
        try {
          const sensitive = await this.decryptEntry(entry, oldData.key);
          const metadata = await this.decryptEntryMetadata(entry, oldData.key);

          const reEncrypted = await this.encryptEntryHelper({
            ...entry,
            ...metadata,
            sensitive,
            id: entry.id
          }, newKey);

          migratedEntries.push(reEncrypted);
        } catch (err) {
          console.error(`Migration failed for entry ${entry.id}`, err);
          throw new Error("MIGRATION_ENTRY_FAILED");
        }
      }

      // 3. Transcribe folders
      const allFolders = await db.folders.toArray();
      const migratedFolders: Folder[] = [];
      for (const folder of allFolders) {
        try {
          const name = await FolderService.decryptFolderName(folder, oldData.key);
          const reEncryptedFolder = await FolderService.encryptFolderHelper(name, folder.color, folder.icon, folder.parentId, newKey);
          migratedFolders.push({ ...reEncryptedFolder, id: folder.id });
        } catch (err) {
          console.error(`Migration failed for folder ${folder.id}`, err);
        }
      }

      // 4. Batch update DB
      await db.transaction('rw', [db.vault, db.folders], async () => {
        if (migratedEntries.length > 0) await db.vault.bulkPut(migratedEntries);
        if (migratedFolders.length > 0) await db.folders.bulkPut(migratedFolders);
      });

      // 5. Update Verifier (Validator)
      const encoder = new TextEncoder();
      const dataBytes = encoder.encode(VALIDATOR_TEXT);
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv as any },
        newKey,
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

      // 6. Update Storage Metadata
      const newMetadata = {
        ...oldMetadata,
        iterations: targetIterations,
        version: 6,
        migratedAt: Date.now()
      };

      localStorage.setItem(MASTER_METADATA_KEY, JSON.stringify(newMetadata));
      localStorage.setItem(MASTER_VERIFIER_KEY, JSON.stringify(verifierBlob));

      if ((window as any).electronAPI?.vault) {
        await (window as any).electronAPI.vault.setVerifier(verifierBlob);
      }

      // 7. Security flag for recovery
      localStorage.setItem('aegis_recovery_sync_required', 'true');

      console.log(`[Security] Vault successfully migrated to ${targetIterations} iterations.`);
      return { key: newKey, raw: newRaw };
    } catch (e) {
      console.error("Vault migration failed critically:", e);
      return oldData; // Fallback
    }
  }

  private static async encryptEntryHelper(
    plainEntry: Partial<VaultEntry> & { sensitive: SensitiveData; title?: string; username?: string },
    masterKey: CryptoKey
  ): Promise<VaultEntry> {
    const sensitiveCopy = { ...plainEntry.sensitive };
    let encryptedFile: Uint8Array | undefined;
    let fileIv: Uint8Array | undefined;
    let fileTag: Uint8Array | undefined;

    if (sensitiveCopy.fileBlob instanceof Uint8Array) {
      const resp = await CryptoService.encryptBinary(sensitiveCopy.fileBlob, masterKey);
      encryptedFile = resp.ciphertext;
      fileIv = resp.iv;
      fileTag = resp.tag;
      delete sensitiveCopy.fileBlob;
    }

    const sensitiveJson = JSON.stringify(sensitiveCopy);
    const { ciphertext, iv, tag } = await CryptoService.encrypt(sensitiveJson, masterKey);

    const displayTitle = plainEntry.title || 'Unnamed Entry';
    const displayUsername = plainEntry.username || '';

    const titleRes = await CryptoService.encrypt(displayTitle, masterKey);
    const usernameRes = await CryptoService.encrypt(displayUsername, masterKey);

    const metadataPayload = JSON.stringify({
      category: plainEntry.category || Category.LOGIN,
      folderId: plainEntry.folderId,
      updatedAt: Date.now(),
      isFavorite: plainEntry.isFavorite,
      fileSize: plainEntry.fileSize,
      deletedAt: (plainEntry as any).deletedAt
    });

    const metaRes = await CryptoService.encrypt(metadataPayload, masterKey);
    const securityScore = this.calculateStrength(plainEntry.sensitive.password || '');

    return {
      id: plainEntry.id || crypto.randomUUID(),
      encryptedTitle: titleRes.ciphertext,
      titleIv: titleRes.iv,
      titleTag: titleRes.tag,
      encryptedUsername: usernameRes.ciphertext,
      usernameIv: usernameRes.iv,
      usernameTag: usernameRes.tag,
      encryptedMetadata: metaRes.ciphertext,
      metadataIv: metaRes.iv,
      metadataTag: metaRes.tag,
      category: Category.LOGIN,
      updatedAt: Date.now(),
      isFavorite: plainEntry.isFavorite || false,
      folderId: plainEntry.folderId,
      deletedAt: (plainEntry as any).deletedAt,
      securityScore,
      fileSize: plainEntry.fileSize,
      encryptedData: ciphertext,
      iv: iv,
      tag: tag,
      encryptedFile,
      fileIv,
      fileTag
    } as VaultEntry;
  }
}
