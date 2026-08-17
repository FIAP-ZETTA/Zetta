"use client"

import { useState, useRef, useEffect } from "react"
import { Palette, Sun, Moon, Check, Globe } from "lucide-react"
import { useTheme, type ThemeColor } from "@/lib/theme-provider"
import { useLanguage } from "@/lib/language-provider"
import { cn } from "@/lib/utils"

const colorPalettes: {
  id: ThemeColor
  colorKey: "cyan" | "emerald" | "purple" | "amber" | "crimson" | "blue"
  color: string
  bg: string
}[] = [
  { id: "cyan",    colorKey: "cyan",    color: "#00e5ff", bg: "bg-[#00e5ff]" },
  { id: "emerald", colorKey: "emerald", color: "#10b981", bg: "bg-[#10b981]" },
  { id: "purple",  colorKey: "purple",  color: "#a855f7", bg: "bg-[#a855f7]" },
  { id: "amber",   colorKey: "amber",   color: "#f59e0b", bg: "bg-[#f59e0b]" },
  { id: "crimson", colorKey: "crimson", color: "#f43f5e", bg: "bg-[#f43f5e]" },
  { id: "blue",    colorKey: "blue",    color: "#3b82f6", bg: "bg-[#3b82f6]" },
]

export function ThemeSwitcher() {
  const { mode, color, setMode, setColor } = useTheme()
  const { lang, setLang, t } = useLanguage()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        id="theme-switcher-btn"
        onClick={() => setOpen(v => !v)}
        className="relative flex h-8 w-8 items-center justify-center border border-border bg-card text-muted-foreground transition-all hover:border-primary/50 hover:text-foreground"
        title={t.theme.title}
        aria-label={t.theme.title}
      >
        <Palette className="h-3.5 w-3.5 text-primary" />
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-72 border border-border bg-card text-card-foreground p-4 shadow-2xl animate-fade-up space-y-4">
          {/* Cabeçalho */}
          <div className="border-b border-border pb-2.5">
            <p className="text-xs font-bold uppercase tracking-wider text-foreground">
              {t.theme.title}
            </p>
          </div>

          {/* Seletor de Idioma */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Globe className="h-3 w-3 text-primary" />
              {t.theme.language}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLang("pt")}
                className={cn(
                  "flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold transition-all border",
                  lang === "pt"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <span>🇧🇷</span>
                {t.theme.portuguese}
              </button>

              <button
                type="button"
                onClick={() => setLang("en")}
                className={cn(
                  "flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold transition-all border",
                  lang === "en"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <span>🇺🇸</span>
                {t.theme.english}
              </button>
            </div>
          </div>

          {/* Seletor de Modo (Escuro / Claro) */}
          <div className="space-y-2 pt-1 border-t border-border">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              {t.theme.mode}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMode("dark")}
                className={cn(
                  "flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold transition-all border",
                  mode === "dark"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Moon className="h-3.5 w-3.5" />
                {t.theme.dark}
              </button>

              <button
                type="button"
                onClick={() => setMode("light")}
                className={cn(
                  "flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold transition-all border",
                  mode === "light"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Sun className="h-3.5 w-3.5" />
                {t.theme.light}
              </button>
            </div>
          </div>

          {/* Seletor de Paleta de Cores */}
          <div className="space-y-2 pt-1 border-t border-border">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              {t.theme.colors}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {colorPalettes.map(p => {
                const isSelected = color === p.id
                const name = t.theme[p.colorKey] ?? p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setColor(p.id)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-2 text-[11px] font-medium transition-all border relative",
                      isSelected
                        ? "border-primary bg-primary/10 text-foreground font-bold shadow-sm"
                        : "border-border bg-muted/20 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    )}
                  >
                    <div
                      className={cn(
                        "h-4 w-4 rounded-full flex items-center justify-center shadow-sm",
                        p.bg
                      )}
                    >
                      {isSelected && <Check className="h-2.5 w-2.5 text-black font-extrabold" />}
                    </div>
                    <span className="truncate max-w-[70px] text-[10px]">
                      {name}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
