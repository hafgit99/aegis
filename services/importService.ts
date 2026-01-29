import { db } from '../db';
import { VaultEntry, Category, SensitiveData } from '../types';
import { CryptoService } from './cryptoService';
import Papa from 'papaparse';
import { BitwardenImporter } from './import/bitwardenImporter';
import { LastPassImporter } from './import/lastpassImporter';
import { KeePassImporter } from './import/keepassImporter';
import { OnePasswordImporter } from './import/onePasswordImporter';

export interface ImportEntry extends Partial<VaultEntry> {
  title?: string;
  username?: string;
  sensitive: SensitiveData;
}

export interface ImportConflict {
  existing: VaultEntry;
  incoming: ImportEntry;
}

export class ImportService {
  /**
   * Decrypts an Aegis Backup (.aegis)
   */
  static async decryptBackup(file: File, masterKey: CryptoKey): Promise<any[]> {
    try {
      let text = await file.text();
      text = text.replace(/^\uFEFF/, '').trim();
      const data = JSON.parse(text);

      if (data.hint !== "AEGIS_VAULT_BACKUP" && data.hint !== "AEGIS_VAULT_CSV_BACKUP") {
        throw new Error("INVALID_FORMAT");
      }

      let ciphertext = new Uint8Array(CryptoService.base64ToArrayBuffer(data.payload));
      const iv = new Uint8Array(CryptoService.base64ToArrayBuffer(data.iv));
      let tag = new Uint8Array(CryptoService.base64ToArrayBuffer(data.tag || ""));

      // Support for legacy backups where tag was appended to payload
      if (tag.length === 0 && ciphertext.length > 16) {
        const actualCiphertext = ciphertext.slice(0, ciphertext.length - 16);
        const actualTag = ciphertext.slice(ciphertext.length - 16);
        ciphertext = actualCiphertext;
        tag = actualTag;
      }

      const decryptedStr = await CryptoService.decrypt(ciphertext, masterKey, iv, tag);

      if (data.hint === "AEGIS_VAULT_CSV_BACKUP") {
        return this.parseCSVText(decryptedStr);
      }

      const bundle = JSON.parse(decryptedStr);
      return bundle.entries || [];
    } catch (e: any) {
      if (e.message === "INVALID_FORMAT") throw e;
      if (e.message === "AUTH_FAILED") throw e;

      // Web Crypto API throws "OperationError" for tag mismatch (wrong password/key)
      if (e.name === "OperationError" || e.message.includes("OperationError")) {
        throw new Error("AUTH_FAILED");
      }

      console.error("[Import] Backup decryption error:", e.message || e);
      // Don't blanket mask everything as AUTH_FAILED anymore, let real errors surface if possible
      // but usually decryption issues ARE auth issues.
      throw new Error(`IMPORT_DECRYPT_ERROR: ${e.message}`);
    }
  }

