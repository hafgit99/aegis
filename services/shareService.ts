/**
 * Aegis Vault - QR Code Share Service
 * 100% Offline QR-based password sharing with dual-layer encryption
 */

import { CryptoService } from './cryptoService';
import { ErrorHandlingService } from './errorHandlingService';
import { argon2id } from 'hash-wasm';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import {
  QRSharePayload,
  ChunkedPayload,
  DecryptedShareEntry,
  ShareErrorType,
  VaultEntry,
  SensitiveData,
  Category
} from '../types';

// Error messages (TR/EN)
const ERROR_MESSAGES: Record<ShareErrorType, { tr: string; en: string }> = {
  SHARE_EXPIRED: {
    tr: "Bu paylaşım süresi doldu (24 saat). Lütfen gönderen kişiden yeni bir QR kod isteyin.",
    en: "This share has expired (24 hours). Please ask the sender to generate a new QR code."
  },
  SHARE_TAMPERED: {
    tr: "Bu QR kod değiştirilmiş. Lütfen içe aktarmayın.",
    en: "This QR code has been tampered with. Do not import it."
  },
  PASSWORD_REQUIRED: {
    tr: "Bu paylaşım şifre korumalı. Lütfen paylaşım şifresini girin.",
    en: "This share is password-protected. Please enter the sharing password."
  },
  INVALID_SHARE_FORMAT: {
    tr: "Geçersiz QR kod formatı. Bu geçerli bir Aegis Vault paylaşımı değil.",
    en: "Invalid QR code format. This is not a valid Aegis Vault share."
  },
  NO_QR_FOUND: {
    tr: "Görselde QR kod bulunamadı. Lütfen tekrar deneyin.",
    en: "No QR code detected in the image. Please try again."
  },
  PASSWORD_TOO_WEAK: {
    tr: "Paylaşım şifresi en az 12 karakter olmalıdır.",
    en: "Sharing password must be at least 12 characters."
  },
  DECRYPTION_FAILED: {
    tr: "Şifre çözme başarısız oldu. Lütfen paylaşım şifresini kontrol edin.",
    en: "Decryption failed. Please check the sharing password."
  }
};

// Constants
const SHARE_VERSION = "1.0";
const SHARE_TYPE = "AEGIS_SHARE";
const EXPIRATION_HOURS = 24;
const MIN_PASSWORD_LENGTH = 12;
const QR_MAX_SIZE = 2000; // Max bytes per QR code (conservative)
const ARGON2_ITERATIONS = 20;
const ARGON2_MEMORY = 65536; // 64MB
const ARGON2_PARALLELISM = 4;
const ARGON2_HASH_LENGTH = 32;

export class ShareService {
  /**
   * Get error message for a specific error type
   */
  static getErrorMessage(errorType: ShareErrorType, lang: 'tr' | 'en' = 'en'): string {
    return ERROR_MESSAGES[errorType]?.[lang] || ERROR_MESSAGES[errorType]?.en || 'Unknown error';
  }

  /**
   * Validate sharing password
   */
  static validatePassword(password: string): { valid: boolean; error?: ShareErrorType } {
    if (password.length < MIN_PASSWORD_LENGTH) {
      return { valid: false, error: 'PASSWORD_TOO_WEAK' };
    }
    return { valid: true };
  }

  /**
   * Generate a masked title hint for preview
   */
  private static maskTitle(title: string): string {
    if (title.length <= 3) return title.slice(0, 1) + '***';
    if (title.length <= 6) return title.slice(0, 3) + '***';
    return title.slice(0, 4) + '***';
  }

