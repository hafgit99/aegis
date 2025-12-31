import { db } from '../db';
import { VaultEntry, Category, SensitiveData } from '../types';
import { CryptoService } from './cryptoService';

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

      const ciphertext = new Uint8Array(CryptoService.base64ToArrayBuffer(data.payload));
      const iv = new Uint8Array(CryptoService.base64ToArrayBuffer(data.iv));
      const tag = new Uint8Array(CryptoService.base64ToArrayBuffer(data.tag || ""));

      const decryptedStr = await CryptoService.decrypt(ciphertext, masterKey, iv, tag);

      if (data.hint === "AEGIS_VAULT_CSV_BACKUP") {
        return this.parseCSVText(decryptedStr);
      }

      const bundle = JSON.parse(decryptedStr);
      return bundle.entries || [];
    } catch (e: any) {
      if (e.message === "INVALID_FORMAT") throw e;
      throw new Error("AUTH_FAILED");
    }
  }

  /**
   * Helper to parse CSV string content (internal)
   */
  private static parseCSVText(text: string): any[] {
    const rows = text.split('\n').filter(r => r.trim());
    if (rows.length < 2) return [];

    const firstRow = rows[0];
    const commaCount = (firstRow.match(/,/g) || []).length;
    const semiCount = (firstRow.match(/;/g) || []).length;
    const delimiter = semiCount > commaCount ? ';' : ',';

    const headerRow = this.parseCSVRow(firstRow, delimiter);
    const cols = headerRow.map(c => c.toLowerCase().trim());
    const results: any[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = this.parseCSVRow(rows[i], delimiter);
      if (row.length === 0) continue;

      const rawData: any = {};
      cols.forEach((col, idx) => {
        if (row[idx] !== undefined) {
          rawData[col] = row[idx];
        }
      });

      results.push(this.mapToAegisEntry(rawData));
    }

    return results;
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
      title: ['title', 'name', 'label', 'foldername', 'displayname', 'baslik', 'ad', 'isim', 'siteadi', 'kayitadi', 'subject', 'organization_name'],
      username: ['username', 'user', 'email', 'login_username', 'loginusername', 'loginuser', 'loginemail', 'emailaddress', 'kullaniciadi', 'eposta', 'uyeadi', 'mail', 'account'],
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

    // Kullanıcı Adı Fallback
    const finalUsername = username || (url ? (url.split('/')[2] || url) : '');

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

  /**
   * CSV dosyasını akıllı eşleme ile parse eder
   */
  static async parseCSV(file: File): Promise<ImportEntry[]> {
    const text = await file.text();
    const cleanText = text.replace(/^\uFEFF/, '').trim();
    const rows = cleanText.split('\n').filter(r => r.trim());
    if (rows.length < 2) return [];

    // Ayırıcı Tespiti (Virgül mü Noktalı Virgül mü?)
    const firstRow = rows[0];
    const commaCount = (firstRow.match(/,/g) || []).length;
    const semiCount = (firstRow.match(/;/g) || []).length;
    const delimiter = semiCount > commaCount ? ';' : ',';

    const headerRow = this.parseCSVRow(firstRow, delimiter);
    const cols = headerRow.map(c => c.toLowerCase().trim());
    const results: ImportEntry[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = this.parseCSVRow(rows[i], delimiter);
      if (row.length === 0) continue;

      const rawData: any = {};
      cols.forEach((col, idx) => {
        if (row[idx] !== undefined) {
          rawData[col] = row[idx];
        }
      });

      results.push(this.mapToAegisEntry(rawData));
    }

    return results;
  }

  private static parseCSVRow(row: string, delimiter: string = ','): string[] {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      const nextChar = row[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  static async findConflicts(incoming: ImportEntry[]): Promise<ImportConflict[]> {
    const conflicts: ImportConflict[] = [];
    for (const item of incoming) {
      if (!item.title) continue;
      const match = await db.vault.where('title').equalsIgnoreCase(item.title).first();
      if (match) {
        conflicts.push({ existing: match, incoming: item });
      }
    }
    return conflicts;
  }
}