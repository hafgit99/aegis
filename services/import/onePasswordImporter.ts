import { ImportEntry } from '../importService';
import { Category, SensitiveData } from '../../types';

export class OnePasswordImporter {
    /**
     * Parses 1Password export (usually data.json inside .1pux)
     */
    static parseJSON(data: any): ImportEntry[] {
        const accounts = data.accounts || [];
        const entries: ImportEntry[] = [];

        accounts.forEach((account: any) => {
            const vaults = account.vaults || [];
            vaults.forEach((vault: any) => {
                const items = vault.items || [];
                items.forEach((item: any) => {
                    const sensitive: SensitiveData = {
                        password: '',
                        notes: item.notes || '',
                        url: '',
                        customFields: []
                    };

                    // Extract fields
                    (item.fields || []).forEach((field: any) => {
                        if (field.purpose === 'p') sensitive.password = field.value;
                        else if (field.purpose === 'u') item.username = field.value;
                        else {
                            sensitive.customFields?.push({
                                id: Math.random().toString(36).substring(7),
                                label: field.label || field.id || 'Field',
                                value: field.value || '',
                                isSecret: field.type === 'P'
                            });
                        }
                    });

                    // Extract URLs
                    if (item.urls && item.urls.length > 0) {
                        sensitive.url = item.urls[0].u;
                    }

                    let category = Category.LOGIN;
                    // 1Password categories: pass, login, card, note, etc.
                    const cat = (item.category || '').toLowerCase();
                    if (cat.includes('note')) category = Category.NOTE;
                    else if (cat.includes('card')) category = Category.CARD;

                    entries.push({
                        title: item.title || '1Password Entry',
                        username: item.username || '',
                        category,
                        tags: vault.name ? [vault.name] : [],
                        updatedAt: item.updatedAt ? item.updatedAt * 1000 : Date.now(),
                        sensitive
                    });
                });
            });
        });

        return entries;
    }
}
