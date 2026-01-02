import { CryptoService } from './cryptoService';
import { RecoveryService } from './recoveryService';
import { db } from '../db';
import { VaultEntry, SensitiveData } from '../types';

const MASTER_METADATA_KEY = 'aegis_vault_metadata';
const MASTER_VERIFIER_KEY = 'aegis_vault_verifier';
const VALIDATOR_TEXT = "AEGIS_VAULT_ACTIVE_SESSION_VALIDATOR";

export interface ChangePasswordProgress {
  stage: 'validating' | 'decrypting' | 'encrypting' | 'saving' | 'complete';
  progress: number; // 0-100
  totalEntries: number;
  processedEntries: number;
}

export class ChangeMasterKeyService {
  /**
   * Validate the current password by attempting to decrypt the verifier
   */
  static async validateCurrentPassword(currentPassword: string): Promise<boolean> {
    try {
      const metadata = localStorage.getItem(MASTER_METADATA_KEY);
      if (!metadata) throw new Error("Vault not setup");

      const { salt: saltB64, iterations = CryptoService.DEFAULT_ITERATIONS } = JSON.parse(metadata);
      const salt = new Uint8Array(CryptoService.base64ToArrayBuffer(saltB64));

      // Derive key from current password
      const currentKey = await CryptoService.deriveKeyFromPassword(currentPassword, salt, iterations);

      // Try to decrypt verifier
      const verifierStr = localStorage.getItem(MASTER_VERIFIER_KEY);
      if (!verifierStr) throw new Error("Verifier not found");

      const verifier = JSON.parse(verifierStr);
      const encryptedBuffer = new Uint8Array(CryptoService.base64ToArrayBuffer(verifier.payload));
      const tagBuffer = new Uint8Array(CryptoService.base64ToArrayBuffer(verifier.tag));
      const ivBuffer = new Uint8Array(CryptoService.base64ToArrayBuffer(verifier.iv));

      const combined = new Uint8Array(encryptedBuffer.byteLength + tagBuffer.byteLength);
      combined.set(encryptedBuffer, 0);
      combined.set(tagBuffer, encryptedBuffer.byteLength);

      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivBuffer as any },
        currentKey,
        combined.buffer as any
      );

      const decoder = new TextDecoder();
      const decrypted = decoder.decode(decryptedBuffer);

