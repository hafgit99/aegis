
import { VaultEntry, SensitiveData, Category, Folder } from '../types.ts';
import { CryptoService } from './cryptoService.ts';
import { RecoveryService } from './recoveryService.ts';
import { FolderService } from './folderService.ts';
import { db } from '../db.ts';
import zxcvbn from 'zxcvbn';

const MASTER_METADATA_KEY = 'aegis_vault_metadata';
const MASTER_VERIFIER_KEY = 'aegis_vault_verifier';
const DURESS_VERIFIER_KEY = 'aegis_vault_duress_verifier';
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

  static async deriveMasterKey(password: string): Promise<{ key: CryptoKey; raw: Uint8Array; duress: boolean }> {
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

    // 1. Try Main Verifier
    const verifierStr = localStorage.getItem(MASTER_VERIFIER_KEY);
    if (verifierStr) {
      try {
        const verifier = JSON.parse(verifierStr);
        const decrypted = await this.decryptWithMasterKey(key, verifier);

        if (decrypted === VALIDATOR_TEXT) {
          if ((window as any).electronAPI?.vault) {
            await (window as any).electronAPI.vault.setKey(raw, { ...verifier, salt: CryptoService.arrayBufferToBase64(salt.buffer), iterations });
          }
          return { key, raw, duress: false };
        }
      } catch (e) { /* continue to duress check */ }
    }

    // 2. Try Duress Verifier
    const duressStr = localStorage.getItem(DURESS_VERIFIER_KEY);
    if (duressStr) {
      try {
        const duressVerifier = JSON.parse(duressStr);
        const decrypted = await this.decryptWithMasterKey(key, duressVerifier);

        if (decrypted === VALIDATOR_TEXT) {
          // Alert the main process it's duress mode
          if ((window as any).electronAPI?.vault) {
            await (window as any).electronAPI.vault.setKey(raw, { ...duressVerifier, salt: CryptoService.arrayBufferToBase64(salt.buffer), iterations });
            (window as any).localStorage.setItem('aegis_duress_active', 'true');
          }
          // Log duress access (security alert internally)
          return { key, raw, duress: true };
        }
      } catch (e) { /* failed both */ }
    }

    throw new Error("WRONG_PASSWORD");
  }

  private static async decryptWithMasterKey(key: CryptoKey, verifier: any): Promise<string> {
    const encryptedBuffer = new Uint8Array(CryptoService.base64ToArrayBuffer(verifier.payload));
    const tagBuffer = new Uint8Array(CryptoService.base64ToArrayBuffer(verifier.tag));
    const ivBuffer = new Uint8Array(CryptoService.base64ToArrayBuffer(verifier.iv));

    const combined = new Uint8Array(encryptedBuffer.byteLength + tagBuffer.byteLength);
    combined.set(encryptedBuffer, 0);
    combined.set(tagBuffer, encryptedBuffer.byteLength);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBuffer as any },
      key,
      combined.buffer as any
    );

    return new TextDecoder().decode(decryptedBuffer);
  }

  static async setupDuressPassword(password: string): Promise<void> {
    const salt = this.getSalt();
    const metadata = JSON.parse(localStorage.getItem(MASTER_METADATA_KEY) || '{}');
    const iterations = metadata.iterations || CryptoService.DEFAULT_ITERATIONS;

    const { key } = await CryptoService.deriveKeyWithRaw(password, salt, iterations);

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

    const duressBlob = {
      payload: CryptoService.arrayBufferToBase64(ciphertext.buffer),
      iv: CryptoService.arrayBufferToBase64(iv.buffer),
      tag: CryptoService.arrayBufferToBase64(tag.buffer)
    };

    localStorage.setItem(DURESS_VERIFIER_KEY, JSON.stringify(duressBlob));
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
        await (window as any).electronAPI.vault.setVerifier({
          ...verifierBlob,
          salt: saltB64,
          iterations: iterations
        });
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

  // --- SQLite Support ---
  static async isMigratedToSQLite(): Promise<boolean> {
    const electronDB = (window as any).electronAPI?.db;
    if (!electronDB) return false;
    const val = await electronDB.getConfig('migration_v1_complete');
    return val === 'true';
  }

  static async migrateToSQLite(masterKey: CryptoKey): Promise<void> {
    const electronDB = (window as any).electronAPI?.db;
    if (!electronDB) return;

    console.log('[Database] Starting migration to SQLite/SQLCipher...');

    // 1. Migrate Folders
    const allFolders = await db.folders.toArray();
    console.log(`[Migration] Migrating ${allFolders.length} folders...`);
    for (const f of allFolders) {
      await electronDB.saveFolder({
        id: f.id,
        name: await FolderService.decryptFolderName(f, masterKey)
      });
    }

    // 2. Migrate Entries
    const allEntries = await db.vault.toArray();
    console.log(`[Migration] Migrating ${allEntries.length} entries...`);
    for (const entry of allEntries) {
      await electronDB.saveEntry({
        id: entry.id,
        category: entry.category,
        folderId: entry.folderId,
        payload: entry.encryptedData,
        iv: CryptoService.arrayBufferToBase64(entry.iv.buffer),
        tag: CryptoService.arrayBufferToBase64(entry.tag.buffer),
        isFavorite: entry.isFavorite ? 1 : 0
      });
    }

    await electronDB.setConfig('migration_v1_complete', 'true');

    // SECURITY: Wipe legacy IndexedDB data after successful migration
    await db.vault.clear();
    await db.folders.clear();

    console.log('[Database] Migration completed and IndexedDB wiped successfully.');
  }

  static async loadAllFromSQLite(): Promise<VaultEntry[]> {
    const electronDB = (window as any).electronAPI?.db;
    if (!electronDB) return [];

    console.log('[VaultService] Loading entries from SQLite...');
    try {
      const rows = await electronDB.getAllEntries();
      console.log(`[VaultService] Raw rows received from SQLite: ${rows.length}`);

      if (rows.length > 0) {
        console.log('[VaultService] First row sample:', rows[0]);
      }

      const mapped = rows.map((row: any) => {
        try {
          return {
            id: row.id,
            category: row.category,
            folderId: row.folder_id,
            // Payload is now Base64 string from IPC
            encryptedData: new Uint8Array(CryptoService.base64ToArrayBuffer(row.payload)),
            iv: new Uint8Array(CryptoService.base64ToArrayBuffer(row.iv)),
            tag: new Uint8Array(CryptoService.base64ToArrayBuffer(row.tag)),
            isFavorite: !!row.is_favorite,
            updatedAt: row.updated_at,

            // Metadata Encryption Fields (Base64 -> Uint8Array)
            encryptedTitle: row.encrypted_title ? new Uint8Array(CryptoService.base64ToArrayBuffer(row.encrypted_title)) : undefined,
            titleIv: row.title_iv ? new Uint8Array(CryptoService.base64ToArrayBuffer(row.title_iv)) : undefined,
            titleTag: row.title_tag ? new Uint8Array(CryptoService.base64ToArrayBuffer(row.title_tag)) : undefined,

            encryptedUsername: row.encrypted_username ? new Uint8Array(CryptoService.base64ToArrayBuffer(row.encrypted_username)) : undefined,
            usernameIv: row.username_iv ? new Uint8Array(CryptoService.base64ToArrayBuffer(row.username_iv)) : undefined,
            usernameTag: row.username_tag ? new Uint8Array(CryptoService.base64ToArrayBuffer(row.username_tag)) : undefined,

            encryptedMetadata: row.encrypted_metadata ? new Uint8Array(CryptoService.base64ToArrayBuffer(row.encrypted_metadata)) : undefined,
            metadataIv: row.metadata_iv ? new Uint8Array(CryptoService.base64ToArrayBuffer(row.metadata_iv)) : undefined,
            metadataTag: row.metadata_tag ? new Uint8Array(CryptoService.base64ToArrayBuffer(row.metadata_tag)) : undefined,

            // Binary Attachment Fields (Base64 -> Uint8Array)
            encryptedFile: row.encrypted_file ? new Uint8Array(CryptoService.base64ToArrayBuffer(row.encrypted_file)) : undefined,
            fileIv: row.file_iv ? new Uint8Array(CryptoService.base64ToArrayBuffer(row.file_iv)) : undefined,
            fileTag: row.file_tag ? new Uint8Array(CryptoService.base64ToArrayBuffer(row.file_tag)) : undefined
          };
        } catch (err) {
          console.error('[VaultService] Error mapping row:', row.id, err);
          return null; // Filtrelemek için null döndür
        }
      });

      const valid = mapped.filter((e: any) => e !== null);
      console.log(`[VaultService] Successfully mapped ${valid.length} entries.`);
      return valid;
    } catch (e) {
      console.error('[VaultService] Critical error loading from SQLite:', e);
      return [];
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

    const securityScore = plainEntry.category === Category.PASSKEY ? 100 : this.calculateStrength(plainEntry.sensitive.password || '');

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

    // PERSISTENCE TIER
    const electronDB = (window as any).electronAPI?.db;
    if (electronDB) {
      await electronDB.saveEntry({
        id: entry.id,
        category: entry.category,
        folderId: entry.folderId,
        payload: entry.encryptedData,
        iv: CryptoService.arrayBufferToBase64(entry.iv.buffer),
        tag: CryptoService.arrayBufferToBase64(entry.tag.buffer),
        isFavorite: entry.isFavorite ? 1 : 0
      });
    } else {
      await db.vault.put(entry);
    }

    if ((window as any).electronAPI?.audit) {
      await (window as any).electronAPI.audit.logEvent('ENTRY_SAVED', {
        entryId: entry.id,
        category: entry.category,
        fullEncryption: true,
        storage: electronDB ? 'sqlite' : 'indexeddb'
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
    const electronDB = (window as any).electronAPI?.db;

    // Perform encryptions in parallel for better speed
    const encryptedEntries = await Promise.all(items.map(async (plainEntry) => {
      try {
        // --- 1. TITLE & USERNAME RECOVERY ---
        let displayTitle = plainEntry.title;
        let displayUsername = plainEntry.username || (plainEntry.sensitive as any)?.username || (plainEntry.sensitive as any)?.email || (plainEntry.sensitive as any)?.user || (plainEntry.sensitive as any)?.login || (plainEntry.sensitive as any)?.id || (plainEntry.sensitive as any)?.login_name || (plainEntry.sensitive as any)?.loginuser || (plainEntry.sensitive as any)?.loginemail;

        if (!displayTitle) {
          displayTitle = (plainEntry.sensitive as any)?.title || (plainEntry.sensitive as any)?.name;
        }

        if (!displayTitle && plainEntry.encryptedTitle && plainEntry.titleIv && plainEntry.titleTag) {
          try {
            if (electronVault) {
              displayTitle = await electronVault.decrypt(plainEntry.encryptedTitle, plainEntry.titleIv, plainEntry.titleTag);
            } else {
              displayTitle = await CryptoService.decrypt(plainEntry.encryptedTitle, masterKey, plainEntry.titleIv, plainEntry.titleTag);
            }
          } catch (e) {
            console.warn(`Bulk Import: Failed to decrypt legacy title for ${plainEntry.id}`);
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
            console.warn(`Bulk Import: Failed to decrypt legacy username for ${plainEntry.id}`);
          }
        }

        displayTitle = displayTitle || (plainEntry.category === Category.FILE ? `Secure-Asset-${crypto.randomUUID().slice(0, 8)}` : 'Unnamed Entry');
        displayUsername = displayUsername || '';

        // --- 2. ATTACHMENT HANDLING ---
        const sensitiveCopy = { ...plainEntry.sensitive };
        let encryptedFile: Uint8Array | undefined;
        let fileIv: Uint8Array | undefined;
        let fileTag: Uint8Array | undefined;

        let fileData = sensitiveCopy.fileBlob || (plainEntry as any).fileBlob;
        if (typeof fileData === 'string' && fileData.length > 0) {
          try {
            fileData = new Uint8Array(CryptoService.base64ToArrayBuffer(fileData));
          } catch (e) {
            console.error("Bulk Import: Base64 decode failed for attachment", e);
          }
        }

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
          delete sensitiveCopy.fileBlob;
        }

        // --- 3. FULL PACKAGE ENCRYPTION (v4) ---
        const fullPackage = {
          title: displayTitle,
          username: displayUsername,
          category: plainEntry.category || Category.LOGIN,
          folderId: plainEntry.folderId,
          updatedAt: Date.now(),
          isFavorite: plainEntry.isFavorite || false,
          fileSize: (fileData as Uint8Array)?.length || plainEntry.fileSize || 0,
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

        return {
          id: plainEntry.id || crypto.randomUUID(),
          encryptedTitle: new Uint8Array(0),
          titleIv: new Uint8Array(0),
          titleTag: new Uint8Array(0),
          encryptedUsername: new Uint8Array(0),
          usernameIv: new Uint8Array(0),
          usernameTag: new Uint8Array(0),
          encryptedMetadata: new Uint8Array(0),
          metadataIv: new Uint8Array(0),
          metadataTag: new Uint8Array(0),
          encryptedData: ciphertext,
          iv: iv,
          tag: tag,
          category: fullPackage.category,
          updatedAt: fullPackage.updatedAt,
          isFavorite: fullPackage.isFavorite,
          folderId: fullPackage.folderId,
          deletedAt: fullPackage.deletedAt,
          fileSize: fullPackage.fileSize,
          encryptedFile,
          fileIv,
          fileTag,
          securityScore: fullPackage.category === Category.PASSKEY ? 100 : this.calculateStrength(fullPackage.sensitive.password || ''),
          version: 4
        } as any;
      } catch (e) {
        console.error(`Bulk Import: Failed to process entry`, e);
        return null;
      }
    }));

    const validEntries = encryptedEntries.filter((e): e is VaultEntry => e !== null);

    if (validEntries.length > 0) {
      if (electronDB) {
        console.log(`[Import] Saving ${validEntries.length} entries to SQLite using bulk save...`);
        const sqliteEntries = validEntries.map(entry => ({
          id: entry.id,
          category: entry.category,
          folderId: entry.folderId,
          payload: entry.encryptedData, // Send binary Uint8Array for SQLite BLOB
          iv: CryptoService.arrayBufferToBase64(entry.iv),
          tag: CryptoService.arrayBufferToBase64(entry.tag),
          isFavorite: entry.isFavorite ? 1 : 0,
          updatedAt: entry.updatedAt
        }));
        await electronDB.bulkSaveEntries(sqliteEntries);
      } else {
        await db.vault.bulkPut(validEntries);
      }
      console.log(`[Import] Successfully imported ${validEntries.length} entries.`);
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
          title: fullPackage.title || 'Unnamed Entry',
          username: fullPackage.username || '',
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
      if (entry.encryptedMetadata && entry.encryptedMetadata.length > 0 && entry.metadataIv && entry.metadataTag) {
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
        title: decryptedTitle || 'Unnamed Entry',
        username: decryptedUsername || ''
      };
    } catch (e) {
      console.error("Metadata Decryption Error for entry", entry.id, ":", e);
      return {
        title: '[Decryption Error]',
        username: '[Decryption Error]',
        category: entry.category,
        folderId: entry.folderId,
        updatedAt: entry.updatedAt,
        isFavorite: entry.isFavorite,
        deletedAt: entry.deletedAt,
        fileSize: entry.fileSize
      };
    }
  }

  static async updateEntryMetadata(
    id: string,
    changes: { isFavorite?: boolean; deletedAt?: number | undefined; folderId?: string | undefined },
    masterKey: CryptoKey
  ): Promise<void> {
    const electronVault = (window as any).electronAPI?.vault;
    const electronDB = (window as any).electronAPI?.db;

    let entry: VaultEntry | undefined;

    if (electronDB) {
      // SQLite'dan entry'i bulmak için helper lazım, ama şimdilik hafızadaki listeden veya yeniden çekerek bulalım
      // Performans için tekil get olmalıydı ama electronDB.getAllEntries() var şimdilik
      // TODO: electronDB.getEntry(id) eklenmeli
      const allEntries = await electronDB.getAllEntries();
      entry = allEntries.find((e: any) => e.id === id);
    } else {
      entry = await db.vault.get(id);
    }

    if (!entry) throw new Error("Entry not found");

    // 1. Decrypt current metadata to get base
    let currentMeta: any = {
      category: entry.category,
      folderId: entry.folderId,
      updatedAt: entry.updatedAt,
      isFavorite: entry.isFavorite,
      fileSize: entry.fileSize,
      deletedAt: entry.deletedAt
    };

    if (entry.encryptedMetadata && entry.encryptedMetadata.length > 0 && entry.metadataIv && entry.metadataTag) {
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
    if (electronDB) {
      // In SQLite, we store the same encryptedData blob, but we might need to update isFavorite etc.
      // Since our current SQLite schema stores is_favorite explicitly, we update that.
      await electronDB.saveEntry({
        id: entry.id,
        category: entry.category,
        folderId: changes.folderId !== undefined ? changes.folderId : entry.folderId,
        payload: entry.encryptedData,
        iv: CryptoService.arrayBufferToBase64(entry.iv.buffer),
        tag: CryptoService.arrayBufferToBase64(entry.tag.buffer),
        isFavorite: changes.isFavorite !== undefined ? (changes.isFavorite ? 1 : 0) : (entry.isFavorite ? 1 : 0)
      });
    } else {
      await db.vault.update(id, {
        encryptedMetadata,
        metadataIv,
        metadataTag,
        updatedAt: 0,
        isFavorite: false,
        folderId: undefined,
        deletedAt: undefined,
      });
    }
  }

  static async deleteEntry(id: string): Promise<void> {
    const electronDB = (window as any).electronAPI?.db;
    if (electronDB) {
      await electronDB.deleteEntry(id);
    } else {
      await db.vault.delete(id);
    }

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

      // Normalizasyon Yardımcısı
      const norm = (s: string) => (s || '').toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, "")
        .replace(/[\u200B-\u200D\uFEFF]/g, '');

      for (const entry of allEntries) {
        try {
          const meta = await this.decryptEntryMetadata(entry, masterKey);
          // Başlık, Kullanıcı Adı ve Kategori bazlı anahtar
          const key = `${norm(meta.title)}|${norm(meta.username)}|${meta.category}`;

          const existing = entryMap.get(key);
          if (existing) {
            // Decrypt existing meta to compare updatedAt
            const existingMeta = await this.decryptEntryMetadata(existing, masterKey);

            // Hangisi daha yeniyse onu tut (Favori olanı koru)
            const keepNew = (meta.isFavorite && !existingMeta.isFavorite) ||
              ((meta.updatedAt || 0) > (existingMeta.updatedAt || 0) && meta.isFavorite === existingMeta.isFavorite);

            if (keepNew) {
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
        console.log(`[Deduplication] ${toDelete.length} duplicates found. cleaning up...`);
        await db.vault.bulkDelete(toDelete);
        console.log(`[Deduplication] Cleaned ${toDelete.length} entries.`);
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
