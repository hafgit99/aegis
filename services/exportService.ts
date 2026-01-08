
import { db } from '../db';
import { CryptoService } from './cryptoService';
import { VaultEntry, Category } from '../types';
import { VaultService } from './vaultService';

export type ExportFormat = 'aegis' | 'json' | 'csv';

export class ExportService {
  static async exportVault(
    masterKey: CryptoKey,
    format: ExportFormat = 'aegis',
    isEncrypted: boolean = true,
    customPassword?: string
  ): Promise<void> {
    const entries = await db.vault.toArray();
    const decryptedEntries = [];

    // Tüm verileri dışa aktarım için deşifre et
    for (const entry of entries) {
      try {
        const sensitive = await VaultService.decryptEntry(entry, masterKey);
        const metadata = await VaultService.decryptEntryMetadata(entry, masterKey);

        // Map to a clean export object
        const exportEntry = {
          ...entry,
          ...metadata,
          sensitive: {
            ...sensitive,
            // Handle binary file attachments for JSON serialization
            fileBlob: sensitive.fileBlob instanceof Uint8Array
              ? CryptoService.arrayBufferToBase64(sensitive.fileBlob)
              : sensitive.fileBlob
          },
          // Ensure category is explicitly included (fallback to entry.category)
          category: metadata.category || entry.category
        };

        decryptedEntries.push(exportEntry);
      } catch (e) {
        console.error("Export: Entry decryption failed", entry.id, e);
      }
    }

    let blob: Blob;
    let fileName: string;
    const timestamp = new Date().toISOString().split('T')[0];

    if (isEncrypted) {
      // Şifreli Mod (Aegis Güvenlik Konteynırı)
      let payloadContent: string;
      let hint: string;

      if (format === 'csv') {
        payloadContent = this.convertToCSV(decryptedEntries);
        hint = "AEGIS_VAULT_CSV_BACKUP";
        fileName = `aegis_csv_secure_${timestamp}.aegis`;
      } else {
        const bundle = {
          version: "1.1",
          exportDate: Date.now(),
          entries: decryptedEntries,
          app: "Aegis Vault"
        };
        payloadContent = JSON.stringify(bundle);
        hint = "AEGIS_VAULT_BACKUP";
        fileName = `aegis_json_secure_${timestamp}.aegis`;
      }

      let encryptionKey = masterKey;
      let salt: string;
      let iterations: number;

      if (customPassword) {
        // Özel şifre ile yeni anahtar türet
        const saltBytes = window.crypto.getRandomValues(new Uint8Array(16));
        iterations = await CryptoService.benchmarkIterations();
        encryptionKey = await CryptoService.deriveKeyFromPassword(customPassword, saltBytes, iterations);
        salt = CryptoService.arrayBufferToBase64(saltBytes.buffer);
      } else {
        // Mevcut kasa anahtarını kullan
        const metadata = JSON.parse(localStorage.getItem('aegis_vault_metadata') || '{}');
        salt = metadata.salt;
        iterations = metadata.iterations;
      }

      const { ciphertext, iv, tag } = await CryptoService.encrypt(payloadContent, encryptionKey);

      const exportData = {
        payload: CryptoService.arrayBufferToBase64(ciphertext),
        iv: CryptoService.arrayBufferToBase64(iv.buffer as ArrayBuffer),
        tag: CryptoService.arrayBufferToBase64(tag.buffer as ArrayBuffer),
        salt: salt,
        iterations: iterations,
        hint: hint,
        encrypted: true
      };

      blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    } else if (format === 'json') {
      // SECURITY: Plaintext export is dangerous. Use encrypted export only.
      // If you need plaintext, manually decrypt and export separately.
      console.warn('[Security] Plaintext JSON export requested - this exposes all credentials unencrypted');
      return null;
    } else {
      // Düz Metin CSV
      const csvContent = this.convertToCSV(decryptedEntries);
      blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      fileName = `aegis_export_universal_${timestamp}.csv`;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private static convertToCSV(entries: any[]): string {
    const headers = ['Title', 'URL', 'Username', 'Password', 'Notes', 'Category', 'Tags'];
    const rows = entries.map(e => [
      `"${(e.title || '').replace(/"/g, '""')}"`,
      `"${(e.sensitive?.url || '').replace(/"/g, '""')}"`,
      `"${(e.username || '').replace(/"/g, '""')}"`,
      `"${(e.sensitive?.password || '').replace(/"/g, '""')}"`,
      `"${(e.sensitive?.notes || '').replace(/"/g, '""')}"`,
      `"${e.category}"`,
      `"${(e.tags || []).join(', ')}"`
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }
}
