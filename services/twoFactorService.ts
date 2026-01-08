
import { CryptoService } from './cryptoService';

interface EncryptedRecoveryCodes {
  v: 1; // Version for future compatibility
  iv: string; // Base64 encoded initialization vector
  ciphertext: string; // Base64 encoded encrypted data
  tag: string; // Base64 encoded authentication tag
  createdAt: number; // Timestamp for audit
}

/**
 * Minimal TOTP Implementation using Web Crypto
 * Avoids heavy node-based dependencies.
 */
export class TwoFactorService {
  private static BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  private static lastServerTime: number | null = null;
  private static clockDriftWarning: string | null = null;
  private static readonly RECOVERY_CODES_ENCRYPTED_KEY = 'twofa_recovery_codes_encrypted';
  private static readonly RECOVERY_CODES_PLAINTEXT_KEY = 'twofa_recovery_codes'; // Legacy (deprecated)

  static generateSecret(): string {
    const randomValues = window.crypto.getRandomValues(new Uint8Array(20));
    return this.base32Encode(randomValues);
  }

  /**
   * Detect clock drift between client and server
   * Should be called with server's current timestamp when available
   * @param serverTimestamp - Server's current timestamp in milliseconds
   * @returns Object with drift info and warning message if significant
   */
  static detectClockDrift(serverTimestamp: number): {
    driftSeconds: number;
    isDrifted: boolean;
    warning: string | null;
  } {
    const clientTime = Date.now();
    const driftMs = Math.abs(clientTime - serverTimestamp);
    const driftSeconds = Math.round(driftMs / 1000);

    // TOTP window is 30 seconds, warn if drift > 60 seconds
    const isSevere = driftSeconds > 60;
    const warning = isSevere
      ? `System clock may be out of sync (${driftSeconds}s drift). Please synchronize your device time.`
      : driftSeconds > 30
        ? `Minor clock drift detected (${driftSeconds}s). TOTP may fail if drift increases.`
        : null;

    this.lastServerTime = serverTimestamp;
    this.clockDriftWarning = warning;

    return {
      driftSeconds,
      isDrifted: isSevere,
      warning
    };
  }

  /**
   * Get last detected clock drift warning
   */
  static getClockDriftWarning(): string | null {
    return this.clockDriftWarning;
  }

  /**
   * Clear the clock drift warning
   */
  static clearClockDriftWarning(): void {
    this.clockDriftWarning = null;
  }

  static async verifyToken(secret: string, token: string): Promise<boolean> {
    const key = this.base32Decode(secret);
    const counter = Math.floor(Date.now() / 30000);

    // Check current, previous, and next window for clock drift tolerance
    // -1 to +1 covers ±30 seconds tolerance
    for (let i = -1; i <= 1; i++) {
      const calculated = await this.generateTOTP(key, counter + i);
      if (calculated === token) return true;
    }
    return false;
  }

  private static async generateTOTP(key: Uint8Array, counter: number): Promise<string> {
    const counterBuffer = new ArrayBuffer(8);
    const counterView = new DataView(counterBuffer);
    counterView.setUint32(4, counter, false); // Set lower 32 bits

    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      key as any,
      { name: 'HMAC', hash: 'SHA-256' } as any,
      false,
      ['sign']
    );

