import { useState, useEffect } from 'react';
import { i18n, Language } from './index';

export function useTranslation() {
    const [, forceUpdate] = useState({});

    useEffect(() => {
        const unsubscribe = i18n.subscribe(() => {
            forceUpdate({});
        });
        return () => {
            unsubscribe();
        };
    }, []);

    const t = (key: string, params?: Record<string, string | number>) => {
        return i18n.t(key, params);
    };

    const setLanguage = (lang: Language) => {
        i18n.setLanguage(lang);
    };

    const currentLanguage = i18n.getLanguage();

    return {
        t,
        setLanguage,
        currentLanguage,
    };
}
