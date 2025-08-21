import { useState, useEffect } from 'react';
import { loadFeedSettings, saveFeedSettings } from '../lib/settings';

export function useLanguage() {
  const [language, setLanguageState] = useState<'en' | 'tr'>('en');

  useEffect(() => {
    const settings = loadFeedSettings();
    setLanguageState(settings.language);
  }, []);

  const setLanguage = (lang: 'en' | 'tr') => {
    setLanguageState(lang);
    const settings = loadFeedSettings();
    settings.language = lang;
    saveFeedSettings(settings);
  };

  return { language, setLanguage };
} 