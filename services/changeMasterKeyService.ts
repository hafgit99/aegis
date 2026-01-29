import { CryptoService } from './cryptoService';
import { RecoveryService } from './recoveryService';
import { db } from '../db';
import { VaultEntry, SensitiveData } from '../types';
import { VaultService } from './vaultService';

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
      const decrypted = await VaultService.decryptWithMasterKey(currentKey, verifier);

      return decrypted === VALIDATOR_TEXT;
    } catch (e) {
      return false;
    }
  }

  /**
   * Change the master key with full vault encryption (Upgrades to V4)
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

      const metadataStr = localStorage.getItem(MASTER_METADATA_KEY);
      if (!metadataStr) throw new Error("Vault not setup");
      const metadata = JSON.parse(metadataStr);

      const salt = new Uint8Array(CryptoService.base64ToArrayBuffer(metadata.salt));
      const iterations = metadata.iterations || CryptoService.DEFAULT_ITERATIONS;
      const { key: currentKey } = await CryptoService.deriveKeyWithRaw(currentPassword, salt, iterations, CryptoService.PURPOSES.VAULT_LOCK_UNLOCK);

      const verifierStr = localStorage.getItem(MASTER_VERIFIER_KEY);
      if (!verifierStr) throw new Error("Verifier not found");
      const verifier = JSON.parse(verifierStr);
      const decrypted = await VaultService.decryptWithMasterKey(currentKey, verifier);
      if (decrypted !== VALIDATOR_TEXT) {
        throw new Error("INVALID_CURRENT_PASSWORD");
      }

      // Stage 2: Load and Decrypt all entries
      onProgress?.({
        stage: 'decrypting',
        progress: 10,
        totalEntries: 0,
        processedEntries: 0,
      });

      const isSQLite = await VaultService.isMigratedToSQLite();
      const allEntries = isSQLite ? await VaultService.loadAllFromSQLite() : await db.vault.toArray();
      const decryptedData: Array<{ plain: any; sensitive: SensitiveData }> = [];

      for (let i = 0; i < allEntries.length; i++) {
        const entry = allEntries[i];
        try {
          const sensitive = await VaultService.decryptEntry(entry, currentKey);
          const meta = await VaultService.decryptEntryMetadata(entry, currentKey);

          decryptedData.push({
            plain: {
              ...entry,
              title: meta.title,
              username: meta.username,
              category: meta.category,
              folderId: meta.folderId,
              isFavorite: meta.isFavorite,
              deletedAt: meta.deletedAt,
            },
            sensitive
          });

          onProgress?.({
            stage: 'decrypting',
            progress: 10 + (i / allEntries.length) * 30,
            totalEntries: allEntries.length,
            processedEntries: i + 1,
          });
        } catch (e) {
          console.error('[Rotation] Failed to decrypt entry:', entry.id, e);
          throw new Error(`DECRYPTION_FAILED_${entry.id}`);
        }
      }

      // Stage 3: Generate New Key Material
      onProgress?.({
        stage: 'encrypting',
        progress: 40,
        totalEntries: allEntries.length,
        processedEntries: 0,
      });

      const newSalt = window.crypto.getRandomValues(new Uint8Array(16));
      const newIterations = await CryptoService.benchmarkIterations();
      const { key: newKey, raw: newKeyRaw } = await CryptoService.deriveKeyWithRaw(newPassword, newSalt, newIterations, CryptoService.PURPOSES.VAULT_LOCK_UNLOCK);

      // Stage 4: Re-encrypt and Save
      // If SQLite is active, we empty the renderer state and let saveEntry handle electron path
      if (!isSQLite) {
        await db.vault.clear(); // Clear old key entries
      }

      // Prepare Electron for rotation if active
      if ((window as any).electronAPI?.db) {
        await (window as any).electronAPI.vault.prepareRotation(newKeyRaw);
      }

      for (let i = 0; i < decryptedData.length; i++) {
        const { plain, sensitive } = decryptedData[i];
        await VaultService.saveEntry({ ...plain, sensitive }, newKey);

        onProgress?.({
          stage: 'encrypting',
          progress: 40 + (i / decryptedData.length) * 45,
          totalEntries: allEntries.length,
          processedEntries: i + 1,
        });
      }

      // Stage 5: Update Verifier & Metadata
      onProgress?.({
        stage: 'saving',
        progress: 90,
        totalEntries: allEntries.length,
        processedEntries: allEntries.length,
      });

      const encoder = new TextEncoder();
      const dataBytes = encoder.encode(VALIDATOR_TEXT);
      const newIv = window.crypto.getRandomValues(new Uint8Array(12));
      const newEncrypted = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv: newIv }, newKey, dataBytes);
      const fullBuffer = new Uint8Array(newEncrypted);

      const newVerifierBlob = {
        payload: CryptoService.arrayBufferToBase64(fullBuffer.slice(0, fullBuffer.length - 16).buffer),
        iv: CryptoService.arrayBufferToBase64(newIv.buffer),
        tag: CryptoService.arrayBufferToBase64(fullBuffer.slice(fullBuffer.length - 16).buffer),
        salt: CryptoService.arrayBufferToBase64(newSalt.buffer),
        iterations: newIterations
      };

      const newMetadata = {
        salt: CryptoService.arrayBufferToBase64(newSalt.buffer),
        iterations: newIterations,
        version: 4, // Upgraded to V4 Full Package
        createdAt: metadata.createdAt,
        rotatedAt: Date.now()
      };

      // Electron Rotation Connection
      if ((window as any).electronAPI?.db) {
        await (window as any).electronAPI.vault.rotateKey(newKeyRaw, newVerifierBlob);
      }

      localStorage.setItem(MASTER_METADATA_KEY, JSON.stringify(newMetadata));
      localStorage.setItem(MASTER_VERIFIER_KEY, JSON.stringify(newVerifierBlob));

      // Reset Recovery (Mandatory after key change)
      RecoveryService.resetRecovery();

      onProgress?.({
        stage: 'complete',
        progress: 100,
        totalEntries: allEntries.length,
        processedEntries: allEntries.length,
      });
    } catch (e) {
      console.error('Master key rotation failed:', e);
      throw e;
    }
  }

  /**
   * Rotates the master key using the same password but new salt/iterations.
   * Useful for periodic maintenance without forcing a password change.
   */
  static async rotateMasterKeyWithSamePassword(
    password: string,
    onProgress?: (progress: ChangePasswordProgress) => void
  ): Promise<void> {
    return this.changeMasterKey(password, password, onProgress);
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
      issues.push("Minimum 8 characters required");
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
