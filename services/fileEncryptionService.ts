
import { CryptoService } from './cryptoService';
import { FileValidationService } from './fileValidationService';

export class FileEncryptionService {
  private static MAX_SIZE = 25 * 1024 * 1024; // 25MB (updated from 5MB)

  static async processFile(file: File, masterKey: CryptoKey): Promise<{ 
    encryptedData: string, 
    iv: string, 
    tag: string,
    fileName: string,
    fileMime: string,
    fileSize: number
  }> {
    // SECURITY: Validate file before processing
    const validation = await FileValidationService.validateFileUpload(file);
    
    if (!validation.valid) {
      const errorMsg = validation.errors
        .map(err => FileValidationService.getErrorMessage(err, 'en'))
        .join('; ');
      throw new Error(`FILE_VALIDATION_FAILED: ${errorMsg}`);
    }

    if (validation.warnings.length > 0) {
      console.warn('File upload warnings:', validation.warnings);
    }

    const buffer = await file.arrayBuffer();
    // Use the existing CryptoService infrastructure
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    // Convert buffer to string temporarily for GCM if needed, or update CryptoService to handle buffers
    // Actually AES-GCM SubtleCrypto takes buffers directly.
    const ciphertext = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      masterKey,
      buffer
    );

    const fullBuffer = new Uint8Array(ciphertext);
    const tagSize = 16;
    const encryptedBytes = fullBuffer.slice(0, fullBuffer.length - tagSize);
    const tagBytes = fullBuffer.slice(fullBuffer.length - tagSize);

    return {
      encryptedData: CryptoService.arrayBufferToBase64(encryptedBytes.buffer),
      iv: CryptoService.arrayBufferToBase64(iv.buffer),
      tag: CryptoService.arrayBufferToBase64(tagBytes.buffer),
      fileName: file.name,
      fileMime: file.type,
      fileSize: file.size
    };
  }

  static async decryptFile(
    encryptedB64: string, 
    tagB64: string, 
    ivB64: string, 
    masterKey: CryptoKey
  ): Promise<Blob> {
    const encryptedBuffer = CryptoService.base64ToArrayBuffer(encryptedB64);
    const tagBuffer = CryptoService.base64ToArrayBuffer(tagB64);
    const iv = new Uint8Array(CryptoService.base64ToArrayBuffer(ivB64));

    const combined = new Uint8Array(encryptedBuffer.byteLength + tagBuffer.byteLength);
    combined.set(new Uint8Array(encryptedBuffer), 0);
    combined.set(new Uint8Array(tagBuffer), encryptedBuffer.byteLength);

    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      masterKey,
      combined.buffer
    );

    return new Blob([decrypted]);
  }
}
