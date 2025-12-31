
import { db } from '../db';
import { CryptoService } from './cryptoService';
import { VaultEntry, Category } from '../types';
import { VaultService } from './vaultService';

export type ExportFormat = 'aegis' | 'json' | 'csv';

export class ExportService {
  static async exportVault(
    masterKey: CryptoKey,
    format: ExportFormat = 'aegis',
    isEncrypted: boolean = true
  ): Promise<void> {
    const entries = await db.vault.toArray();
    const decryptedEntries = [];

    // Tüm verileri dışa aktarım için deşifre et
    for (const entry of entries) {
      try {
        const sensitive = await VaultService.decryptEntry(entry, masterKey);
        decryptedEntries.push({ ...entry, sensitive });
      } catch (e) {
        console.error("Export: Entry decryption failed", entry.id);
      }
    }

    let blob: Blob;
    let fileName: string;
    const timestamp = new Date().toISOString().split('T')[0];

    if (isEncrypted) {
      // Şifreli Mod (Aegis Güvenlik Konteynırı)
      let payloadContent: string;
      let hint: string;
      let extension: string = 'aegis';

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

      const { ciphertext, iv } = await CryptoService.encrypt(payloadContent, masterKey);

      const exportData = {
        payload: CryptoService.arrayBufferToBase64(ciphertext),
        iv: CryptoService.arrayBufferToBase64(iv.buffer as ArrayBuffer),
        hint: hint,
        encrypted: true
      };

      blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    } else if (format === 'json') {
      // Düz Metin JSON
      blob = new Blob([JSON.stringify(decryptedEntries, null, 2)], { type: 'application/json' });
      fileName = `aegis_export_plaintext_${timestamp}.json`;
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
