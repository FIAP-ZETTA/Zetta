"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { Bell, Search } from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"

const titles: Record<string, { title: string; sub: string }> = {
  "/": { title: "ZettaDash", sub: "Painel de monitoramento de segurança em tempo real" },
  "/zettascan": { title: "ZettaScan", sub: "Vulnerabilidades detectadas na análise de código" },
  "/zettaguard": { title: "ZettaGuard", sub: "Histórico e detecção de ataques" },
  "/devops": { title: "DevOps", sub: "Status dos serviços e infraestrutura Docker" },
  "/configuracoes": { title: "Configurações", sub: "Conecte repositórios e inicie varreduras" },
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const meta = titles[pathname] ?? titles["/"]

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="flex items-center gap-2 md:hidden">
              <Image src="/zetta-guard-logo.png" alt="Zetta Guard" width={24} height={24} />
              <span className="font-heading text-sm font-bold">Zetta Guard</span>
            </Link>
            <div className="hidden min-w-0 md:block">
              <h1 className="font-heading text-lg font-semibold leading-none text-foreground text-pretty">
                {meta.title}
              </h1>
              <p className="mt-1 truncate text-xs text-muted-foreground">{meta.sub}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground lg:flex">
              <Search className="h-4 w-4" aria-hidden="true" />
              <input
                placeholder="Buscar ativos, IPs..."
                className="w-40 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
            <button
              type="button"
              className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Notificações"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-destructive" />
            </button>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-xs font-bold text-primary ring-1 ring-primary/30">
              ZG
            </div>
          </div>
        </header>

        {/* Mobile nav */}
        <MobileNav pathname={pathname} />

        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  )
}

function MobileNav({ pathname }: { pathname: string }) {
  const items = [
    { href: "/", label: "Dash" },
    { href: "/zettascan", label: "Scan" },
    { href: "/zettaguard", label: "Guard" },
    { href: "/devops", label: "DevOps" },
    { href: "/configuracoes", label: "Config" },
  ]
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border bg-card/50 px-3 py-2 md:hidden">
      {items.map((i) => {
        const active = pathname === i.href
        return (
          <Link
            key={i.href}
            href={i.href}
            className={
              "rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap " +
              (active ? "bg-primary/15 text-primary" : "text-muted-foreground")
            }
          >
            {i.label}
          </Link>
        )
      })}
    </nav>
  )
}
