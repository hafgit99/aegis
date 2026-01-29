import { ImportEntry, ImportService } from '../importService';
import { Category, SensitiveData } from '../../types';
import Papa from 'papaparse';

export class LastPassImporter {
    static async parseCSV(file: File): Promise<ImportEntry[]> {
        const text = await file.text();
        // LastPass CSV format: url,username,password,extra,name,grouping,fav

        return new Promise((resolve, reject) => {
            Papa.parse(text, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => {
                    const entries: ImportEntry[] = results.data.map((row: any) => {
                        const sensitive: SensitiveData = {
                            password: row.password || '',
                            notes: row.extra || '',
                            url: row.url || '',
                            customFields: []
                        };

                        // Detect category based on grouping or content
                        let category = Category.LOGIN;
                        const grouping = (row.grouping || '').toLowerCase();
                        if (grouping.includes('note') || (!row.password && row.extra)) {
                            category = Category.NOTE;
                        }

                        return {
                            title: row.name || row.url || 'LastPass Entry',
                            username: row.username || '',
                            category,
                            tags: row.grouping ? [row.grouping] : [],
                            updatedAt: Date.now(),
                            sensitive
                        };
                    });
                    resolve(entries);
                },
                error: (error) => {
                    reject(new Error(`LastPass CSV parse error: ${error.message}`));
                }
            });
        });
    }
}
