
import { CryptoService } from './cryptoService';

/**
 * Minimal TOTP Implementation using Web Crypto
 * Avoids heavy node-based dependencies.
 */
export class TwoFactorService {
  private static BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  private static lastServerTime: number | null = null;
  private static clockDriftWarning: string | null = null;

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
      { name: 'HMAC', hash: 'SHA-1' } as any,
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
}
