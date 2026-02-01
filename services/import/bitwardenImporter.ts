import { ImportEntry } from '../importService';
import { Category, SensitiveData } from '../../types';
import { CryptoService } from '../cryptoService';

export class BitwardenImporter {
    /**
     * Parses Bitwarden JSON export (plaintext or pre-decrypted)
     */
    static parseJSON(data: any): ImportEntry[] {
        const items = data.items || [];
        const folders = data.folders || [];
        const folderMap = new Map(folders.map((f: any) => [f.id, f.name]));

        return items.map((item: any) => {
            const login = item.login || {};
            const sensitive: SensitiveData = {
                password: login.password || '',
                notes: item.notes || '',
                url: login.uris?.[0]?.uri || '',
                customFields: (item.fields || []).map((f: any) => ({
                    name: f.name,
                    value: f.value,
                    type: f.type === 1 ? 'hidden' : 'text'
                }))
            };

            // Card details
            if (item.card) {
                sensitive.cardDetails = {
                    holder: item.card.cardholderName || '',
                    number: item.card.number || '',
                    expiry: `${item.card.expMonth || ''}/${item.card.expYear || ''}`,
                    cvv: item.card.code || ''
                };
            }

            let category = Category.LOGIN;
            switch (item.type) {
                case 1: category = Category.LOGIN; break;
                case 2: category = Category.NOTE; break;
                case 3: category = Category.CARD; break;
                case 4: category = Category.LOGIN; break; // Map Identity to Login
            }

            return {
                title: item.name || 'Bitwarden Entry',
                username: login.username || '',
                category,
                tags: item.folderId && folderMap.has(item.folderId) ? [folderMap.get(item.folderId)] : [],
                updatedAt: item.revisionDate ? new Date(item.revisionDate).getTime() : Date.now(),
                sensitive
            };
        });
    }

    /**
     * Decrypts and parses Bitwarden JSON
     * Supports Password-Protected JSON exports
     */
    static async decryptAndParse(file: File, masterPassword?: string): Promise<ImportEntry[]> {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.encrypted) {
            return this.parseJSON(data);
        }

        if (!data.passwordProtected) {
            throw new Error("BITWARDEN_ACCOUNT_ENCRYPTED_NOT_SUPPORTED");
        }

        if (!masterPassword) {
            throw new Error("BITWARDEN_PASSWORD_REQUIRED");
        }

        try {
            // Derive Key: Bitwarden uses PBKDF2-SHA256 with the password as both password and salt
            const saltBytes = new TextEncoder().encode(masterPassword);
            const iterations = data.kdfIterations || 100000;

            // Derive 512 bits (256 for enc, 256 for mac)
            const keyMaterial = await CryptoService.deriveKeyPBKDF2Bits(masterPassword, saltBytes, iterations, 512);

            const encKeyBits = keyMaterial.slice(0, 32);
            const encKey = await window.crypto.subtle.importKey(
                'raw', encKeyBits, { name: 'AES-CBC' }, false, ['decrypt']
            );

            const gcmKey = await window.crypto.subtle.importKey(
                'raw', encKeyBits, { name: 'AES-GCM' }, false, ['decrypt']
            );

            // Decrypt the whole object tree recursively
            const decryptedData = await this.decryptObject(data, { cbc: encKey, gcm: gcmKey });
            return this.parseJSON(decryptedData);
        } catch (e) {
            console.error("[BitwardenImport] Decryption failed:", e);
            throw new Error("BITWARDEN_DECRYPT_FAILED");
        }
    }

    private static async decryptObject(obj: any, keys: { cbc: CryptoKey, gcm: CryptoKey }): Promise<any> {
        if (!obj || typeof obj !== 'object') return obj;

        if (Array.isArray(obj)) {
            return await Promise.all(obj.map(item => this.decryptObject(item, keys)));
        }

        const entries = await Promise.all(
            Object.entries(obj).map(async ([k, v]) => {
                if (typeof v === 'string' && v.includes('.')) {
                    try {
                        const decrypted = await this.decryptBitwardenString(v, keys);
                        return [k, decrypted];
                    } catch {
                        return [k, v];
                    }
                }
                return [k, await this.decryptObject(v, keys)];
            })
        );

        return Object.fromEntries(entries);
    }

    /**
     * Decrypts a Bitwarden Cipher String
     * Format: EncType.iv|ciphertext[|hmac]
     */
    private static async decryptBitwardenString(cipherString: string, keys: { cbc: CryptoKey, gcm: CryptoKey }): Promise<string> {
        const parts = cipherString.split('.');
        if (parts.length < 2) return cipherString;

        const encType = parseInt(parts[0]);
        const dataParts = parts[1].split('|');

        if (encType === 2) {
            // AES-GCM-256 (Type 2)
            // iv|ciphertext
            const iv = CryptoService.base64ToArrayBuffer(dataParts[0]);
            const ciphertext = CryptoService.base64ToArrayBuffer(dataParts[1]);

            // In Bitwarden GCM, tag is appended to ciphertext
            return CryptoService.decrypt(new Uint8Array(ciphertext), keys.gcm, new Uint8Array(iv), new Uint8Array(0));
        }

        if (encType === 0 || encType === 1) {
            // AES-CBC-256 (Type 0/1)
            // iv|ciphertext[|hmac]
            const iv = CryptoService.base64ToArrayBuffer(dataParts[0]);
            const ciphertext = CryptoService.base64ToArrayBuffer(dataParts[1]);

            return CryptoService.decryptCBC(new Uint8Array(ciphertext), keys.cbc, new Uint8Array(iv));
        }

        return cipherString;
    }
}
