
import { CryptoService } from './cryptoService';

/**
 * Aegis Vault - Biometric Authentication Service
 * Uses WebAuthn Platform Authenticators (Windows Hello, Touch ID, Face ID)
 */
export class BiometricService {
  private static STORAGE_KEY = 'aegis_biometric_config';

  static async isSupported(): Promise<boolean> {
    if (!window.PublicKeyCredential) return false;
    try {
      // Biyometrik donanım var mı ve platform doğrulaması destekleniyor mu?
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch (e) {
      console.warn("Biometric support check failed:", e);
      return false;
    }
  }

  static async enableBiometrics(masterKey: CryptoKey): Promise<void> {
    const isSupported = await this.isSupported();
    if (!isSupported) throw new Error("BIOMETRIC_NOT_SUPPORTED");

    // Relying Party ID için geçerli bir domain kullanılmalı
    const hostname = window.location.hostname || "localhost";

    // 1. Create a platform credential to verify user intent
    const challenge = window.crypto.getRandomValues(new Uint8Array(32));
    const userId = window.crypto.getRandomValues(new Uint8Array(16));

    const options: PublicKeyCredentialCreationOptions = {
      challenge,
      rp: { name: "Aegis Vault", id: hostname },
      user: {
        id: userId,
        name: "Aegis User",
        displayName: "Aegis User"
      },
      pubKeyCredParams: [{ alg: -7, type: "public-key" }], // ES256
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred"
      },
      timeout: 60000
    };

    try {
      const credential = await navigator.credentials.create({ publicKey: options }) as PublicKeyCredential;
      if (!credential) throw new Error("BIOMETRIC_CANCELED");

      // 2. Encrypt the MasterKey raw bytes with a biometric-specific wrapper
      const rawMasterKey = await window.crypto.subtle.exportKey('raw', masterKey);
      const wrapperKey = window.crypto.getRandomValues(new Uint8Array(32));
      const { ciphertext, iv, tag } = await CryptoService.encrypt(
        CryptoService.arrayBufferToBase64(rawMasterKey),
        await window.crypto.subtle.importKey('raw', wrapperKey, { name: 'AES-GCM' }, false, ['encrypt'])
      );

      // SECURITY: Move wrapperSecret to OS Secure Enclave (Keytar / Windows Credential Manager)
      const secretB64 = CryptoService.arrayBufferToBase64(wrapperKey.buffer);
      if ((window as any).electronAPI?.credentials) {
        await (window as any).electronAPI.credentials.saveBiometricSecret(secretB64);
      } else {
        // Fallback or warning if in browser environment (though biometric is mostly for desktop here)
        console.warn("Secure enclave not available, biometric disabled for protection");
        throw new Error("SECURE_ENCLAVE_REQUIRED");
      }

      const config = {
        credentialId: CryptoService.arrayBufferToBase64(credential.rawId),
        wrappedKey: CryptoService.arrayBufferToBase64(ciphertext.buffer),
        wrapperIv: CryptoService.arrayBufferToBase64(iv.buffer),
        wrapperTag: CryptoService.arrayBufferToBase64(tag.buffer),
        // wrapperSecret IS NO LONGER STORED IN LOCALSTORAGE (Fixed Security Vulnerability)
      };

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(config));
    } catch (e: any) {
      if (e.name === 'SecurityError' || (e.message && e.message.includes('Permissions Policy'))) {
        throw new Error("BIOMETRIC_POLICY_ERROR");
      }
      if (e.name === 'NotAllowedError') {
        throw new Error("BIOMETRIC_CANCELED");
      }
      throw e;
    }
  }

  static async unlock(): Promise<CryptoKey | null> {
    const configStr = localStorage.getItem(this.STORAGE_KEY);
    if (!configStr) return null;

    const config = JSON.parse(configStr);
    const isSupported = await this.isSupported();
    if (!isSupported) return null;

    // SECURITY: Retrieve secret from OS Secure Enclave
    let wrapperSecretB64: string | null = null;
    if ((window as any).electronAPI?.credentials) {
      wrapperSecretB64 = await (window as any).electronAPI.credentials.retrieveBiometricSecret();
    }

    if (!wrapperSecretB64) {
      console.warn("Biometric secret missing from secure enclave");
      return null;
    }

    // 1. Verify Biometric Identity
    const challenge = window.crypto.getRandomValues(new Uint8Array(32));
    const options: PublicKeyCredentialRequestOptions = {
      challenge,
      allowCredentials: [{
        id: CryptoService.base64ToArrayBuffer(config.credentialId),
        type: "public-key"
      }],
      userVerification: "required",
      timeout: 60000
    };

    try {
      const assertion = await navigator.credentials.get({ publicKey: options }) as PublicKeyCredential;
      if (!assertion) return null;

      // 2. Reconstruct MasterKey
      const wrapperKey = await window.crypto.subtle.importKey(
        'raw',
        CryptoService.base64ToArrayBuffer(wrapperSecretB64),
        { name: 'AES-GCM' },
        false,
        ['decrypt']
      );

      const wrappedData = new Uint8Array(CryptoService.base64ToArrayBuffer(config.wrappedKey));
      const iv = new Uint8Array(CryptoService.base64ToArrayBuffer(config.wrapperIv));
      const tag = new Uint8Array(CryptoService.base64ToArrayBuffer(config.wrapperTag || ""));

      const decryptedRawKeyB64 = await CryptoService.decrypt(wrappedData, wrapperKey, iv, tag);
      const rawKey = CryptoService.base64ToArrayBuffer(decryptedRawKeyB64);

      return await window.crypto.subtle.importKey(
        'raw',
        rawKey,
        { name: 'AES-GCM' },
        true,
        ['encrypt', 'decrypt']
      );
    } catch (e: any) {
      console.error("Biometric Unlock Error:", e.name, e.message);
      return null;
    }
  }

  static disable(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    if ((window as any).electronAPI?.credentials) {
      (window as any).electronAPI.credentials.clearBiometricSecret();
    }
  }

  static isEnabled(): boolean {
    return !!localStorage.getItem(this.STORAGE_KEY);
  }
}
