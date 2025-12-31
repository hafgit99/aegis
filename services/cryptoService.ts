
import { argon2id } from 'hash-wasm';

/**
 * Aegis Vault - Security Engine
 * Web Crypto API ve Argon2id entegrasyonu (hash-wasm).
 */

export class CryptoService {
  private static ALGORITHM = 'AES-GCM';

  static deriveKeyFromPassword(password: string, salt: Uint8Array): Promise<CryptoKey> {
    return new Promise(async (resolve, reject) => {
      try {
        const hash = await argon2id({
          password: password,
          salt: salt as any,
          iterations: 3,        // Reverted to 3 for compatibility
          memorySize: 65536,    // 64MB RAM
          parallelism: 4,       // 4 thread
          hashLength: 32,
          outputType: 'binary',
        });

        // SECURITY TRADE-OFF: Recovery blob'ı oluşturmak için exportable = true gerekli
        // Ama master key Electron Main Process RAM'de tutulduğundan direct export riski düşük
        // Alternatif: Recovery'yi parola-tabanlı yapabilirdik (recovery kelimeleri yerine)
        const key = await window.crypto.subtle.importKey(
          'raw',
          hash as any,
          { name: this.ALGORITHM },
          true, // Recovery blob oluşturması için gerekli, Electron protection ile mitigate edilir
          ['encrypt', 'decrypt']
        );

        new Uint8Array(hash).fill(0);
        resolve(key);
      } catch (err) {
        reject(new Error("Anahtar türetme başarısız: " + (err as Error).message));
      }
    });
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
      console.error("Decryption failed", e);
      throw new Error("DECRYPTION_FAILED");
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
      console.error("Binary Encryption failed", e);
      throw new Error("ENCRYPTION_FAILED");
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
      console.error("Binary Decryption failed", e);
      throw new Error("DECRYPTION_FAILED");
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
