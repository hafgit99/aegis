
import { PasskeyDetails } from '../types';
import { CryptoService } from './cryptoService';

/**
 * PasskeyService - Handles the Core WebAuthn/Passkey Cryptography
 * Since Aegis acts as a Passkey Manager, it must manage the lifecycle of
 * WebAuthn credentials (Generating keys, signing challenges).
 */
export class PasskeyService {

    /**
     * Generates a new Passkey (Key pair and metadata)
     * SECURITY: Uses Key Wrapping to never expose raw private key in memory as PKCS#8
     * @param wrappingKey The master key used to wrap the private key
     */
    static async createCredential(rpId: string, displayName: string, wrappingKey: CryptoKey): Promise<PasskeyDetails> {
        const credentialId = window.crypto.getRandomValues(new Uint8Array(16));

        // 1. Generate ES256 Key Pair (Extractable for wrapping only)
        const keyPair = await window.crypto.subtle.generateKey(
            {
                name: 'ECDSA',
                namedCurve: 'P-256',
            },
            true, // extractable (REQUIRED for wrapKey)
            ['sign', 'verify']
        );

        // 2. Export Public Key
        const publicKeyBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);

        // 3. KEY WRAPPING: Wrap the private key using the Master Key
        // This ensures the raw private key is encrypted by the HKDF-derived key
        const wrapIv = window.crypto.getRandomValues(new Uint8Array(12));
        const wrappedKeyBuffer = await window.crypto.subtle.wrapKey(
            'pkcs8',
            keyPair.privateKey,
            wrappingKey,
            {
                name: 'AES-GCM',
                iv: wrapIv
            }
        );

        // Package the wrapped key with its IV for storage
        const privateKeyPackage = {
            v: 1, // Version for future migrations
            iv: CryptoService.arrayBufferToBase64(wrapIv),
            data: CryptoService.arrayBufferToBase64(wrappedKeyBuffer)
        };

        return {
            credentialId: CryptoService.arrayBufferToBase64(credentialId),
            publicKey: CryptoService.arrayBufferToBase64(publicKeyBuffer),
            privateKey: JSON.stringify(privateKeyPackage),
            signCount: 0,
            rpId,
            displayName,
            createdAt: Date.now(),
            transports: ['internal', 'usb', 'nfc']
        };
    }

    /**
     * Generates a signature for a WebAuthn Assertion
     * SECURITY: Uses Key Unwrapping to import the key as NON-EXTRACTABLE
     */
    static async signChallenge(passkey: PasskeyDetails, challenge: ArrayBuffer, unwrappingKey: CryptoKey): Promise<{
        signature: string;
        authenticatorData: string;
        clientDataJSON: string;
        newCounter: number;
    }> {
        if (!passkey.privateKey) throw new Error("Private key missing for passkey");

        // 1. UNWRAP KEY: Import into memory as NON-EXTRACTABLE
        let privateKey: CryptoKey;
        try {
            const pkg = JSON.parse(passkey.privateKey);
            const iv = CryptoService.base64ToArrayBuffer(pkg.iv);
            const data = CryptoService.base64ToArrayBuffer(pkg.data);

            privateKey = await window.crypto.subtle.unwrapKey(
                'pkcs8',
                data,
                unwrappingKey,
                { name: 'AES-GCM', iv },
                { name: 'ECDSA', namedCurve: 'P-256' },
                false, // SECURITY: NON-EXTRACTABLE (Matches "Non-extractable anahtarlar kullan" advice)
                ['sign']
            );
        } catch (e) {
            // Fallback for legacy (v0) keys or non-wrapped keys (e.g. newly imported from other managers)
            console.warn("[PasskeyService] Falling back to direct import for legacy/invalid package");
            privateKey = await window.crypto.subtle.importKey(
                'pkcs8',
                CryptoService.base64ToArrayBuffer(passkey.privateKey),
                {
                    name: 'ECDSA',
                    namedCurve: 'P-256',
                },
                false, // Still ensure it's non-extractable after import
                ['sign']
            );
        }

        // 2. Authenticator Data (WebAuthn spec)
        const rpIdHash = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(passkey.rpId));
        const authData = new Uint8Array(37);
        authData.set(new Uint8Array(rpIdHash), 0);
        authData[32] = 0x01; // User Presence (UP) flag

        const counter = (passkey.signCount || 0) + 1;
        authData[33] = (counter >> 24) & 0xff;
        authData[34] = (counter >> 16) & 0xff;
        authData[35] = (counter >> 8) & 0xff;
        authData[36] = counter & 0xff;

        // 3. Client Data JSON
        const clientData = {
            type: 'webauthn.get',
            challenge: CryptoService.arrayBufferToBase64(challenge),
            origin: `https://${passkey.rpId}`,
            crossOrigin: false
        };
        const clientDataJSON = new TextEncoder().encode(JSON.stringify(clientData));

        // 4. Sign the combined data
        const clientDataHash = await window.crypto.subtle.digest('SHA-256', clientDataJSON);
        const signatureTarget = new Uint8Array(authData.length + clientDataHash.byteLength);
        signatureTarget.set(authData, 0);
        signatureTarget.set(new Uint8Array(clientDataHash), authData.length);

        const signature = await window.crypto.subtle.sign(
            {
                name: 'ECDSA',
                hash: { name: 'SHA-256' },
            },
            privateKey,
            signatureTarget
        );

        return {
            signature: CryptoService.arrayBufferToBase64(signature),
            authenticatorData: CryptoService.arrayBufferToBase64(authData.buffer),
            clientDataJSON: CryptoService.arrayBufferToBase64(clientDataJSON.buffer),
            newCounter: counter
        };
    }
}
