
import { CryptoService } from './cryptoService';

/**
 * Aegis Vault - Biometric Authentication Service
 * Uses WebAuthn Platform Authenticators (Windows Hello, Touch ID, Face ID)
 */
export class BiometricService {
  private static STORAGE_KEY = 'aegis_biometric_config';
  private static readonly OPERATION_CONTEXTS = {
    ENROLL: 'aegis_biometric_enroll',
    UNLOCK: 'aegis_biometric_unlock',
    VERIFY: 'aegis_biometric_verify'
  };

  private static validateAttestation(authenticatorAttestationResponse: any): boolean {
    try {
      const attestationObject = authenticatorAttestationResponse.attestationObject;
      const clientDataJSON = authenticatorAttestationResponse.clientDataJSON;

      if (!attestationObject || !clientDataJSON) {
        console.warn('[DeviceBinding] Missing attestation data');
        return false;
      }

      const decodedClientData = new TextDecoder().decode(clientDataJSON);
      const clientData = JSON.parse(decodedClientData);

      if (clientData.type !== 'webauthn.create') {
        console.warn('[DeviceBinding] Invalid client data type');
        return false;
      }

      const attestationObj = this.parseCBOR(attestationObject);
      if (!attestationObj) {
        console.warn('[DeviceBinding] Failed to parse CBOR attestation object');
        return false;
      }

      const fmt = attestationObj.get(34); // fmt
      if (!fmt) {
        console.warn('[DeviceBinding] Missing attestation format');
        return false;
      }

      const attestationData = attestationObj.get(37); // authData
      if (!attestationData || attestationData.length < 37) {
        console.warn('[DeviceBinding] Invalid attestation data length');
        return false;
      }

      const flags = attestationData[32];
      const hasAttestedCredentialData = (flags & 0x40) !== 0;
      
      if (!hasAttestedCredentialData) {
        console.warn('[DeviceBinding] No attested credential data in response');
        return false;
      }

      const attestationFlags = flags & 0xE0;
      const hasUserPresent = (flags & 0x01) !== 0;
      const hasUserVerified = (flags & 0x04) !== 0;
      const hasBackupEligible = (flags & 0x08) !== 0;
      const hasBackup = (flags & 0x10) !== 0;

      if (!hasUserVerified) {
        console.warn('[DeviceBinding] User verification not performed');
        return false;
      }

      return true;
    } catch (error) {
      console.error('[DeviceBinding] Attestation validation error:', error);
      return false;
    }
  }

  private static parseCBOR(data: ArrayBuffer): Map<number, any> | null {
    try {
      if (data.byteLength < 2) return null;

      const view = new DataView(data);
      let offset = 0;

      const firstByte = view.getUint8(offset++);
      const majorType = (firstByte & 0xE0) >> 5;
      const additionalInfo = firstByte & 0x1F;

      if (majorType !== 5 || additionalInfo !== 5) {
        return null;
      }

      const length = this.parseCBORLength(view, offset, additionalInfo);
      offset += length.bytesRead;

      const map = new Map<number, any>();

      for (let i = 0; i < length.value; i++) {
        const keyResult = this.parseCBORItem(view, offset);
        if (!keyResult) return null;
        offset += keyResult.bytesRead;

        const valueResult = this.parseCBORItem(view, offset);
        if (!valueResult) return null;
        offset += valueResult.bytesRead;

        if (typeof keyResult.value === 'number') {
          map.set(keyResult.value, valueResult.value);
        }
      }

      return map;
    } catch (error) {
      console.error('[DeviceBinding] CBOR parse error:', error);
      return null;
    }
  }

  private static parseCBORLength(view: DataView, offset: number, additionalInfo: number): { value: number; bytesRead: number } {
    if (additionalInfo < 24) {
      return { value: additionalInfo, bytesRead: 0 };
    } else if (additionalInfo === 24) {
      return { value: view.getUint8(offset), bytesRead: 1 };
    } else if (additionalInfo === 25) {
      return { value: view.getUint16(offset), bytesRead: 2 };
    } else if (additionalInfo === 26) {
      return { value: view.getUint32(offset), bytesRead: 4 };
    }
    return { value: 0, bytesRead: 0 };
  }

