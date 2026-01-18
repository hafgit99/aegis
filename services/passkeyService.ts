
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
     * This is part of the WebAuthn Registration (navigator.credentials.create) flow.
     */
    static async createCredential(rpId: string, displayName: string): Promise<PasskeyDetails> {
        const credentialId = window.crypto.getRandomValues(new Uint8Array(16));

        // Generate an ES256 (ECDSA) key pair - Most common for WebAuthn
        const keyPair = await window.crypto.subtle.generateKey(
            {
                name: 'ECDSA',
                namedCurve: 'P-256',
            },
            true, // extractable (so we can save it encrypted)
            ['sign', 'verify']
        );

        // Export public key to SPKI format (Standard for WebAuthn/Public use)
        const publicKeyBuffer = await window.crypto.subtle.exportKey('spki', keyPair.publicKey);

        // Export private key to PKCS#8 format (To encrypt and store in vault)
        const privateKeyBuffer = await window.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

        return {
            credentialId: CryptoService.arrayBufferToBase64(credentialId),
            publicKey: CryptoService.arrayBufferToBase64(publicKeyBuffer),
            privateKey: CryptoService.arrayBufferToBase64(privateKeyBuffer), // Encrypted later in vault
            signCount: 0,
            rpId,
            displayName,
            createdAt: Date.now(),
            transports: ['internal', 'usb', 'nfc']
        };
    }

    /**
     * Generates a signature for a WebAuthn Assertion (navigator.credentials.get)
     */
    static async signChallenge(passkey: PasskeyDetails, challenge: ArrayBuffer): Promise<{
        signature: string;
        authenticatorData: string;
        clientDataJSON: string;
    }> {
        if (!passkey.privateKey) throw new Error("Private key missing for passkey");

        // 1. Import the private key
        const privateKey = await window.crypto.subtle.importKey(
            'pkcs8',
            CryptoService.base64ToArrayBuffer(passkey.privateKey),
            {
                name: 'ECDSA',
                namedCurve: 'P-256',
            },
            false,
            ['sign']
        );

        // 2. Mock Authenticator Data (WebAuthn spec)
        // RP ID Hash (32 bytes) + Flags (1 byte) + Counter (4 bytes)
        const rpIdHash = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(passkey.rpId));
        const authData = new Uint8Array(37);
        authData.set(new Uint8Array(rpIdHash), 0);
        authData[32] = 0x01; // User Presence (UP) flag

        // Counter in big-endian
        const counter = passkey.signCount + 1;
        authData[33] = (counter >> 24) & 0xff;
        authData[34] = (counter >> 16) & 0xff;
        authData[35] = (counter >> 8) & 0xff;
        authData[36] = counter & 0xff;

        // 3. Mock Client Data JSON
        const clientData = {
            type: 'webauthn.get',
            challenge: CryptoService.arrayBufferToBase64(challenge),
            origin: `https://${passkey.rpId}`, // In reality this comes from browser
            crossOrigin: false
        };
        const clientDataJSON = new TextEncoder().encode(JSON.stringify(clientData));

        // 4. Sign the combined data (authData + clientDataHash)
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
            clientDataJSON: CryptoService.arrayBufferToBase64(clientDataJSON.buffer)
        };
    }
}
