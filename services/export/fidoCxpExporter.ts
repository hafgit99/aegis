import { VaultEntry, Category } from '../../types';
import { CryptoService } from '../cryptoService';

/**
 * FIDO CXP (Credential Exchange Format) Exporter
 * Focuses on exporting Passkeys in a format compatible with other passkey managers
 */
export class FidoCxpExporter {
    static async exportPasskeys(entries: any[]): Promise<void> {
        const passkeyEntries = entries.filter(e => e.category === Category.PASSKEY || e.sensitive?.passkeyDetails);

        const cxpData = {
            version: "1.0",
            generator: "Aegis Vault",
            exportDate: new Date().toISOString(),
            credentials: passkeyEntries.map(e => ({
                type: "public-key",
                id: e.sensitive.passkeyDetails?.credentialId,
                rpId: e.sensitive.passkeyDetails?.rpId,
                user: {
                    id: e.sensitive.passkeyDetails?.userHandle,
                    name: e.username,
                    displayName: e.sensitive.passkeyDetails?.displayName || e.username
                },
                // In CXP, private keys are usually encrypted or handled separately
                // This is a simplified CXP-like structure for metadata exchange
                metadata: {
                    title: e.title,
                    created: e.updatedAt, // Use updatedAt as fallback
                    updated: e.updatedAt
                }
            }))
        };

        const blob = new Blob([JSON.stringify(cxpData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const timestamp = new Date().toISOString().split('T')[0];
        a.href = url;
        a.download = `aegis_passkeys_cxp_${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}