  /**
   * Calculate SHA-256 checksum for data integrity
   */
  private static async calculateChecksum(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Verify checksum
   */
  private static async verifyChecksum(data: string, expectedChecksum: string): Promise<boolean> {
    const calculated = await this.calculateChecksum(data);
    return calculated === expectedChecksum;
  }

  /**
   * Derive ephemeral encryption key from sharing password
   */
  private static async deriveEphemeralKey(
    password: string,
    salt: Uint8Array,
    iterations: number = ARGON2_ITERATIONS
  ): Promise<CryptoKey> {
    try {
      const hash = await argon2id({
        password,
        salt: salt as any,
        iterations,
        memorySize: ARGON2_MEMORY,
        parallelism: ARGON2_PARALLELISM,
        hashLength: ARGON2_HASH_LENGTH,
        outputType: 'binary',
      });

      return await window.crypto.subtle.importKey(
        'raw',
        hash as any,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      throw new Error('Failed to derive ephemeral key');
    }
  }

  /**
   * Generate encrypted share payload for an entry
   * @param entry - The vault entry to share
   * @param decryptedData - The decrypted sensitive data
   * @param sharePassword - The sharing password (min 12 chars)
   * @param lang - Language for error messages
   */
  static async generateSharePayload(
    entry: VaultEntry,
    decryptedData: SensitiveData,
    sharePassword: string,
    lang: 'tr' | 'en' = 'en'
  ): Promise<{ payload: QRSharePayload; error?: string }> {
    // Validate password
    const passwordValidation = this.validatePassword(sharePassword);
    if (!passwordValidation.valid) {
      return { payload: null as any, error: this.getErrorMessage(passwordValidation.error!, lang) };
    }

    try {
      const now = Date.now();
      const expiresAt = now + (EXPIRATION_HOURS * 60 * 60 * 1000);

      // 1. Generate ephemeral AES-256 key for entry encryption
      const ephemeralKeyRaw = window.crypto.getRandomValues(new Uint8Array(32));
      const ephemeralKey = await window.crypto.subtle.importKey(
        'raw',
        ephemeralKeyRaw,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      // 2. Prepare entry data
      const entryData: DecryptedShareEntry = {
        title: entry.title || 'Unnamed Entry',
        username: entry.username || '',
        category: entry.category,
        sensitive: decryptedData,
        folderId: entry.folderId,
        isFavorite: entry.isFavorite
      };

      const entryJson = JSON.stringify(entryData);

      // 3. Encrypt entry data with ephemeral key
      const encryptedEntry = await CryptoService.encrypt(entryJson, ephemeralKey);

      // 4. Encrypt ephemeral key with sharing password (using Argon2id + AES-GCM)
      const keySalt = window.crypto.getRandomValues(new Uint8Array(16));
      const passwordDerivedKey = await this.deriveEphemeralKey(sharePassword, keySalt);

      // Encrypt the ephemeral key raw bytes
      const encryptedKeyResult = await CryptoService.encryptBinary(
        ephemeralKeyRaw,
        passwordDerivedKey
      );

      // 5. Build the share payload
      const payload: QRSharePayload = {
        version: SHARE_VERSION,
        type: SHARE_TYPE,
        createdAt: now,
        expiresAt: expiresAt,
        encryptedEntry: {
          payload: CryptoService.arrayBufferToBase64(encryptedEntry.ciphertext.buffer),
          iv: CryptoService.arrayBufferToBase64(encryptedEntry.iv.buffer),
          tag: CryptoService.arrayBufferToBase64(encryptedEntry.tag.buffer)
        },
        keyEncryption: {
          algorithm: 'argon2id-aes256-gcm',
          salt: CryptoService.arrayBufferToBase64(keySalt.buffer),
          iterations: ARGON2_ITERATIONS,
          encryptedKey: {
            payload: CryptoService.arrayBufferToBase64(encryptedKeyResult.ciphertext.buffer),
            iv: CryptoService.arrayBufferToBase64(encryptedKeyResult.iv.buffer),
            tag: CryptoService.arrayBufferToBase64(encryptedKeyResult.tag.buffer)
          }
        },
        metadata: {
          titleHint: this.maskTitle(entry.title || 'Unnamed'),
          category: entry.category,
          hasPassword: true,
          isExpired: false
        },
        checksum: await this.calculateChecksum(entryJson)
      };

      return { payload };
    } catch (error: any) { // Type as any to satisfy ErrorHandlingService
      ErrorHandlingService.handle(error, 'ShareService.generateSharePayload');
      return { payload: null as any, error: lang === 'tr' ? 'Paylaşım oluşturulamadı' : 'Failed to generate share' };
    }
  }

  /**
   * Decrypt share payload and extract entry data
   * @param payload - The QR share payload
   * @param sharePassword - The sharing password
   * @param lang - Language for error messages
   */
  static async decryptSharePayload(
    payload: QRSharePayload,
    sharePassword: string,
    lang: 'tr' | 'en' = 'en'
  ): Promise<{ data: DecryptedShareEntry | null; error?: ShareErrorType }> {
    try {
      // 1. Validate format
      if (payload.version !== SHARE_VERSION || payload.type !== SHARE_TYPE) {
        return { data: null, error: 'INVALID_SHARE_FORMAT' };
      }

      // 2. Check expiration
      const now = Date.now();
      if (now > payload.expiresAt) {
        return { data: null, error: 'SHARE_EXPIRED' };
      }

      // 3. Decrypt ephemeral key using sharing password
      const keySalt = new Uint8Array(CryptoService.base64ToArrayBuffer(payload.keyEncryption.salt));
      const passwordDerivedKey = await this.deriveEphemeralKey(
        sharePassword,
        keySalt,
        payload.keyEncryption.iterations
      );

      const encryptedKeyPayload = new Uint8Array(
        CryptoService.base64ToArrayBuffer(payload.keyEncryption.encryptedKey.payload)
      );
      const keyIv = new Uint8Array(
        CryptoService.base64ToArrayBuffer(payload.keyEncryption.encryptedKey.iv)
      );
      const keyTag = new Uint8Array(
        CryptoService.base64ToArrayBuffer(payload.keyEncryption.encryptedKey.tag)
      );

      let ephemeralKeyRaw: Uint8Array;
      try {
        ephemeralKeyRaw = await CryptoService.decryptBinary(
          encryptedKeyPayload,
          passwordDerivedKey,
          keyIv,
          keyTag
        );
      } catch (error) {
        return { data: null, error: 'DECRYPTION_FAILED' };
      }

      // 4. Decrypt entry data using ephemeral key
      const ephemeralKey = await window.crypto.subtle.importKey(
        'raw',
        ephemeralKeyRaw as any,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      const encryptedEntry = new Uint8Array(
        CryptoService.base64ToArrayBuffer(payload.encryptedEntry.payload)
      );
      const entryIv = new Uint8Array(CryptoService.base64ToArrayBuffer(payload.encryptedEntry.iv));
      const entryTag = new Uint8Array(CryptoService.base64ToArrayBuffer(payload.encryptedEntry.tag));

      let entryJson: string;
      try {
        entryJson = await CryptoService.decrypt(encryptedEntry, ephemeralKey, entryIv, entryTag);
      } catch (error) {
        return { data: null, error: 'DECRYPTION_FAILED' };
      }

      // 5. Verify checksum
      const checksumValid = await this.verifyChecksum(entryJson, payload.checksum);
      if (!checksumValid) {
        return { data: null, error: 'SHARE_TAMPERED' };
      }

      // 6. Parse entry data
      const entryData: DecryptedShareEntry = JSON.parse(entryJson);

      return { data: entryData };
    } catch (error: any) {
      ErrorHandlingService.handle(error, 'ShareService.decryptSharePayload');
      return { data: null, error: 'DECRYPTION_FAILED' };
    }
  }

  /**
   * Generate QR codes for a share payload
   * Handles chunking for large payloads
   * @param payload - The QR share payload
   * @returns Array of data URLs for QR code images
   */
  static async generateQRCodes(payload: QRSharePayload): Promise<string[]> {
    try {
      // Serialize payload
      const payloadJson = JSON.stringify(payload);
      const payloadBase64 = CryptoService.arrayBufferToBase64(
        new TextEncoder().encode(payloadJson)
      );

      // Check if chunking is needed
      const payloadSize = new TextEncoder().encode(payloadBase64).length;

      if (payloadSize <= QR_MAX_SIZE) {
        // Single QR code
        const qrDataUrl = await QRCode.toDataURL(payloadBase64, {
          errorCorrectionLevel: 'M',
          type: 'image/png',
          margin: 2,
          width: 400
        });
        return [qrDataUrl];
      }

      // Chunking needed for large payloads
      const chunkId = crypto.randomUUID();
      const totalChunks = Math.ceil(payloadSize / QR_MAX_SIZE);
      const qrDataUrls: string[] = [];

      for (let i = 0; i < totalChunks; i++) {
        const start = i * QR_MAX_SIZE;
        const end = Math.min(start + QR_MAX_SIZE, payloadSize);
        const chunk = payloadBase64.slice(start, end);

        const chunkedPayload: ChunkedPayload = {
          totalChunks,
          chunkIndex: i,
          chunkId,
          data: chunk,
          checksum: await this.calculateChecksum(chunk)
        };

        const chunkJson = JSON.stringify(chunkedPayload);
        const chunkBase64 = CryptoService.arrayBufferToBase64(
          new TextEncoder().encode(chunkJson)
        );

        const qrDataUrl = await QRCode.toDataURL(chunkBase64, {
          errorCorrectionLevel: 'M',
          type: 'image/png',
          margin: 2,
          width: 400
        });

        qrDataUrls.push(qrDataUrl);
      }

      return qrDataUrls;
    } catch (error: any) {
      ErrorHandlingService.handle(error, 'ShareService.generateQRCodes');
      throw new Error('Failed to generate QR codes');
    }
  }

  /**
   * Decode QR code from image data
   * @param imageData - Image data (Uint8ClampedArray from canvas)
   * @param width - Image width
   * @param height - Image height
   * @param chunks - Previously collected chunks (for multi-QR)
   */
  static async decodeQRCode(
    imageData: Uint8ClampedArray,
    width: number,
    height: number,
    chunks: Map<string, ChunkedPayload[]> = new Map()
  ): Promise<{ payload: QRSharePayload | null; isComplete: boolean; chunksNeeded?: number; error?: ShareErrorType }> {
    try {
      // Use jsQR to detect QR code
      const code = jsQR(imageData, width, height);

      if (!code) {
        return { payload: null, isComplete: false, error: 'NO_QR_FOUND' };
      }

      // Decode base64 data
      const dataBytes = CryptoService.base64ToArrayBuffer(code.data);
      const dataJson = new TextDecoder().decode(dataBytes);

      // Try to parse as chunked payload first
      try {
        const chunked = JSON.parse(dataJson) as ChunkedPayload;

        // Verify chunk checksum
        const chunkValid = await this.verifyChecksum(chunked.data, chunked.checksum);
        if (!chunkValid) {
          return { payload: null, isComplete: false, error: 'SHARE_TAMPERED' };
        }

        // Add chunk to collection
        if (!chunks.has(chunked.chunkId)) {
          chunks.set(chunked.chunkId, []);
        }
        chunks.get(chunked.chunkId)!.push(chunked);

        const collectedChunks = chunks.get(chunked.chunkId)!;

        // Check if all chunks collected
        if (collectedChunks.length === chunked.totalChunks) {
          // Sort chunks by index and combine
          collectedChunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

          let combinedData = '';
          for (const chunk of collectedChunks) {
            combinedData += chunk.data;
          }

          // Decode the combined base64 to get actual payload
          const payloadBytes = CryptoService.base64ToArrayBuffer(combinedData);
          const payloadJson = new TextDecoder().decode(payloadBytes);
          const payload = JSON.parse(payloadJson) as QRSharePayload;

          // Clear chunks for this ID
          chunks.delete(chunked.chunkId);

          return { payload, isComplete: true };
        }

        return {
          payload: null,
          isComplete: false,
          chunksNeeded: chunked.totalChunks - collectedChunks.length
        };
      } catch (e) {
        // Not a chunked payload, try direct payload
        const payload = JSON.parse(dataJson) as QRSharePayload;
        return { payload, isComplete: true };
      }
    } catch (error) {
      console.error('[ShareService] Decode QR code error:', error);
      return { payload: null, isComplete: false, error: 'INVALID_SHARE_FORMAT' };
    }
  }

  /**
   * Download QR codes as images
   */
  static downloadQRCodes(qrDataUrls: string[], title: string): void {
    qrDataUrls.forEach((dataUrl, index) => {
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `aegis-share-${title.replace(/[^a-z0-9]/gi, '-')}-${index + 1}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  /**
   * Check if a share payload is expired
   */
  static isPayloadExpired(payload: QRSharePayload): boolean {
    return Date.now() > payload.expiresAt;
  }

  /**
   * Get remaining time for a share payload
   */
  static getRemainingTime(payload: QRSharePayload): { hours: number; minutes: number } {
    const remaining = Math.max(0, payload.expiresAt - Date.now());
    const hours = Math.floor(remaining / (60 * 60 * 1000));
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));
    return { hours, minutes };
  }
}
