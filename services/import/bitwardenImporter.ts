import { ImportEntry } from '../importService';
import { Category, SensitiveData } from '../../types';

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
     * Placeholder for encrypted Bitwarden JSON decryption
     * In a real implementation, this would use the user's Bitwarden password
     */
    static async decryptAndParse(file: File, masterPassword?: string): Promise<ImportEntry[]> {
        const text = await file.text();
        const data = JSON.parse(text);

        if (!data.encrypted) {
            return this.parseJSON(data);
        }

        if (!masterPassword) {
            throw new Error("BITWARDEN_PASSWORD_REQUIRED");
        }

        // TODO: Implement Bitwarden decryption logic if needed
        // This usually involves PBKDF2/Argon2 and AES-256-CBC/GCM
        // For now, we'll suggest the user to use plaintext export for compatibility
        throw new Error("ENCRYPTED_BITWARDEN_NOT_SUPPORTED_YET");
    }
}
