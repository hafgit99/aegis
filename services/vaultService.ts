
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

  static async deriveMasterKey(password: string): Promise<CryptoKey> {
    const salt = this.getSalt();
    const key = await CryptoService.deriveKeyFromPassword(password, salt);

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

    return key;
  }

  static async setup(password: string): Promise<CryptoKey> {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const saltB64 = CryptoService.arrayBufferToBase64(salt.buffer);

    try {
      const key = await CryptoService.deriveKeyFromPassword(password, salt);

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
        version: 4,
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
      await RecoveryService.setupRecovery(key);

      return key;
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

    // Optimization: Store files as binary to avoid Base64 inflation
    if (sensitiveCopy.fileBlob instanceof Uint8Array) {
      const fileResult = await CryptoService.encryptBinary(sensitiveCopy.fileBlob, masterKey);

      encryptedFile = fileResult.ciphertext;
      fileIv = fileResult.iv;
      fileTag = fileResult.tag;

      delete sensitiveCopy.fileBlob; // Remove from JSON payload
    }

    // SECURITY: Encrypt sensitive data (password, notes, etc.)
    const sensitiveJson = JSON.stringify(sensitiveCopy);
    const { ciphertext, iv, tag } = await CryptoService.encrypt(sensitiveJson, masterKey);

    // SECURITY: Also encrypt metadata (title, username) for defense-in-depth
    const displayTitle = plainEntry.title || (plainEntry.category === Category.FILE ? `Secure-Asset-${crypto.randomUUID().slice(0, 8)}` : 'Unnamed Entry');
    const displayUsername = plainEntry.username || '';

    const { ciphertext: titleCiphertext, iv: titleIv, tag: titleTag } = await CryptoService.encrypt(displayTitle, masterKey);
    const { ciphertext: usernameCiphertext, iv: usernameIv, tag: usernameTag } = await CryptoService.encrypt(displayUsername, masterKey);

    const securityScore = this.calculateStrength(plainEntry.sensitive.password || '');

    const entry: VaultEntry = {
      id: plainEntry.id || crypto.randomUUID(),
      encryptedTitle: titleCiphertext,
      titleIv: titleIv,
      titleTag: titleTag,
      encryptedUsername: usernameCiphertext,
      usernameIv: usernameIv,
      usernameTag: usernameTag,
      category: plainEntry.category || Category.LOGIN,
      updatedAt: Date.now(),
      isFavorite: plainEntry.isFavorite || false,
      folderId: plainEntry.folderId,
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
    // Perform encryptions in parallel for better speed
    const encryptedEntries = await Promise.all(items.map(async (plainEntry) => {
      try {
        const sensitiveJson = JSON.stringify(plainEntry.sensitive);
        const { ciphertext, iv, tag } = await CryptoService.encrypt(sensitiveJson, masterKey);

        // SECURITY: Encrypt metadata for bulk import too
        const displayTitle = plainEntry.title || (plainEntry.category === Category.FILE ? `Secure-Asset-${crypto.randomUUID().slice(0, 8)}` : 'Unnamed Entry');
        const displayUsername = plainEntry.username || '';

        const { ciphertext: titleCiphertext, iv: titleIv, tag: titleTag } = await CryptoService.encrypt(displayTitle, masterKey);
        const { ciphertext: usernameCiphertext, iv: usernameIv, tag: usernameTag } = await CryptoService.encrypt(displayUsername, masterKey);

        const securityScore = this.calculateStrength(plainEntry.sensitive.password || '');

        return {
          id: plainEntry.id || crypto.randomUUID(),
          encryptedTitle: titleCiphertext,
          titleIv: titleIv,
          titleTag: titleTag,
          encryptedUsername: usernameCiphertext,
          usernameIv: usernameIv,
          usernameTag: usernameTag,
          category: plainEntry.category || Category.LOGIN,
          updatedAt: Date.now(),
          isFavorite: plainEntry.isFavorite || false,
          folderId: plainEntry.folderId,
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
      const decryptedJson = await CryptoService.decrypt(entry.encryptedData, masterKey, entry.iv, entry.tag);
      const sensitive: SensitiveData = JSON.parse(decryptedJson);

      // Memory Optimized: If a separate binary file exists, decrypt it directly
      if (entry.encryptedFile && entry.fileIv && entry.fileTag) {
        const decryptedFile = await CryptoService.decryptBinary(entry.encryptedFile, masterKey, entry.fileIv, entry.fileTag);
        sensitive.fileBlob = decryptedFile; // returns Uint8Array
      }

      return sensitive;
    } catch (e) {
      console.error("Decryption Error:", e);
      throw new Error("Decryption failed");
    }
  }

  // SECURITY: Decrypt metadata (title, username) for display
  static async decryptEntryMetadata(entry: VaultEntry, masterKey: CryptoKey): Promise<{ title: string; username: string }> {
    try {
      // Decrypt title (binary format)
      const decryptedTitle = await CryptoService.decrypt(entry.encryptedTitle, masterKey, entry.titleIv, entry.titleTag);

      // Decrypt username (binary format)
      const decryptedUsername = await CryptoService.decrypt(entry.encryptedUsername, masterKey, entry.usernameIv, entry.usernameTag);

      return { title: decryptedTitle, username: decryptedUsername };
    } catch (e) {
      console.error("Metadata Decryption Error:", e);
      return { title: '[Decryption Error]', username: '[Decryption Error]' };
    }
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
