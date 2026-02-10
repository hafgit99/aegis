export class ImportExportService {
    /**
     * Export vault to a file (JSON or CSV)
     */
    static async exportVault(entries: any[], format: 'json' | 'csv' = 'json'): Promise<void> {
        let content: string;
        let mimeType: string;
        let extension: string;

        if (format === 'csv') {
            content = this.jsonToCsv(entries);
            mimeType = 'text/csv';
            extension = 'csv';
        } else {
            content = JSON.stringify(entries, null, 2);
            mimeType = 'application/json';
            extension = 'json';
        }

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `aegis_export_${new Date().toISOString().split('T')[0]}.${extension}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Import vault from a file (JSON or CSV)
     */
    static async importVault(file: File): Promise<any[]> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            const extension = file.name.split('.').pop()?.toLowerCase();

            reader.onload = (e) => {
                try {
                    const content = e.target?.result as string;
                    if (extension === 'csv') {
                        const entries = this.csvToJson(content);
                        resolve(entries);
                    } else {
                        const entries = JSON.parse(content);
                        if (Array.isArray(entries)) {
                            resolve(entries);
                        } else {
                            reject(new Error('Geçersiz JSON: Bir dizi bekleniyordu.'));
                        }
                    }
                } catch (err) {
                    reject(new Error(`Dosya işleme hatası: ${err instanceof Error ? err.message : 'Bilinmeyen hata'}`));
                }
            };
            reader.onerror = () => reject(new Error('Dosya okunamadı.'));
            reader.readAsText(file);
        });
    }

    private static jsonToCsv(items: any[]): string {
        const header = ['title', 'website', 'username', 'password', 'category', 'tags'];
        const csvRows = [header.join(',')];

        for (const item of items) {
            const values = header.map(field => {
                const val = item[field] || '';
                const escaped = ('' + val).replace(/"/g, '""');
                return `"${escaped}"`;
            });
            csvRows.push(values.join(','));
        }
        return csvRows.join('\r\n');
    }

    private static csvToJson(csvContent: string): any[] {
        const lines = csvContent.split(/\r?\n/);
        if (lines.length < 1) return [];

        // Başlıkları belirle
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
        const result = [];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const row: string[] = [];
            let inQuotes = false;
            let currentField = '';

            for (let j = 0; j < line.length; j++) {
                const char = line[j];
                if (char === '"') {
                    if (inQuotes && line[j + 1] === '"') {
                        currentField += '"'; // Escaped quote
                        j++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    row.push(currentField);
                    currentField = '';
                } else {
                    currentField += char;
                }
            }
            row.push(currentField);

            const obj: any = {};
            headers.forEach((header, index) => {
                let val = row[index] || '';
                // Trim and clean
                val = val.trim().replace(/^"|"$/g, '');
                obj[header] = val;
            });

            // Zorunlu alan kontrolü
            if (obj.title) {
                obj.id = crypto.randomUUID();
                result.push(obj);
            }
        }
        return result;
    }
}
