"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Bell, Search, AlertTriangle, ShieldCheck, Shield } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { ThemeSwitcher } from "@/components/theme-switcher"
import { useLanguage } from "@/lib/language-provider"
import { useState, useEffect, useRef } from "react"
import { loadScanResult } from "@/lib/zettascan-api"

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useLanguage()
  const isHome = pathname === "/"

  const titles: Record<string, { title: string; sub: string }> = {
    "/":               { title: t.header.titles.home,        sub: t.header.titles.homeSub },
    "/zettadash":     { title: t.header.titles.zettadash,   sub: t.header.titles.zettadashSub },
    "/zettascan":     { title: t.header.titles.zettascan,   sub: t.header.titles.zettascanSub },
    "/zettaguard":    { title: t.header.titles.zettaguard,  sub: t.header.titles.zettaguardSub },
    "/devops":        { title: t.header.titles.devops,      sub: t.header.titles.devopsSub },
    "/configuracoes": { title: t.header.titles.connections, sub: t.header.titles.connectionsSub },
  }

  const meta = titles[pathname] ?? titles["/"]

  // Notificações — count de críticas do último scan
  const [critCount, setCritCount] = useState(0)
  const [showNotif, setShowNotif] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  // Search
  const [searchVal, setSearchVal] = useState("")

  useEffect(() => {
    const result = loadScanResult()
    if (result) setCritCount(result.criticas + result.altas)
  }, [pathname])

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotif(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  function handleSearch(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && searchVal.trim()) {
      router.push(`/zettascan?q=${encodeURIComponent(searchVal.trim())}`)
      setSearchVal("")
    }
  }

  return (
    <div className="flex min-h-screen bg-tech-grid text-foreground">
      {/* Barra lateral: exibida SOMENTE quando não estiver na tela inicial */}
      {!isHome && <AppSidebar />}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header com linha fina separadora na cor de acentuação ativa */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-primary/50 shadow-[0_1px_10px_var(--primary-glow)] bg-background/90 backdrop-blur-xl px-4 md:px-8">
          {/* Layout do Header na Home */}
          {isHome ? (
            <>
              {/* Lado esquerdo vazio para manter o ícone perfeitamente centralizado */}
              <div className="w-16 hidden sm:block" />

              {/* Centro: Ícone vetor do ZettaGuard (anel pontilhado giratório + escudo normal) */}
              <div className="flex items-center justify-center">
                <Link href="/" className="group relative flex h-10 w-10 items-center justify-center">
                  {/* Anel circular pontilhado girando com glow */}
                  <svg
                    className="absolute inset-0 h-full w-full animate-[spin_10s_linear_infinite] text-primary"
                    viewBox="0 0 40 40"
                    fill="none"
                  >
                    <circle
                      cx="20"
                      cy="20"
                      r="16"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeDasharray="4 4"
                      className="opacity-90 [filter:drop-shadow(0_0_6px_var(--primary))]"
                    />
                  </svg>

                  {/* Símbolo normal de Escudo no centro */}
                  <Shield className="h-4 w-4 text-primary relative z-10 [filter:drop-shadow(0_0_4px_var(--primary))] transition-transform duration-300 group-hover:scale-110" />
                </Link>
              </div>

              {/* Lado direito: Tema + Notificações + Perfil */}
              <div className="flex items-center gap-2.5">
                {/* Seletor de Temas, Cores e Idioma */}
                <ThemeSwitcher />

                {/* Notificações */}
                <div className="relative" ref={notifRef}>
                  <button
                    type="button"
                    id="notifications-btn"
                    onClick={() => setShowNotif(v => !v)}
                    className="relative flex h-8 w-8 items-center justify-center border border-border bg-card text-muted-foreground transition-all hover:border-primary/50 hover:text-foreground"
                    aria-label={t.header.notifications}
                  >
                    <Bell className="h-3.5 w-3.5" />
                    {critCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center bg-destructive text-[9px] font-bold text-white shadow-[0_0_8px_rgba(244,63,94,0.8)]">
                        {critCount > 9 ? "9+" : critCount}
                      </span>
                    )}
                  </button>

                  {/* Dropdown notificações */}
                  {showNotif && (
                    <div className="absolute right-0 top-10 z-50 w-80 border border-border bg-card shadow-2xl animate-fade-up">
                      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                        <p className="text-xs font-bold uppercase tracking-wider text-foreground">{t.header.notifications}</p>
                        {critCount > 0 && (
                          <span className="bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive border border-destructive/30">
                            {critCount} {t.scan.critical.toLowerCase()}
                          </span>
                        )}
                      </div>
                      {critCount === 0 ? (
                        <div className="px-4 py-6 text-center">
                          <ShieldCheck className="h-7 w-7 text-primary/60 mx-auto mb-2" />
                          <p className="text-xs font-bold text-foreground">{t.header.noAlerts}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {t.header.noAlertsSub}
                          </p>
                        </div>
                      ) : (
                        <div className="p-2">
                          <button
                            onClick={() => { setShowNotif(false); router.push("/zettascan") }}
                            className="w-full flex items-start gap-2.5 p-2.5 text-left transition-colors hover:bg-muted"
                          >
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                            <div>
                              <p className="text-xs font-bold text-foreground">
                                {critCount} {t.header.alertsDetected}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {t.header.viewInScan}
                              </p>
                            </div>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Perfil / Avatar */}
                <div className="flex h-8 w-8 items-center justify-center bg-primary/10 text-xs font-mono font-bold text-primary border border-primary/30 shadow-[0_0_10px_var(--primary-glow)]">
                  ZG
                </div>
              </div>
            </>
          ) : (
            /* Layout do Header nas Telas Internas */
            <>
              <div className="flex items-center gap-3 min-w-0">
                <div className="min-w-0">
                  <h1 className="font-heading text-sm sm:text-base font-bold leading-none text-foreground tracking-tight">
                    {meta.title}
                  </h1>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{meta.sub}</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                {/* Search */}
                <div className="hidden items-center gap-2 border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground lg:flex transition-all hover:border-primary/50 focus-within:border-primary">
                  <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <input
                    placeholder={t.header.searchPlaceholder}
                    value={searchVal}
                    onChange={e => setSearchVal(e.target.value)}
                    onKeyDown={handleSearch}
                    className="w-52 bg-transparent text-foreground placeholder:text-muted-foreground/50 focus:outline-none text-xs"
                    aria-label={t.header.searchPlaceholder}
                  />
                  {searchVal && (
                    <kbd className="text-[10px] text-muted-foreground font-mono">↵</kbd>
                  )}
                </div>

                {/* Seletor de Temas, Cores e Idioma */}
                <ThemeSwitcher />

                {/* Notificações */}
                <div className="relative" ref={notifRef}>
                  <button
                    type="button"
                    id="notifications-btn"
                    onClick={() => setShowNotif(v => !v)}
                    className="relative flex h-8 w-8 items-center justify-center border border-border bg-card text-muted-foreground transition-all hover:border-primary/50 hover:text-foreground"
                    aria-label={t.header.notifications}
                  >
                    <Bell className="h-3.5 w-3.5" />
                    {critCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center bg-destructive text-[9px] font-bold text-white shadow-[0_0_8px_rgba(244,63,94,0.8)]">
                        {critCount > 9 ? "9+" : critCount}
                      </span>
                    )}
                  </button>

                  {/* Dropdown notificações */}
                  {showNotif && (
                    <div className="absolute right-0 top-10 z-50 w-80 border border-border bg-card shadow-2xl animate-fade-up">
                      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                        <p className="text-xs font-bold uppercase tracking-wider text-foreground">{t.header.notifications}</p>
                        {critCount > 0 && (
                          <span className="bg-destructive/15 px-2 py-0.5 text-[10px] font-bold text-destructive border border-destructive/30">
                            {critCount} {t.scan.critical.toLowerCase()}
                          </span>
                        )}
                      </div>
                      {critCount === 0 ? (
                        <div className="px-4 py-6 text-center">
                          <ShieldCheck className="h-7 w-7 text-primary/60 mx-auto mb-2" />
                          <p className="text-xs font-bold text-foreground">{t.header.noAlerts}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {t.header.noAlertsSub}
                          </p>
                        </div>
                      ) : (
                        <div className="p-2">
                          <button
                            onClick={() => { setShowNotif(false); router.push("/zettascan") }}
                            className="w-full flex items-start gap-2.5 p-2.5 text-left transition-colors hover:bg-muted"
                          >
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />
                            <div>
                              <p className="text-xs font-bold text-foreground">
                                {critCount} {t.header.alertsDetected}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {t.header.viewInScan}
                              </p>
                            </div>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Perfil / Avatar */}
                <div className="flex h-8 w-8 items-center justify-center bg-primary/10 text-xs font-mono font-bold text-primary border border-primary/30 shadow-[0_0_10px_var(--primary-glow)]">
                  ZG
                </div>
              </div>
            </>
          )}
        </header>

        {/* Mobile Navigation (apenas se fora da home) */}
        {!isHome && <MobileNav pathname={pathname} />}

        <main className="flex-1 p-4 md:p-8 animate-fade-up">{children}</main>
      </div>
    </div>
  )
}

function MobileNav({ pathname }: { pathname: string }) {
  const { t } = useLanguage()
  const items = [
    { href: "/",             label: t.nav.home },
    { href: "/zettadash",   label: t.nav.zettadash },
    { href: "/zettascan",   label: t.nav.zettascan },
    { href: "/zettaguard",  label: t.nav.zettaguard },
    { href: "/devops",      label: t.nav.devops },
    { href: "/configuracoes", label: t.nav.connections },
  ]
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border bg-background px-3 py-2 md:hidden">
      {items.map((i) => {
        const active = pathname === i.href
        return (
          <Link
            key={i.href}
            href={i.href}
            className={
              "px-3 py-1 text-xs font-bold whitespace-nowrap transition-all " +
              (active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {i.label}
          </Link>
        )
      })}
    </nav>
  )
}
