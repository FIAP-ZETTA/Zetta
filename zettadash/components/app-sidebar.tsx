"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, LayoutDashboard, ScanLine, ShieldCheck, Settings, Container } from "lucide-react"
import { useLanguage } from "@/lib/language-provider"
import { cn } from "@/lib/utils"

export function AppSidebar() {
  const pathname = usePathname()
  const { t } = useLanguage()

  const navItems = [
    { href: "/",             label: t.nav.home,        icon: Home,            desc: t.nav.homeDesc },
    { href: "/zettadash",   label: t.nav.zettadash,   icon: LayoutDashboard, desc: t.nav.zettadashDesc },
    { href: "/zettascan",   label: t.nav.zettascan,   icon: ScanLine,        desc: t.nav.zettascanDesc },
    { href: "/zettaguard",  label: t.nav.zettaguard,  icon: ShieldCheck,     desc: t.nav.zettaguardDesc },
    { href: "/devops",      label: t.nav.devops,      icon: Container,       desc: t.nav.devopsDesc },
    { href: "/configuracoes", label: t.nav.connections, icon: Settings,        desc: t.nav.connectionsDesc },
  ]

  return (
    <aside className="hidden md:flex w-80 shrink-0 flex-col border-r border-border bg-sidebar sticky top-0 h-screen overflow-y-auto">
      {/* Nav */}
      <nav className="flex-1 space-y-2 p-5 pt-7">
        <p className="px-3.5 pb-3 text-xs font-extrabold uppercase tracking-wider">
          <span className="text-foreground">{t.nav.modules}</span>{" "}
          <span className="text-primary">{t.nav.brand}</span>
        </p>
        {navItems.map((item) => {
          const active = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-4 px-4 py-3.5 text-base transition-all border rounded-xl",
                active
                  ? "bg-white/[0.08] dark:bg-white/[0.08] light:bg-black/[0.05] text-foreground border-border font-bold shadow-sm"
                  : "border-transparent text-muted-foreground hover:bg-white/[0.04] dark:hover:bg-white/[0.04] light:hover:bg-black/[0.03] hover:text-foreground",
              )}
            >
              {/* Marcador lateral ativo */}
              {active && (
                <span
                  className="absolute left-0 top-2 bottom-2 w-1.5 rounded-r-full bg-primary shadow-[0_0_12px_var(--primary-glow)]"
                />
              )}

              <div className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-all",
                active
                  ? "bg-primary text-primary-foreground font-bold shadow-[0_0_15px_var(--primary-glow)]"
                  : "bg-muted/70 text-muted-foreground group-hover:text-foreground border border-border/50"
              )}>
                <Icon className="h-5.5 w-5.5 shrink-0" aria-hidden="true" />
              </div>

              <div className="flex flex-col min-w-0">
                <span className={cn("leading-tight text-[15px] text-foreground", active ? "font-bold" : "font-semibold")}>
                  {item.label}
                </span>
                <span className="text-xs text-muted-foreground mt-0.5 truncate">{item.desc}</span>
              </div>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
