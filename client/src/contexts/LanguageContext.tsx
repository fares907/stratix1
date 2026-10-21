import React, { createContext, useContext, useEffect, useState } from "react";
import { navigate } from "wouter/use-browser-location";
import { type Language, translations } from "@/lib/translations";

interface LanguageContextType {
  language: Language;
  t: (typeof translations)[Language];
  toggleLanguage: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = "stratix-language";

// Must match the <title> in client/index.html and client/i18n/en.head.html.
const HOME_TITLES: Record<Language, string> = {
  ar: "STRATIX — مواقع تتحرك بقوة فكرتك",
  en: "STRATIX — Websites That Move With Your Idea",
};

const isEnglishPath = (pathname: string) => pathname === "/en" || pathname.startsWith("/en/");
const isHomePath = (pathname: string) => pathname === "/" || isEnglishPath(pathname);

// On the homepage the URL is the source of truth: "/" is Arabic and "/en" is
// English, each with its own indexable address. Elsewhere (payment page) the
// visitor's last choice is remembered.
function initialLanguage(): Language {
  const { pathname } = window.location;
  if (isHomePath(pathname)) return isEnglishPath(pathname) ? "en" : "ar";
  try {
    return localStorage.getItem(STORAGE_KEY) === "en" ? "en" : "ar";
  } catch {
    return "ar";
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguage] = useState<Language>(initialLanguage);

  useEffect(() => {
    const t = translations[language];
    document.documentElement.lang = language;
    document.documentElement.dir = t.dir;
    if (isHomePath(window.location.pathname)) document.title = HOME_TITLES[language];
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // Private browsing or blocked storage: the choice just isn't remembered.
    }
  }, [language]);

  // Back/forward between "/" and "/en" switches the language with the page.
  useEffect(() => {
    const onPop = () => {
      const { pathname } = window.location;
      if (isHomePath(pathname)) setLanguage(isEnglishPath(pathname) ? "en" : "ar");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const toggleLanguage = () => {
    const next: Language = language === "ar" ? "en" : "ar";
    const { pathname, hash } = window.location;
    if (isHomePath(pathname)) navigate(`${next === "en" ? "/en" : "/"}${hash}`);
    setLanguage(next);
  };

  return (
    <LanguageContext.Provider value={{ language, t: translations[language], toggleLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within LanguageProvider");
  }
  return context;
}
