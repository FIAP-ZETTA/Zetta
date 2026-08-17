"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { dictionary, type Language } from "@/lib/i18n"

export type DictionaryType = typeof dictionary.pt

interface LanguageContextType {
  lang: Language
  setLang: (lang: Language) => void
  t: DictionaryType
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "pt",
  setLang: () => {},
  t: dictionary.pt,
})

const LS_LANG_KEY = "zetta-language"

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>("pt")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try {
      const saved = (localStorage.getItem(LS_LANG_KEY) as Language) || "pt"
      if (saved === "pt" || saved === "en") {
        setLangState(saved)
      }
    } catch {}
    setMounted(true)
  }, [])

  function setLang(newLang: Language) {
    setLangState(newLang)
    try {
      localStorage.setItem(LS_LANG_KEY, newLang)
    } catch {}
  }

  const currentDict = (dictionary[lang] ?? dictionary.pt) as DictionaryType

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: currentDict }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
