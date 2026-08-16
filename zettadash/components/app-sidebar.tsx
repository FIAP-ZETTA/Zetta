"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { LayoutDashboard, ScanLine, ShieldCheck, Settings, Container } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "ZettaDash", icon: LayoutDashboard, desc: "Visão geral" },
  { href: "/zettascan", label: "ZettaScan", icon: ScanLine, desc: "Vulnerabilidades" },
  { href: "/zettaguard", label: "ZettaGuard", icon: ShieldCheck, desc: "Ataques" },
  { href: "/devops", label: "DevOps", icon: Container, desc: "Status dos serviços" },
  { href: "/configuracoes", label: "Conexões", icon: Settings, desc: "Tokens e Acesso" },
]

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-sidebar-border">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-lg ring-1 ring-primary/30 overflow-hidden bg-black">
          <Image
            src="/zetta-guard-logo.jpeg"
            alt="Logo ZettaGuard"
            width={36}
            height={36}
            className="h-full w-full object-cover scale-150"
          />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-heading text-sm font-bold tracking-tight text-sidebar-foreground">
            ZettaGuard
          </span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            CYBER INTELLIGENCE
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 p-3">
        <p className="px-3 pb-2 pt-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Navegação
        </p>
        {navItems.map((item) => {
          const active = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground ring-1 ring-primary/30"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <Icon
                className={cn("h-4.5 w-4.5 shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-sidebar-foreground")}
                aria-hidden="true"
              />
              <div className="flex flex-col">
                <span className="font-medium leading-none">{item.label}</span>
                <span className="text-[11px] text-muted-foreground">{item.desc}</span>
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Status footer */}
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 rounded-lg bg-sidebar-accent/50 px-3 py-2.5">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-xs font-medium text-sidebar-foreground">Proteção ativa</span>
            <span className="text-[11px] text-muted-foreground">Todos os sistemas online</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