    const signature = await window.crypto.subtle.sign('HMAC', cryptoKey, counterBuffer as any);
    const hmac = new Uint8Array(signature);
    const offset = hmac[hmac.length - 1] & 0xf;
    const binary = ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);

    const otp = binary % 1000000;
    return otp.toString().padStart(6, '0');
  }

  private static base32Encode(data: Uint8Array): string {
    let bits = 0;
    let value = 0;
    let output = '';
    for (let i = 0; i < data.length; i++) {
      value = (value << 8) | data[i];
      bits += 8;
      while (bits >= 5) {
        output += this.BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }
    if (bits > 0) {
      output += this.BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }
    return output;
  }

  private static base32Decode(base32: string): Uint8Array {
    base32 = base32.toUpperCase().replace(/=+$/, '');
    let bits = 0;
    let value = 0;
    const output = new Uint8Array(Math.floor((base32.length * 5) / 8));
    let index = 0;
    for (let i = 0; i < base32.length; i++) {
      const charValue = this.BASE32_ALPHABET.indexOf(base32[i]);
      if (charValue === -1) throw new Error('Invalid Base32 character');
      value = (value << 5) | charValue;
      bits += 5;
      if (bits >= 8) {
        output[index++] = (value >>> (bits - 8)) & 255;
        bits -= 8;
      }
    }
    return output;
  }

  static generateRecoveryCodes(): string[] {
    const codes: string[] = [];
    for (let i = 0; i < 10; i++) {
      const arr = window.crypto.getRandomValues(new Uint32Array(1));
      codes.push(arr[0].toString(16).toUpperCase().padStart(8, '0'));
    }
    return codes;
  }

  /**
   * Encrypt and store recovery codes with master key
   * @param codes Array of recovery codes to encrypt
   * @param masterKey Master encryption key (ArrayBuffer)
   */
  static async encryptAndStoreRecoveryCodes(codes: string[], masterKey: ArrayBuffer): Promise<void> {
    try {
      // Import master key as AES-GCM key
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        masterKey,
        { name: 'AES-GCM' },
        false,
        ['encrypt']
      );

      // Generate random IV
      const iv = window.crypto.getRandomValues(new Uint8Array(12));

      // Encrypt the codes JSON
      const codesJson = JSON.stringify(codes);
      const encoder = new TextEncoder();
      const data = encoder.encode(codesJson);

      const encrypted = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        data
      );

      // Extract tag from encrypted result (GCM appends 16-byte tag)
      const encryptedBytes = new Uint8Array(encrypted);
      const ciphertext = encryptedBytes.slice(0, encryptedBytes.length - 16);
      const tag = encryptedBytes.slice(encryptedBytes.length - 16);

      const encryptedData: EncryptedRecoveryCodes = {
        v: 1,
        iv: CryptoService.arrayBufferToBase64(iv),
        ciphertext: CryptoService.arrayBufferToBase64(ciphertext),
        tag: CryptoService.arrayBufferToBase64(tag),
        createdAt: Date.now(),
      };

      // Store encrypted codes
      localStorage.setItem(
        this.RECOVERY_CODES_ENCRYPTED_KEY,
        JSON.stringify(encryptedData)
      );

      // Remove legacy plaintext codes
      localStorage.removeItem(this.RECOVERY_CODES_PLAINTEXT_KEY);
    } catch (error) {
      console.error('Failed to encrypt recovery codes:', error);
      throw error;
    }
  }

  /**
   * Decrypt recovery codes from encrypted storage
   * @param masterKey Master decryption key (ArrayBuffer)
   * @returns Array of recovery codes or null if not found
   */
  static async decryptRecoveryCodes(masterKey: ArrayBuffer): Promise<string[] | null> {
    try {
      const stored = localStorage.getItem(this.RECOVERY_CODES_ENCRYPTED_KEY);
      if (!stored) {
        // Check for legacy plaintext format (shouldn't happen in production)
        const legacy = localStorage.getItem(this.RECOVERY_CODES_PLAINTEXT_KEY);
        if (legacy) {
          try {
            return JSON.parse(legacy);
          } catch {
            return null;
          }
        }
        return null;
      }

      const encrypted: EncryptedRecoveryCodes = JSON.parse(stored);

      // Import master key as AES-GCM key
      const cryptoKey = await window.crypto.subtle.importKey(
        'raw',
        masterKey,
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );

      // Reconstruct IV, ciphertext, and tag
      const iv = new Uint8Array(CryptoService.base64ToArrayBuffer(encrypted.iv));
      const ciphertext = new Uint8Array(CryptoService.base64ToArrayBuffer(encrypted.ciphertext));
      const tag = new Uint8Array(CryptoService.base64ToArrayBuffer(encrypted.tag));

      // Combine ciphertext + tag for Web Crypto API
      const fullEncrypted = new Uint8Array(ciphertext.length + tag.length);
      fullEncrypted.set(ciphertext);
      fullEncrypted.set(tag, ciphertext.length);

      // Decrypt
      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        cryptoKey,
        fullEncrypted
      );

      const decoder = new TextDecoder();
      const codesJson = decoder.decode(decrypted);
      return JSON.parse(codesJson);
    } catch (error) {
      console.error('Failed to decrypt recovery codes:', error);
      return null;
    }
  }

  /**
   * Consume a recovery code (remove it from storage after use)
   * @param code Code to consume
   * @param masterKey Master decryption key (ArrayBuffer)
   * @returns true if code was valid and consumed, false otherwise
   */
  static async consumeRecoveryCode(code: string, masterKey: ArrayBuffer): Promise<boolean> {
    try {
      const codes = await this.decryptRecoveryCodes(masterKey);
      if (!codes) return false;

      const index = codes.indexOf(code);
      if (index === -1) return false;

      // Remove consumed code
      codes.splice(index, 1);

      // Save updated codes
      if (codes.length > 0) {
        await this.encryptAndStoreRecoveryCodes(codes, masterKey);
      } else {
        // All codes consumed, clear storage
        localStorage.removeItem(this.RECOVERY_CODES_ENCRYPTED_KEY);
      }

      return true;
    } catch (error) {
      console.error('Failed to consume recovery code:', error);
      return false;
    }
  }

  /**
   * Get number of remaining recovery codes (for UI display)
   * @returns Number of codes remaining or 0
   */
  static getRemainingRecoveryCodesCount(): number {
    try {
      const stored = localStorage.getItem(this.RECOVERY_CODES_ENCRYPTED_KEY);
      if (stored) {
        const encrypted: EncryptedRecoveryCodes = JSON.parse(stored);
        // Can't decrypt without master key, so we return status from metadata or a placeholder
        return -1; // Encrypted storage exists but count unavailable without decryption
      }
      return 0; // No codes stored
    } catch {
      return 0;
    }
  }
}