  private static parseCBORItem(view: DataView, offset: number): { value: any; bytesRead: number } | null {
    const firstByte = view.getUint8(offset++);
    const majorType = (firstByte & 0xE0) >> 5;
    const additionalInfo = firstByte & 0x1F;

    const lengthResult = this.parseCBORLength(view, offset, additionalInfo);
    offset += lengthResult.bytesRead;

    switch (majorType) {
      case 0:
        return { value: lengthResult.value, bytesRead: offset - 1 };
      case 2:
        const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, lengthResult.value);
        return { value: bytes, bytesRead: offset - 1 + lengthResult.value };
      case 5:
        const map = new Map();
        for (let i = 0; i < lengthResult.value; i++) {
          const keyResult = this.parseCBORItem(view, offset);
          if (!keyResult) return null;
          offset += keyResult.bytesRead;

          const valueResult = this.parseCBORItem(view, offset);
          if (!valueResult) return null;
          offset += valueResult.bytesRead;

          map.set(keyResult.value, valueResult.value);
        }
        return { value: map, bytesRead: offset - 1 };
      default:
        return { value: null, bytesRead: offset - 1 };
    }
  }

  private static createOperationSpecificChallenge(operation: keyof typeof BiometricService.OPERATION_CONTEXTS): Uint8Array {
    const context = this.OPERATION_CONTEXTS[operation];
    const contextBytes = new TextEncoder().encode(context);
    const randomBytes = window.crypto.getRandomValues(new Uint8Array(16));
    const combined = new Uint8Array(contextBytes.length + randomBytes.length + 8);
    
    combined.set(contextBytes, 0);
    combined.set(randomBytes, contextBytes.length);
    
    const timestampArray = new BigUint64Array(1);
    timestampArray[0] = BigInt(Date.now());
    const timestamp = new Uint8Array(timestampArray.buffer);
    combined.set(timestamp, contextBytes.length + randomBytes.length);
    
    return combined;
  }

  private static verifyOperationChallenge(challenge: Uint8Array, operation: keyof typeof BiometricService.OPERATION_CONTEXTS): boolean {
    if (challenge.length < 24) return false;
    
    const contextLength = this.OPERATION_CONTEXTS[operation].length;
    const contextBytes = challenge.slice(0, contextLength);
    const expectedContext = new TextEncoder().encode(this.OPERATION_CONTEXTS[operation]);
    
    for (let i = 0; i < expectedContext.length; i++) {
      if (contextBytes[i] !== expectedContext[i]) return false;
    }
    
    const timestampBytes = challenge.slice(challenge.length - 8);
    const timestamp = new BigUint64Array(timestampBytes.buffer)[0];
    const ageMs = Number(BigInt(Date.now()) - timestamp);
    
    return ageMs < 300000;
  }

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

    const hostname = window.location.hostname || "localhost";

    const challengeBytes = this.createOperationSpecificChallenge('ENROLL');
    const challenge = challengeBytes.buffer.slice(0, challengeBytes.byteLength) as ArrayBuffer;
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
      attestation: "direct",
      timeout: 60000
    };

    try {
      const credential = await navigator.credentials.create({ publicKey: options }) as PublicKeyCredential;
      if (!credential) throw new Error("BIOMETRIC_CANCELED");

      const response = credential.response as AuthenticatorAttestationResponse;
      if (!response) throw new Error("BIOMETRIC_CANCELED");

      const attestationValid = this.validateAttestation(response);
      if (!attestationValid) {
        console.warn('[DeviceBinding] Attestation validation failed - device may not have secure element');
      }

      const wrapperSecret = window.crypto.getRandomValues(new Uint8Array(32));
      const wrapperKey = await window.crypto.subtle.importKey('raw', wrapperSecret, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);

      const verificationToken = window.crypto.getRandomValues(new Uint8Array(16));
      const { ciphertext: tokenCiphertext, iv: tokenIv, tag: tokenTag } = await CryptoService.encrypt(
        verificationToken.toString(),
        wrapperKey
      );

      const secretB64 = CryptoService.arrayBufferToBase64(wrapperSecret);
      if ((window as any).electronAPI?.credentials) {
        await (window as any).electronAPI.credentials.saveBiometricSecret(secretB64);
      } else {
        console.warn("Secure enclave not available, biometric disabled for protection");
        throw new Error("SECURE_ENCLAVE_REQUIRED");
      }

      const config = {
        credentialId: CryptoService.arrayBufferToBase64(credential.rawId),
        biometricToken: CryptoService.arrayBufferToBase64(tokenCiphertext),
        tokenIv: CryptoService.arrayBufferToBase64(tokenIv),
        tokenTag: CryptoService.arrayBufferToBase64(tokenTag),
        attestationValidated: attestationValid,
        deviceSecureElement: attestationValid ? 'verified' : 'unknown',
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

  static async unlock(): Promise<{ key: CryptoKey, raw: Uint8Array } | null> {
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

    const challengeBytes = this.createOperationSpecificChallenge('UNLOCK');
    const challenge = challengeBytes.buffer.slice(0, challengeBytes.byteLength) as ArrayBuffer;
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

      const key = await window.crypto.subtle.importKey(
        'raw',
        rawKey,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
      );

      return { key, raw: new Uint8Array(rawKey) };
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
