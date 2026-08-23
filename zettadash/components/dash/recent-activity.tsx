"use client"

import { useEffect, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import {
  loadConsolidatedScanResult,
  getActiveRepoUrl,
  type Vulnerabilidade,
} from "@/lib/zettascan-api"
import { useLanguage } from "@/lib/language-provider"
import { FileCode2, ShieldOff, ArrowRight, GitBranch } from "lucide-react"
import Link from "next/link"

const levelStyles: Record<string, string> = {
  CRITICAL: "bg-rose-500",
  HIGH:     "bg-amber-500",
  MEDIUM:   "bg-indigo-500",
  LOW:      "bg-primary",
}

export function RecentActivity() {
  const { t } = useLanguage()
  const [items, setItems] = useState<Vulnerabilidade[] | null>(null)
  const [total, setTotal] = useState(0)

  const levelLabels: Record<string, string> = {
    CRITICAL: t.scan.critical,
    HIGH:     t.scan.high,
    MEDIUM:   t.scan.medium,
    LOW:      t.scan.low,
  }

  const refresh = useCallback(() => {
    const activeUrl = getActiveRepoUrl()
    const result = loadConsolidatedScanResult(activeUrl)
    if (!result) {
      setItems(null)
      return
    }
    const sorted = [...result.vulnerabilidades].sort((a, b) => {
      const order: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }
      return (order[a.severidade] ?? 9) - (order[b.severidade] ?? 9)
    })
    setItems(sorted.slice(0, 6))
    setTotal(result.total_vulnerabilidades)
  }, [])

  useEffect(() => {
    refresh()
    const handler = () => refresh()
    window.addEventListener("zettascan:repo_change", handler)
    return () => window.removeEventListener("zettascan:repo_change", handler)
  }, [refresh])

  return (
    <div className="saas-card p-4 sm:p-5 space-y-3.5 h-full flex flex-col justify-between">
      <div className="flex items-start justify-between gap-2 border-b border-border pb-3">
        <div>
          <h2 className="font-heading text-xs font-bold uppercase tracking-wider text-foreground">{t.dash.topCritical}</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {items ? t.dash.totalFindingsRecorded.replace("{total}", String(total)) : t.dash.noScanExecuted}
          </p>
        </div>
        {items && (
          <Link
            href="/zettascan"
            className="text-[11px] text-primary hover:underline font-bold inline-flex items-center gap-1 shrink-0"
          >
            {t.dash.viewAll} <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      {!items ? (
        <div className="flex flex-1 min-h-[220px] flex-col items-center justify-center py-6 gap-2 text-center border border-dashed border-border bg-muted/20 rounded-xl">
          <ShieldOff className="h-7 w-7 text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground max-w-xs">
            {t.dash.runScanToView}
          </p>
          <Link
            href="/configuracoes"
            className="text-xs text-primary hover:underline font-bold inline-flex items-center gap-1 mt-1"
          >
            {t.dash.connectRepo} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ) : (
        <ul className="space-y-1 divide-y divide-border/50">
          {items.map((e, i) => {
            const repoTag = e.repositorio ? e.repositorio.split("/").slice(-2).join("/") : null
            return (
              <li
                key={i}
                className="flex gap-2.5 pt-2.5 first:pt-0"
              >
                <div className="mt-1 flex shrink-0">
                  <span className={cn(
                    "h-2 w-2 shrink-0",
                    levelStyles[e.severidade] ?? "bg-muted-foreground"
                  )} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-mono text-foreground/90 truncate flex items-center gap-1.5 min-w-0">
                      <FileCode2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="truncate">{e.arquivo}</span>
                    </p>
                    {repoTag && (
                      <span className="text-[9px] font-mono text-primary bg-primary/10 border border-primary/20 px-1 py-0.2 shrink-0">
                        {repoTag}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">{e.titulo}</p>
                  <p className="text-[10px] font-mono text-muted-foreground/70 mt-0.5">
                    L{e.linha} · <span className={cn(
                      "font-bold",
                      e.severidade === "CRITICAL" ? "text-rose-500" :
                      e.severidade === "HIGH" ? "text-amber-500" :
                      "text-muted-foreground"
                    )}>{levelLabels[e.severidade] ?? e.severidade}</span>
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
