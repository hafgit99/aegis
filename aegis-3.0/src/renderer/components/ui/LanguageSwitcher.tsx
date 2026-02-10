import React from 'react';
import { useTranslation } from '../../i18n/useTranslation';
import { Globe } from 'lucide-react';
import { motion } from 'framer-motion';

export const LanguageSwitcher: React.FC = () => {
    const { currentLanguage, setLanguage } = useTranslation();

    const languages = [
        { code: 'tr' as const, name: 'Türkçe', flag: '🇹🇷' },
        { code: 'en' as const, name: 'English', flag: '🇬🇧' },
    ];

    return (
        <div className="flex items-center gap-2 p-1 bg-black/20 rounded-xl border border-white/5">
            {languages.map((lang) => (
                <motion.button
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`
            flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
            ${currentLanguage === lang.code
                            ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                            : 'text-white/40 hover:text-white hover:bg-white/5'
                        }
          `}
                >
                    <span className="text-lg">{lang.flag}</span>
                    <span>{lang.name}</span>
                </motion.button>
            ))}
        </div>
    );
};

export const LanguageSelector: React.FC = () => {
    const { t } = useTranslation();

    return (
        <div className="space-y-2">
            <label className="text-xs text-white/40 font-medium flex items-center gap-2">
                <Globe className="w-4 h-4" />
                {t('settings.language')}
            </label>
            <LanguageSwitcher />
            <p className="text-[10px] text-white/20 italic">
                {t('settings.languageDesc')}
            </p>
        </div>
    );
};
