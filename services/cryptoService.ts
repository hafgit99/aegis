
import { argon2id } from 'hash-wasm';

/**
 * Aegis Vault - Security Engine
 * Web Crypto API ve Argon2id entegrasyonu (hash-wasm).
 */

export class CryptoService {
  private static ALGORITHM = 'AES-GCM';
  public static readonly DEFAULT_ITERATIONS = 3;

  /**
   * Benchmarks the hardware to find an iteration count that takes ~500-1000ms.
   * This ensures high security adaptable to the user's device power.
   */
  static async benchmarkIterations(targetTimeMs: number = 600): Promise<number> {
    try {
      const startTime = performance.now();
      await argon2id({
        password: 'benchmark_test_password',
        salt: new Uint8Array(16),
        iterations: 1,
        memorySize: 65536,
        parallelism: 4,
        hashLength: 32,
        outputType: 'binary',
      });
      const endTime = performance.now();
      const singleRunTime = endTime - startTime;

      // Calculate ratio (e.g. if single run is 50ms, we need 12 iterations for 600ms)
      // Safety limits: Min 3 (legacy), Max 60 (to prevent extreme lockouts)
      let calculated = Math.floor(targetTimeMs / singleRunTime);
      if (calculated < 3) calculated = 3;
      if (calculated > 60) calculated = 60;

      return calculated;
    } catch (e) {
      console.warn("Benchmark failed, falling back to safe default", e);
      return 15; // Safe modern default if benchmark fails
    }
  }


  static async deriveKeyWithRaw(password: string, salt: Uint8Array, iterations: number = this.DEFAULT_ITERATIONS): Promise<{ key: CryptoKey; raw: Uint8Array }> {
    try {
      const hash = await argon2id({
        password: password,
        salt: salt as any,
        iterations: iterations,
        memorySize: 65536,    // 64MB RAM
        parallelism: 4,       // 4 thread
        hashLength: 32,
        outputType: 'binary',
      });

      // SECURITY: Non-extractable key for maximum protection
      // Raw bytes are returned separately for recovery purposes only
      const key = await window.crypto.subtle.importKey(
        'raw',
        hash as any,
        { name: this.ALGORITHM },
        false, // SECURITY: NOT extractable - prevents memory dump attacks
        ['encrypt', 'decrypt']
      );

      return { key, raw: hash };
    } catch (err) {
      throw new Error("Anahtar türetme başarısız: " + (err as Error).message);
    }
  }

  static async deriveKeyFromPassword(password: string, salt: Uint8Array, iterations: number = this.DEFAULT_ITERATIONS): Promise<CryptoKey> {
    const { key, raw } = await this.deriveKeyWithRaw(password, salt, iterations);
    // Wipe raw memory immediately if not needed
    try { raw.fill(0); } catch (e) { }
    return key;
  }

  static async encrypt(data: string, key: CryptoKey): Promise<{ ciphertext: Uint8Array; iv: Uint8Array; tag: Uint8Array }> {
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);

    // Doğrudan Web Crypto API kullan (En hızlı ve güvenilir)
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    try {
      const encrypted = await window.crypto.subtle.encrypt(
        { name: this.ALGORITHM, iv: iv as any },
        key,
        dataBytes as any
      );

      const fullBuffer = new Uint8Array(encrypted);
      const ciphertext = fullBuffer.slice(0, fullBuffer.length - 16);
      const tag = fullBuffer.slice(fullBuffer.length - 16);

      return {
        ciphertext: new Uint8Array(ciphertext),
        iv: iv,
        tag: new Uint8Array(tag)
      };
    } catch (e) {
      console.error("Encryption failed", e);
      throw new Error("ENCRYPTION_FAILED");
    } finally {
      if (dataBytes) dataBytes.fill(0);
    }
  }

  static async decrypt(ciphertext: Uint8Array, key: CryptoKey, iv: Uint8Array, tag: Uint8Array): Promise<string> {
    try {
      // Combine ciphertext and tag for Web Crypto API
      const combined = new Uint8Array(ciphertext.byteLength + tag.byteLength);
      combined.set(ciphertext, 0);
      combined.set(tag, ciphertext.byteLength);

      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: this.ALGORITHM, iv: iv as any },
        key,
        combined.buffer as any
      );

      const decoder = new TextDecoder();
      return decoder.decode(decryptedBuffer);
    } catch (e) {
      // SECURITY: Generic error message to prevent information disclosure
      console.error("[CryptoService] Decryption failed:", e);
      throw new Error("OPERATION_FAILED");
    }
  }

  static async encryptBinary(data: Uint8Array, key: CryptoKey): Promise<{ ciphertext: Uint8Array; iv: Uint8Array; tag: Uint8Array }> {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    try {
      const encrypted = await window.crypto.subtle.encrypt({ name: this.ALGORITHM, iv: iv as any }, key, data as any);

      const fullBuffer = new Uint8Array(encrypted);
      const ciphertext = fullBuffer.slice(0, fullBuffer.length - 16);
      const tag = fullBuffer.slice(fullBuffer.length - 16);

      return { ciphertext, iv, tag };
    } catch (e) {
      console.error("[CryptoService] Binary Encryption failed:", e);
      throw new Error("OPERATION_FAILED");
    }
  }

  static async decryptBinary(ciphertext: Uint8Array, key: CryptoKey, iv: Uint8Array, tag: Uint8Array): Promise<Uint8Array> {
    try {
      const combined = new Uint8Array(ciphertext.byteLength + tag.byteLength);
      combined.set(ciphertext, 0);
      combined.set(tag, ciphertext.byteLength);

      const decrypted = await window.crypto.subtle.decrypt({ name: this.ALGORITHM, iv: iv as any }, key, combined.buffer as any);
      return new Uint8Array(decrypted);
    } catch (e) {
      console.error("[CryptoService] Binary Decryption failed:", e);
      throw new Error("OPERATION_FAILED");
    }
  }

  static arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array | ArrayBufferLike): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer as ArrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  static base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer as ArrayBuffer;
  }
}
