import { tr } from './locales/tr';
import { en } from './locales/en';

export type Language = 'tr' | 'en';

const translations = {
    tr,
    en,
};

class I18n {
    private currentLanguage: Language = 'tr';
    private listeners: Set<() => void> = new Set();

    constructor() {
        // Load saved language from localStorage
        const saved = localStorage.getItem('aegis-language') as Language;
        if (saved && (saved === 'tr' || saved === 'en')) {
            this.currentLanguage = saved;
        }
    }

    setLanguage(lang: Language) {
        this.currentLanguage = lang;
        localStorage.setItem('aegis-language', lang);
        this.notifyListeners();
    }

    getLanguage(): Language {
        return this.currentLanguage;
    }

    subscribe(listener: () => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notifyListeners() {
        this.listeners.forEach(listener => listener());
    }

    t(key: string, params?: Record<string, string | number>): string {
        const keys = key.split('.');
        let value: any = translations[this.currentLanguage];

        for (const k of keys) {
            if (value && typeof value === 'object') {
                value = value[k];
            } else {
                console.warn(`Translation key not found: ${key}`);
                return key;
            }
        }

        if (typeof value !== 'string') {
            console.warn(`Translation value is not a string: ${key}`);
            return key;
        }

        // Replace parameters like {count} with actual values
        if (params) {
            return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
                return params[paramKey]?.toString() || match;
            });
        }

        return value;
    }
}

export const i18n = new I18n();

// Helper function for easier usage
export const t = (key: string, params?: Record<string, string | number>) => i18n.t(key, params);
