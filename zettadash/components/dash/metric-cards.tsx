"use client"

import { useEffect, useState, useCallback } from "react"
import { ShieldAlert, AlertTriangle, Layers, ArrowRight, GitBranch } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/language-provider"
import {
  loadConsolidatedScanResult,
  getActiveRepoUrl,
  getSavedRepositories,
} from "@/lib/zettascan-api"
import Link from "next/link"

interface MetricData {
  label: string
  value: string | number
  sub: string
  icon: any
  color: string
  border: string
  fill: number
}

export function MetricCards() {
  const { t } = useLanguage()
  const [metrics, setMetrics] = useState<MetricData[] | null>(null)
  const [repoCount, setRepoCount] = useState(0)

  const refresh = useCallback(() => {
    const activeUrl = getActiveRepoUrl()
    const result = loadConsolidatedScanResult(activeUrl)
    const allRepos = getSavedRepositories()
    setRepoCount(allRepos.length)

    if (!result) {
      setMetrics(null)
      return
    }

    const total = result.total_vulnerabilidades || 1
    const isConsolidated = !activeUrl && allRepos.length > 1
    const repoLabel = isConsolidated
      ? t.dash.totalSubInRepos.replace("{count}", String(allRepos.length))
      : t.dash.totalSubInSingle.replace("{repo}", result.repositorio.split("/").pop() ?? "repository")

    setMetrics([
      {
        label: t.dash.criticalVulns,
        value: result.criticas,
        sub: t.dash.criticalSub.replace("{crit}", String(result.criticas)).replace("{total}", String(result.total_vulnerabilidades)),
        icon: ShieldAlert,
        color: "text-rose-500",
        border: "border-l-rose-500",
        fill: Math.min(100, (result.criticas / total) * 100),
      },
      {
        label: t.dash.highRisk,
        value: result.altas,
        sub: t.dash.highSub.replace("{high}", String(result.altas)),
        icon: AlertTriangle,
        color: "text-amber-500",
        border: "border-l-amber-500",
        fill: Math.min(100, (result.altas / total) * 100),
      },
      {
        label: t.dash.totalDetected,
        value: result.total_vulnerabilidades,
        sub: repoLabel,
        icon: isConsolidated ? Layers : GitBranch,
        color: "text-primary",
        border: "border-l-primary",
        fill: 100,
      },
    ])
  }, [t])

  useEffect(() => {
    refresh()
    const handler = () => refresh()
    window.addEventListener("zettascan:repo_change", handler)
    return () => window.removeEventListener("zettascan:repo_change", handler)
  }, [refresh])

  if (!metrics) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: t.dash.criticalVulns, icon: ShieldAlert, color: "text-rose-500" },
            { label: t.dash.highRisk, icon: AlertTriangle, color: "text-amber-500" },
            { label: t.dash.totalDetected, icon: Layers, color: "text-primary" },
          ].map((c) => {
            const Icon = c.icon
            return (
              <div key={c.label} className="saas-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{c.label}</span>
                  <Icon className={cn("h-4 w-4", c.color, "opacity-40")} />
                </div>
                <p className="font-heading text-3xl font-extrabold text-muted-foreground/30">—</p>
                <p className="text-[10px] text-muted-foreground/50 mt-1">{t.dash.waitingScan}</p>
              </div>
            )
          })}
        </div>
        <div className="saas-card p-4 border-dashed flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            {t.dash.noRepoWarning}
          </p>
          <Link
            href="/configuracoes"
            className="btn-electric px-3 py-1.5 text-xs font-bold shrink-0"
          >
            {t.dash.connectRepo} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {metrics.map((m) => {
        const Icon = m.icon
        return (
          <div
            key={m.label}
            className={cn(
              "saas-card p-5 border-l-[3px] space-y-3",
              m.border
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{m.label}</span>
              <Icon className={cn("h-4 w-4", m.color)} />
            </div>

            <div>
              <p className={cn("font-heading text-4xl font-extrabold tracking-tight", m.color)}>
                {m.value}
              </p>
              <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{m.sub}</p>
            </div>

            <div className="h-1 w-full bg-muted overflow-hidden">
              <div
                className={cn("h-full", m.border.replace("border-l-", "bg-"))}
                style={{ width: `${m.fill}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
