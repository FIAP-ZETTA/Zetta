"use client"

import React, { createContext, useContext, useEffect, useState } from "react"

export type ThemeMode = "dark" | "light"
export type ThemeColor = "cyan" | "emerald" | "purple" | "amber" | "crimson" | "blue"

interface ThemeContextType {
  mode: ThemeMode
  color: ThemeColor
  setMode: (mode: ThemeMode) => void
  setColor: (color: ThemeColor) => void
  toggleMode: () => void
}

const ThemeContext = createContext<ThemeContextType>({
  mode: "dark",
  color: "cyan",
  setMode: () => {},
  setColor: () => {},
  toggleMode: () => {},
})

const LS_MODE_KEY = "zetta-theme-mode"
const LS_COLOR_KEY = "zetta-theme-color"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("dark")
  const [color, setColorState] = useState<ThemeColor>("cyan")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try {
      const savedMode = (localStorage.getItem(LS_MODE_KEY) as ThemeMode) || "dark"
      const savedColor = (localStorage.getItem(LS_COLOR_KEY) as ThemeColor) || "cyan"
      setModeState(savedMode)
      setColorState(savedColor)
      applyTheme(savedMode, savedColor)
    } catch {
      applyTheme("dark", "cyan")
    }
    setMounted(true)
  }, [])

  function applyTheme(m: ThemeMode, c: ThemeColor) {
    const root = document.documentElement
    if (m === "dark") {
      root.classList.add("dark")
      root.classList.remove("light")
    } else {
      root.classList.add("light")
      root.classList.remove("dark")
    }
    root.setAttribute("data-color", c)
  }

  function setMode(newMode: ThemeMode) {
    setModeState(newMode)
    try {
      localStorage.setItem(LS_MODE_KEY, newMode)
    } catch {}
    applyTheme(newMode, color)
  }

  function setColor(newColor: ThemeColor) {
    setColorState(newColor)
    try {
      localStorage.setItem(LS_COLOR_KEY, newColor)
    } catch {}
    applyTheme(mode, newColor)
  }

  function toggleMode() {
    setMode(mode === "dark" ? "light" : "dark")
  }

  return (
    <ThemeContext.Provider value={{ mode, color, setMode, setColor, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