      return decrypted === VALIDATOR_TEXT;
    } catch (e) {
      return false;
    }
  }

  /**
   * Change the master key with full vault encryption
   */
  static async changeMasterKey(
    currentPassword: string,
    newPassword: string,
    onProgress?: (progress: ChangePasswordProgress) => void
  ): Promise<void> {
    try {
      // Stage 1: Validate current password
      onProgress?.({
        stage: 'validating',
        progress: 0,
        totalEntries: 0,
        processedEntries: 0,
      });

      const isValid = await this.validateCurrentPassword(currentPassword);
      if (!isValid) {
        throw new Error("INVALID_CURRENT_PASSWORD");
      }

      // Get current salt and derive current key
      const metadata = localStorage.getItem(MASTER_METADATA_KEY);
      if (!metadata) throw new Error("Vault not setup");

      const { salt: currentSaltB64, iterations: currentIterations = CryptoService.DEFAULT_ITERATIONS } = JSON.parse(metadata);
      const currentSalt = new Uint8Array(CryptoService.base64ToArrayBuffer(currentSaltB64));
      const currentKey = await CryptoService.deriveKeyFromPassword(currentPassword, currentSalt, currentIterations);

      // Stage 2: Decrypt all entries with current key
      onProgress?.({
        stage: 'decrypting',
        progress: 10,
        totalEntries: 0,
        processedEntries: 0,
      });

      const allEntries = await db.vault.toArray();
      const decryptedEntries: Array<{ original: VaultEntry; sensitive: SensitiveData }> = [];

      for (let i = 0; i < allEntries.length; i++) {
        const entry = allEntries[i];
        try {
          // Decrypt title
          const titleCombined = new Uint8Array(entry.encryptedTitle.byteLength + entry.titleTag.byteLength);
          titleCombined.set(entry.encryptedTitle, 0);
          titleCombined.set(entry.titleTag, entry.encryptedTitle.byteLength);

          const titleBuffer = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: entry.titleIv as any },
            currentKey,
            titleCombined.buffer as any
          );
          const titleDecoder = new TextDecoder();
          const title = titleDecoder.decode(titleBuffer);

          // Decrypt username
          const usernameCombined = new Uint8Array(entry.encryptedUsername.byteLength + entry.usernameTag.byteLength);
          usernameCombined.set(entry.encryptedUsername, 0);
          usernameCombined.set(entry.usernameTag, entry.encryptedUsername.byteLength);

          const usernameBuffer = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: entry.usernameIv as any },
            currentKey,
            usernameCombined.buffer as any
          );
          const usernameDecoder = new TextDecoder();
          const username = usernameDecoder.decode(usernameBuffer);

          // Decrypt sensitive data
          const decryptedStr = await CryptoService.decrypt(
            entry.encryptedData,
            currentKey,
            entry.iv,
            entry.tag
          );
          const sensitive: SensitiveData = JSON.parse(decryptedStr);

          decryptedEntries.push({
            original: entry,
            sensitive
          });

          onProgress?.({
            stage: 'decrypting',
            progress: 10 + (i / allEntries.length) * 30,
            totalEntries: allEntries.length,
            processedEntries: i + 1,
          });
        } catch (e) {
          console.error('Failed to decrypt entry:', entry.id, e);
          throw new Error(`DECRYPTION_FAILED_${entry.id}`);
        }
      }

      // Stage 3: Create new key material
      onProgress?.({
        stage: 'encrypting',
        progress: 40,
        totalEntries: allEntries.length,
        processedEntries: 0,
      });

      const newSalt = window.crypto.getRandomValues(new Uint8Array(16));
      // Benchmark for new optimized iterations
      const newIterations = await CryptoService.benchmarkIterations();
      const newKey = await CryptoService.deriveKeyFromPassword(newPassword, newSalt, newIterations);

      // Stage 4: Re-encrypt all entries with new key
      const newEntries: VaultEntry[] = [];

      for (let i = 0; i < decryptedEntries.length; i++) {
        const { original, sensitive } = decryptedEntries[i];

        // Re-encrypt title
        const titleEncoder = new TextEncoder();
        const titleBytes = titleEncoder.encode(original.title || '');
        const titleIv = window.crypto.getRandomValues(new Uint8Array(12));
        const titleEncrypted = await window.crypto.subtle.encrypt(
          { name: 'AES-GCM', iv: titleIv as any },
          newKey,
          titleBytes as any
        );
        const titleBuffer = new Uint8Array(titleEncrypted);
        const titleCiphertext = titleBuffer.slice(0, titleBuffer.length - 16);
        const titleTag = titleBuffer.slice(titleBuffer.length - 16);

        // Re-encrypt username
        const usernameEncoder = new TextEncoder();
        const usernameBytes = usernameEncoder.encode(original.username || '');
        const usernameIv = window.crypto.getRandomValues(new Uint8Array(12));
        const usernameEncrypted = await window.crypto.subtle.encrypt(
          { name: 'AES-GCM', iv: usernameIv as any },
          newKey,
          usernameBytes as any
        );
        const usernameBuffer = new Uint8Array(usernameEncrypted);
        const usernameCiphertext = usernameBuffer.slice(0, usernameBuffer.length - 16);
        const usernameTag = usernameBuffer.slice(usernameBuffer.length - 16);

        // Re-encrypt sensitive data
        const sensitiveStr = JSON.stringify(sensitive);
        const { ciphertext: dataCiphertext, iv: dataIv, tag: dataTag } = await CryptoService.encrypt(sensitiveStr, newKey);

        const newEntry: VaultEntry = {
          ...original,
          encryptedTitle: new Uint8Array(titleCiphertext),
          titleIv: titleIv,
          titleTag: titleTag,
          encryptedUsername: new Uint8Array(usernameCiphertext),
          usernameIv: usernameIv,
          usernameTag: usernameTag,
          encryptedData: dataCiphertext,
          iv: dataIv,
          tag: dataTag,
          updatedAt: Date.now(),
        };

        newEntries.push(newEntry);

        onProgress?.({
          stage: 'encrypting',
          progress: 40 + (i / decryptedEntries.length) * 45,
          totalEntries: allEntries.length,
          processedEntries: i + 1,
        });
      }

      // Stage 5: Save new metadata and verifier
      onProgress?.({
        stage: 'saving',
        progress: 85,
        totalEntries: allEntries.length,
        processedEntries: allEntries.length,
      });

      // Create new verifier with new key
      const encoder = new TextEncoder();
      const dataBytes = encoder.encode(VALIDATOR_TEXT);
      const verifierIv = window.crypto.getRandomValues(new Uint8Array(12));

      const verifierEncrypted = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: verifierIv as any },
        newKey,
        dataBytes as any
      );

      const verifierBuffer = new Uint8Array(verifierEncrypted);
      const verifierCiphertext = verifierBuffer.slice(0, verifierBuffer.length - 16);
      const verifierTag = verifierBuffer.slice(verifierBuffer.length - 16);

      const newVerifierBlob = {
        payload: CryptoService.arrayBufferToBase64(verifierCiphertext.buffer),
        iv: CryptoService.arrayBufferToBase64(verifierIv.buffer),
        tag: CryptoService.arrayBufferToBase64(verifierTag.buffer)
      };

      // Update localStorage
      localStorage.setItem(MASTER_METADATA_KEY, JSON.stringify({
        salt: CryptoService.arrayBufferToBase64(newSalt.buffer),
        iterations: newIterations,
        version: 5,
        createdAt: Date.now()
      }));

      localStorage.setItem(MASTER_VERIFIER_KEY, JSON.stringify(newVerifierBlob));

      // Update Electron if available
      if ((window as any).electronAPI?.vault) {
        await (window as any).electronAPI.vault.setVerifier(newVerifierBlob);
      }

      // Update database
      await db.vault.bulkPut(newEntries);

      // AUDIT: Log password change
      if ((window as any).electronAPI?.audit) {
        await (window as any).electronAPI.audit.logEvent('MASTER_KEY_CHANGED', {
          timestamp: Date.now(),
          entriesUpdated: newEntries.length
        });
      }

      // WARNING: Recovery blob is now invalid because it stores the OLD master key.
      // We must reset recovery so the user is forced/prompted to set it up again.
      // We cannot update it automatically without the user's recovery words.
      RecoveryService.resetRecovery();

      onProgress?.({
        stage: 'complete',
        progress: 100,
        totalEntries: allEntries.length,
        processedEntries: allEntries.length,
      });

      // Memory cleanup
      dataBytes.fill(0);
    } catch (e) {
      console.error('Master key change failed:', e);
      throw e;
    }
  }

  /**
   * Validate new password strength
   */
  static validatePasswordStrength(password: string): {
    isValid: boolean;
    score: number;
    issues: string[];
  } {
    const issues: string[] = [];

    if (password.length < 8) {
      issues.push("Minimum 8 character required");
    }

    if (!/[a-z]/.test(password)) {
      issues.push("Must contain lowercase letters");
    }

    if (!/[A-Z]/.test(password)) {
      issues.push("Must contain uppercase letters");
    }

    if (!/[0-9]/.test(password)) {
      issues.push("Must contain numbers");
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      issues.push("Must contain special characters");
    }

    const score = Math.max(0, 100 - issues.length * 20);

    return {
      isValid: issues.length === 0,
      score,
      issues
    };
  }
}