  /**
   * Decrypts an Aegis Backup using a password directly (for portable imports)
   */
  static async decryptBackupWithPassword(file: File, password: string): Promise<any[]> {
    try {
      let text = await file.text();
      text = text.replace(/^\uFEFF/, '').trim();
      const data = JSON.parse(text);

      console.log("[Import] Backup file parsed. Hint:", data.hint, "Has salt:", !!data.salt, "Iterations:", data.iterations);

      // Relax format check: if it has payload and iv, it's likely a backup even if hint is missing
      if (data.hint !== "AEGIS_VAULT_BACKUP" && data.hint !== "AEGIS_VAULT_CSV_BACKUP" && !(data.payload && data.iv)) {
        throw new Error("INVALID_FORMAT");
      }

      const ciphertext = new Uint8Array(CryptoService.base64ToArrayBuffer(data.payload));
      const iv = new Uint8Array(CryptoService.base64ToArrayBuffer(data.iv));
      const tag = new Uint8Array(CryptoService.base64ToArrayBuffer(data.tag || ""));

      console.log("[Import] Ciphertext length:", ciphertext.length, "IV length:", iv.length, "Tag length:", tag.length);

      let importKey: CryptoKey;

      // If the backup has its own salt/iterations, use them!
      if (data.salt && data.iterations) {
        console.log("[Import] Using backup's own salt and iterations:", data.iterations);
        const saltBytes = new Uint8Array(CryptoService.base64ToArrayBuffer(data.salt));
        importKey = await CryptoService.deriveKeyFromPassword(password, saltBytes, data.iterations);
      } else {
        // Legacy fallback: Use current vault parameters
        console.log("[Import] Backup has no salt/iterations, using vault's current parameters");
        try {
          const currentMeta = JSON.parse(localStorage.getItem('aegis_vault_metadata') || '{}');
          const salt = currentMeta.salt ? new Uint8Array(CryptoService.base64ToArrayBuffer(currentMeta.salt)) : new Uint8Array(16);
          const iterations = currentMeta.iterations || 20;
          console.log("[Import] Using vault salt, iterations:", iterations);
          importKey = await CryptoService.deriveKeyFromPassword(password, salt, iterations);
        } catch (legacyError) {
          console.error("[Import] Legacy fallback failed:", legacyError);
          throw new Error("AUTH_FAILED");
        }
      }

      let ciphertextBytes = ciphertext;
      let tagBytes = tag;

      // Support for legacy backups where tag was appended to payload
      if (tagBytes.length === 0 && ciphertextBytes.length > 16) {
        tagBytes = ciphertextBytes.slice(ciphertextBytes.length - 16);
        ciphertextBytes = ciphertextBytes.slice(0, ciphertextBytes.length - 16);
      }

      try {
        console.log("[Import] Attempting decryption with derived key...");
        const decryptedStr = await CryptoService.decrypt(ciphertextBytes, importKey, iv, tagBytes);
        console.log("[Import] Decryption successful, decrypted length:", decryptedStr.length);

        if (data.hint === "AEGIS_VAULT_CSV_BACKUP") {
          return this.parseCSVText(decryptedStr);
        }

        const bundle = JSON.parse(decryptedStr);
        console.log("[Import] Bundle parsed, entries count:", bundle.entries?.length || 0);
        return bundle.entries || [];
      } catch (decryptErr: any) {
        console.error("[Import] Primary decryption failed:", decryptErr.name, decryptErr.message);
        // SECONDARY FALLBACK: If standard salt fails for an OLD backup
        if (!data.salt) {
          console.log("[Import] Standard decryption failed, trying legacy fallbacks...");

          // List of common configurations from previous versions
          const fallbacks = [
            { type: 'argon', salt: new Uint8Array(16), iterations: 20 },
            { type: 'argon', salt: new Uint8Array(16), iterations: 19 },
            { type: 'pbkdf2', salt: new Uint8Array(16), iterations: 600000 },
            { type: 'pbkdf2', salt: new Uint8Array(16), iterations: 1000000 }
          ];

          for (const fb of fallbacks) {
            try {
              console.log(`[Import] Retrying with ${fb.type}, salt: zero, iterations: ${fb.iterations}...`);
              let fbKey: CryptoKey;
              if (fb.type === 'argon') {
                fbKey = await CryptoService.deriveKeyFromPassword(password, fb.salt, fb.iterations);
              } else {
                fbKey = await CryptoService.deriveKeyPBKDF2(password, fb.salt, fb.iterations);
              }
              const decryptedStr = await CryptoService.decrypt(ciphertextBytes, fbKey, iv, tagBytes);
              const bundle = JSON.parse(decryptedStr);
              return bundle.entries || [];
            } catch {
              continue;
            }
          }
        }
        throw decryptErr;
      }
    } catch (e: any) {
      console.error("[Import] Backup password-based decryption specific error:", e);
      if (e.name === "OperationError" || e.message?.includes("operation failed") || e.message?.includes("Tag mismatch")) {
        throw new Error("AUTH_FAILED");
      }
      throw e;
    }
  }

