import React, { createContext, useState, useContext, useEffect } from 'react';
import { translations } from '../utils/translations';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
    const [language, setLanguage] = useState('en');

    useEffect(() => {
        const savedLanguage = localStorage.getItem('appLanguage');
        if (savedLanguage) {
            setLanguage(savedLanguage);
        }
    }, []);

    const switchLanguage = (lang) => {
        setLanguage(lang);
        localStorage.setItem('appLanguage', lang);
    };

    const t = (key) => {
        return translations[language][key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, switchLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => useContext(LanguageContext);
