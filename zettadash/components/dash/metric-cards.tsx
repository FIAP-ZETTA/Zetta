"use client"

import { useEffect, useState, useCallback } from "react"
import { ShieldAlert, AlertTriangle, Layers, ArrowRight, GitBranch, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/language-provider"
import {
  loadConsolidatedScanResult,
  getActiveRepoUrl,
  getSavedRepositories,
} from "@/lib/zettascan-api"

interface MetricData {
  id: string
  label: string
  value: string | number
  sub: string
  icon: any
  color: string
  border: string
  barBg: string
  fill: number
}

export function MetricCards({
  layout = "grid-2x2"
}: {
  layout?: "grid-2x2" | "grid-4" | "horizontal" | "vertical"
}) {
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

    const mediasEBaixas = (result.medias || 0) + (result.baixas || 0)

    // Ordem exata:
    // Top-Left: Total | Top-Right: Altas
    // Bottom-Left: Críticas | Bottom-Right: Médias
    const items: MetricData[] = [
      {
        id: "total",
        label: t.dash.totalDetected,
        value: result.total_vulnerabilidades,
        sub: repoLabel,
        icon: isConsolidated ? Layers : GitBranch,
        color: "text-primary",
        border: "border-l-primary",
        barBg: "bg-primary",
        fill: 100,
      },
      {
        id: "high",
        label: t.dash.highRisk,
        value: result.altas,
        sub: t.dash.highSub.replace("{high}", String(result.altas)),
        icon: AlertTriangle,
        color: "text-amber-500",
        border: "border-l-amber-500",
        barBg: "bg-amber-500",
        fill: Math.max(12, Math.min(100, (result.altas / total) * 100)),
      },
      {
        id: "critical",
        label: t.dash.criticalVulns,
        value: result.criticas,
        sub: t.dash.criticalSub.replace("{crit}", String(result.criticas)).replace("{total}", String(result.total_vulnerabilidades)),
        icon: ShieldAlert,
        color: "text-rose-500",
        border: "border-l-rose-500",
        barBg: "bg-rose-500",
        fill: Math.max(12, Math.min(100, (result.criticas / total) * 100)),
      },
      {
        id: "medium",
        label: "MÉDIAS & BAIXAS",
        value: mediasEBaixas,
        sub: `${result.medias || 0} médias · ${result.baixas || 0} baixas`,
        icon: Zap,
        color: "text-purple-400",
        border: "border-l-purple-500",
        barBg: "bg-purple-500",
        fill: Math.max(15, Math.min(100, (mediasEBaixas / total) * 100)),
      },
    ]

    setMetrics(items)
  }, [t])

  useEffect(() => {
    refresh()
    const handler = () => refresh()
    window.addEventListener("zettascan:repo_change", handler)
    return () => window.removeEventListener("zettascan:repo_change", handler)
  }, [refresh])

  if (!metrics) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 h-full">
        {[
          { label: t.dash.totalDetected, icon: Layers, color: "text-primary", border: "border-l-primary/30" },
          { label: t.dash.highRisk, icon: AlertTriangle, color: "text-amber-500", border: "border-l-amber-500/30" },
          { label: t.dash.criticalVulns, icon: ShieldAlert, color: "text-rose-500", border: "border-l-rose-500/30" },
          { label: "MÉDIAS & BAIXAS", icon: Zap, color: "text-purple-400", border: "border-l-purple-500/30" },
        ].map((c) => {
          const Icon = c.icon
          return (
            <div
              key={c.label}
              className={cn(
                "saas-card p-4 sm:p-5 border-l-[3px] space-y-2.5 flex flex-col justify-between",
                c.border
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{c.label}</span>
                <Icon className={cn("h-4 w-4", c.color, "opacity-40")} />
              </div>

              <div>
                <p className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight text-muted-foreground/30">—</p>
                <p className="text-[10px] text-muted-foreground/50 mt-0.5">{t.dash.waitingScan}</p>
              </div>

              <div className="h-1 w-full bg-muted/60 overflow-hidden rounded-full">
                <div className="h-full bg-muted-foreground/10 w-0" />
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 h-full">
      {metrics.map((m) => {
        const Icon = m.icon
        return (
          <div
            key={m.id}
            className={cn(
              "saas-card p-4 sm:p-5 border-l-[3px] space-y-2.5 flex flex-col justify-between",
              m.border
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{m.label}</span>
              <Icon className={cn("h-4 w-4", m.color)} />
            </div>

            <div>
              <p className={cn("font-heading text-3xl sm:text-4xl font-extrabold tracking-tight", m.color)}>
                {m.value}
              </p>
              <p className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate">{m.sub}</p>
            </div>

            <div className="h-1 w-full bg-muted/60 overflow-hidden rounded-full">
              <div
                className={cn("h-full rounded-full transition-all duration-500", m.barBg)}
                style={{ width: `${m.fill}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