  private static parseCSVText(text: string): any[] {
    const firstLine = text.split('\n')[0] || '';
    const commaCount = (firstLine.match(/,/g) || []).length;
    const semiCount = (firstLine.match(/;/g) || []).length;
    const delimiter = semiCount > commaCount ? ';' : ',';

    const parseResult = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      delimiter: delimiter,
      transform: (value: string) => value.trim()
    });

    if (parseResult.errors && parseResult.errors.length > 0) {
      const criticalErrors = parseResult.errors.filter(e => e.row !== undefined);
      if (criticalErrors.length > 0) {
        console.warn('[CSV Import] Parse errors detected:', criticalErrors);
      }
    }

    if (!parseResult.data || parseResult.data.length === 0) {
      return [];
    }

    return parseResult.data.map((rawData: any) => this.mapToAegisEntry(rawData));
  }

  /**
   * Akıllı alan eşleme ve kategori tespiti
   */
  private static mapToAegisEntry(raw: any): ImportEntry {
    const normalize = (s: string) => s.toLowerCase()
      .replace(/[\s_-]/g, '')
      .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
      .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c');

    const deepSearch = (obj: any, targetKeys: string[]): any => {
      if (!obj || typeof obj !== 'object') return undefined;

      const normalizedTargets = targetKeys.map(normalize);

      // 1. Önceliğe göre (targetKeys sırasıyla) mevcut seviyede ara
      for (const target of normalizedTargets) {
        for (const key of Object.keys(obj)) {
          if (normalize(key) === target) {
            const val = obj[key];
            if (val !== undefined && val !== null) {
              const strVal = String(val).trim();
              if (strVal !== "" && strVal.toLowerCase() !== "null" && strVal.toLowerCase() !== "undefined") {
                return val;
              }
            }
          }
        }
      }

      // 2. Alt objelerde derinlemesine ara (recursive)
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
          const found = deepSearch(obj[key], targetKeys);
          if (found) return found;
        }
      }
      return undefined;
    };

    // Genişletilmiş ve önceliklendirilmiş anahtar listesi
    const keys = {
      title: ['title', 'name', 'label', 'account', 'foldername', 'displayname', 'baslik', 'ad', 'isim', 'siteadi', 'kayitadi', 'subject', 'organization_name'],
      username: ['username', 'user', 'email', 'login', 'id', 'identifier', 'kimlik', 'kullanici', 'login_username', 'loginusername', 'loginuser', 'loginemail', 'emailaddress', 'kullaniciadi', 'eposta', 'uyeadi', 'mail', 'mailadresi', 'account_id', 'login_name', 'loginname', 'login_id', 'account_name'],
      password: ['password', 'pass', 'secret', 'login_password', 'loginpassword', 'key', 'value', 'credential', 'sifre', 'parola', 'parolam', 'code'],
      notes: ['notes', 'note', 'comment', 'description', 'content', 'extra', 'notlar', 'aciklama', 'detay', 'remarks', 'body'],
      url: ['url', 'uri', 'website', 'login_uri', 'loginuri', 'link', 'site', 'location', 'adres', 'baglanti', 'websitesi', 'linki', 'hostname'],
      card: ['cardnumber', 'card_number', 'number', 'kartno', 'kartnumarasi', 'creditcard', 'cc_number']
    };

    let title = deepSearch(raw, keys.title);
    const username = deepSearch(raw, keys.username) || '';
    const password = deepSearch(raw, keys.password) || '';
    const notes = deepSearch(raw, keys.notes) || '';
    const url = deepSearch(raw, keys.url) || '';

    // Ek dosya verisi tespiti
    const fileBlob = deepSearch(raw, ['fileblob', 'base64', 'attachment', 'data', 'blob', 'file_content']);
    const fileName = deepSearch(raw, ['filename', 'attachmentname', 'file_name']);

    // Kart detayları tespiti
    let cardDetails: any = undefined;
    const cardNumber = deepSearch(raw, keys.card);

    if (cardNumber) {
      cardDetails = {
        number: String(cardNumber),
        expiry: deepSearch(raw, ['expiry', 'card_expiry', 'expirationdate', 'skt', 'expirydate', 'exp_month', 'exp_year']) || '',
        cvv: deepSearch(raw, ['cvv', 'card_cvv', 'cvc', 'securitycode', 'guvenlikkodu', 'cvc2', 'pin']) || '',
        holder: deepSearch(raw, ['holder', 'cardholder', 'cardholdername', 'kartuzerindekiisim', 'holderName', 'name_on_card']) || ''
      };
    } else if (raw.cardDetails) {
      if (typeof raw.cardDetails === 'string') {
        try {
          cardDetails = JSON.parse(raw.cardDetails);
        } catch {
          cardDetails = raw.cardDetails;
        }
      } else {
        cardDetails = raw.cardDetails;
      }
    }

    // Başlık Fallback Mekanizması
    if (!title || String(title).trim() === "" || String(title).toLowerCase() === "imported entry") {
      if (cardNumber) title = `Card: ${String(cardNumber).slice(-4)}`;
      else if (url) title = url.split('/')[2] || url;
      else if (username) title = username;
      else title = 'Imported Entry';
    }

    // Kullanıcı Adı Fallback (Geliştirilmiş)
    let finalUsername = username;

    // Eğer username boşsa, diğer alanlardan deneme
    if (!finalUsername || finalUsername.trim() === '') {
      const altUser = deepSearch(raw, ['email', 'mail', 'eposta', 'login', 'user', 'id']);
      if (altUser) {
        finalUsername = String(altUser).trim();
      }
    }

    // Hala boşsa URL'den domain kullan
    if (!finalUsername || finalUsername.trim() === '') {
      if (url) {
        finalUsername = url.split('/')[2] || url;
      }
    }

    // Son boş kontrol
    finalUsername = finalUsername || '';

    // Debug log
    console.log('[Import] Entry mapped - Title:', title, 'Username:', finalUsername, 'URL:', url);

    // Kategori Tespiti
    let category = raw.category || Category.LOGIN;

    if (fileBlob) {
      category = Category.FILE;
    } else if (raw.passkeyDetails || raw.sensitive?.passkeyDetails) {
      category = Category.PASSKEY;
    } else if (cardDetails) {
      category = Category.CARD;
    } else if (notes && !password && !username) {
      category = Category.NOTE;
    } else if (password || username) {
      category = Category.LOGIN;
    }

    const sensitiveData: SensitiveData = {
      password: String(password),
      notes: String(notes),
      url: String(url),
      customFields: Array.isArray(raw.customFields) ? raw.customFields : []
    };

    if (fileBlob) {
      sensitiveData.fileBlob = fileBlob;
      sensitiveData.fileName = String(fileName || `imported_file_${Date.now()}`);
      sensitiveData.fileMime = String(deepSearch(raw, ['filemime', 'mimetype', 'contenttype']) || 'application/octet-stream');
    }

    if (cardDetails) {
      sensitiveData.cardDetails = cardDetails;
    }

    if (raw.passkeyDetails || raw.sensitive?.passkeyDetails) {
      sensitiveData.passkeyDetails = raw.passkeyDetails || raw.sensitive.passkeyDetails;
    }

    return {
      title: String(title),
      username: String(finalUsername),
      category: category as Category,
      updatedAt: Date.now(),
      sensitive: sensitiveData
    };
  }

  /**
   * JSON dosyasını akıllı eşleme ile parse eder
   */
  static async parseJSON(file: File): Promise<ImportEntry[]> {
    try {
      let text = await file.text();
      text = text.replace(/^\uFEFF/, '').trim();
      const data = JSON.parse(text);

      if (data.hint === "AEGIS_VAULT_BACKUP" || (data.payload && data.iv)) {
        throw new Error("USE_SECURE_IMPORT");
      }

      // Bitwarden detection
      if (data.items && Array.isArray(data.items) && data.folders) {
        return BitwardenImporter.parseJSON(data);
      }

      // 1Password detection
      if (data.accounts && Array.isArray(data.accounts)) {
        return OnePasswordImporter.parseJSON(data);
      }

      const list = Array.isArray(data) ? data : (data.entries || data.items || [data]);
      return list.map((item: any) => this.mapToAegisEntry(item));
    } catch (e: any) {
      if (e.message === "USE_SECURE_IMPORT") throw e;
      console.error("JSON Parse Error Details:", e);
      throw new Error("JSON_PARSE_ERROR");
    }
  }

  static async parseCSV(file: File): Promise<ImportEntry[]> {
    const text = await file.text();
    const cleanText = text.replace(/^\uFEFF/, '').trim();

    // Peek at headers to detect format
    const firstLine = cleanText.split('\n')[0].toLowerCase();

    if (firstLine.includes('grouping') && firstLine.includes('extra')) {
      return LastPassImporter.parseCSV(file);
    }

    if (firstLine.includes('group') && firstLine.includes('title') && firstLine.includes('notes')) {
      return KeePassImporter.parseCSV(file);
    }

    return this.parseCSVText(cleanText);
  }

  static deduplicateIncoming(incoming: ImportEntry[]): ImportEntry[] {
    const normalize = (s: string) => (s || '').toLowerCase().trim();
    const uniqueIncoming: ImportEntry[] = [];
    const seenIncoming = new Set<string>();

    for (const item of incoming) {
      const key = `${normalize(item.title || '')}|${normalize(item.username || '')}`;
      if (!seenIncoming.has(key)) {
        seenIncoming.add(key);
        uniqueIncoming.push(item);
      }
    }

    return uniqueIncoming;
  }

  static async findConflicts(incoming: ImportEntry[], existingEntries: VaultEntry[] = []): Promise<ImportConflict[]> {
    const conflicts: ImportConflict[] = [];
    const normalize = (s: string) => (s || '').toLowerCase().trim();

    const uniqueIncoming = this.deduplicateIncoming(incoming);

    for (const item of uniqueIncoming) {
      if (!item.title) continue;
      const itemTitle = normalize(item.title);
      const itemUser = normalize(item.username || '');

      let match: VaultEntry | undefined;

      // Perform memory-based conflict detection if existing entries are provided
      // This is necessary for v4+ encrypted records which don't have titles in the DB index
      if (existingEntries && existingEntries.length > 0) {
        match = existingEntries.find(existing => {
          const existingTitle = normalize(existing.title || '');
          const existingUser = normalize(existing.username || '');
          return existingTitle === itemTitle && existingUser === itemUser;
        });
      } else {
        // Fallback to DB check for legacy entries or when memory list is not available
        // Note: db.vault must have 'title' indexed in db.ts for this to work without crashing
        match = await db.vault.where('title').equalsIgnoreCase(item.title).first();
      }

      if (match) {
        conflicts.push({ existing: match, incoming: item });
      }
    }
    return conflicts;
  }
}
