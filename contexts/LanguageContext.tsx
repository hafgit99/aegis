
import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, Language } from '../i18n/translations';

interface LanguageContextType {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: keyof typeof translations['en']) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('aegis_lang');
    return (saved as Language) || 'en';
  });

  useEffect(() => {
    localStorage.setItem('aegis_lang', lang);
  }, [lang]);

  const t = (key: keyof typeof translations['en']): string => {
    return translations[lang][key] || translations['en'][key];
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
};
