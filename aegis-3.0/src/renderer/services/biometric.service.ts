export class BiometricService {
    /**
     * Check if biometrics (TouchID/FaceID/Windows Hello) are available
     */
    static async isAvailable(): Promise<boolean> {
        if (!window.PublicKeyCredential) return false;

        // Check for platform authenticator
        return window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }

    /**
     * Register a new biometric credential
     */
    static async register(username: string): Promise<any> {
        // This is a simplified WebAuthn registration flow
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        const userID = new Uint8Array(16);
        window.crypto.getRandomValues(userID);

        const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
            challenge,
            rp: {
                name: "Aegis Vault",
                id: window.location.hostname || "localhost",
            },
            user: {
                id: userID,
                name: username,
                displayName: username,
            },
            pubKeyCredParams: [{ alg: -7, type: "public-key" }], // ES256
            authenticatorSelection: {
                authenticatorAttachment: "platform",
                userVerification: "required",
            },
            timeout: 60000,
        };

        try {
            const credential = await navigator.credentials.create({
                publicKey: publicKeyCredentialCreationOptions,
            });
            return credential;
        } catch (error) {
            console.error("Biometric registration failed:", error);
            throw error;
        }
    }

    /**
     * Authenticate using biometrics
     */
    static async authenticate(): Promise<any> {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
            challenge,
            allowCredentials: [], // Allow any registered platform credential
            userVerification: "required",
            timeout: 60000,
        };

        try {
            const assertion = await navigator.credentials.get({
                publicKey: publicKeyCredentialRequestOptions,
            });
            return assertion;
        } catch (error) {
            console.error("Biometric authentication failed:", error);
            throw error;
        }
    }
}
