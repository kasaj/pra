import { createContext, useContext, useState, ReactNode } from 'react';
import { Language, translations, Translations } from './translations';
import { getCachedConfig } from '../utils/config';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

const STORAGE_KEY = 'pra_language';

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'cs' || stored === 'en') return stored;
    // Fallback to config default
    const configLang = getCachedConfig()?.language;
    if (configLang === 'cs' || configLang === 'en') return configLang;
    // Detekce jazyka prohlížeče
    const browserLang = navigator.language.split('-')[0];
    return browserLang === 'cs' ? 'cs' : 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  };

  const t = translations[language];

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
