import { db } from '../db';
import { VaultEntry, Category, SensitiveData } from '../types';
import { CryptoService } from './cryptoService';
import Papa from 'papaparse';

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
      console.error("[Import] Backup decryption error:", e.message || e);
      throw new Error("AUTH_FAILED");
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

      // Relax format check: if it has payload and iv, it's likely a backup even if hint is missing
      if (data.hint !== "AEGIS_VAULT_BACKUP" && data.hint !== "AEGIS_VAULT_CSV_BACKUP" && !(data.payload && data.iv)) {
        throw new Error("INVALID_FORMAT");
      }

      const ciphertext = new Uint8Array(CryptoService.base64ToArrayBuffer(data.payload));
      const iv = new Uint8Array(CryptoService.base64ToArrayBuffer(data.iv));
      const tag = new Uint8Array(CryptoService.base64ToArrayBuffer(data.tag || ""));

      let importKey: CryptoKey;

      // If the backup has its own salt/iterations, use them!
      if (data.salt && data.iterations) {
        const saltBytes = new Uint8Array(CryptoService.base64ToArrayBuffer(data.salt));
        importKey = await CryptoService.deriveKeyFromPassword(password, saltBytes, data.iterations);
      } else {
        // Legacy fallback: Use current vault parameters
        try {
          const currentMeta = JSON.parse(localStorage.getItem('aegis_vault_metadata') || '{}');
          const salt = currentMeta.salt ? new Uint8Array(CryptoService.base64ToArrayBuffer(currentMeta.salt)) : new Uint8Array(16);
          const iterations = currentMeta.iterations || 15;
          importKey = await CryptoService.deriveKeyFromPassword(password, salt, iterations);
        } catch {
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
        const decryptedStr = await CryptoService.decrypt(ciphertextBytes, importKey, iv, tagBytes);

        if (data.hint === "AEGIS_VAULT_CSV_BACKUP") {
          return this.parseCSVText(decryptedStr);
        }

        const bundle = JSON.parse(decryptedStr);
        return bundle.entries || [];
      } catch (decryptErr: any) {
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
      console.error("[Import] Backup password-based decryption failed:", e.message || e);
      throw new Error("AUTH_FAILED");
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
      // Remove BOM and trim
      text = text.replace(/^\uFEFF/, '').trim();

      const data = JSON.parse(text);

      // Aegis backup dosyası yanlışlıkla .json olarak seçilmiş olabilir
      if (data.hint === "AEGIS_VAULT_BACKUP" || (data.payload && data.iv)) {
        throw new Error("USE_SECURE_IMPORT");
      }

      const list = Array.isArray(data) ? data : (data.entries || data.items || [data]);
      return list.map((item: any) => this.mapToAegisEntry(item));
    } catch (e: any) {
      if (e.message === "USE_SECURE_IMPORT") throw e;

      // JSON parse hatalarını kullanıcı dostu hale getir
      console.error("JSON Parse Error Details:", e);
      if (e.message.toLowerCase().includes('exponent')) {
        throw new Error("INVALID_JSON_NUMBER");
      }
      throw new Error("JSON_PARSE_ERROR");
    }
  }

  static async parseCSV(file: File): Promise<ImportEntry[]> {
    const text = await file.text();
    const cleanText = text.replace(/^\uFEFF/, '').trim();
    
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

      const match = existingEntries.find(existing => {
        const existingTitle = normalize(existing.title || '');
        const existingUser = normalize(existing.username || '');
        return existingTitle === itemTitle && existingUser === itemUser;
      });

      if (match) {
        conflicts.push({ existing: match, incoming: item });
      }
    }
    return conflicts;
  }
}