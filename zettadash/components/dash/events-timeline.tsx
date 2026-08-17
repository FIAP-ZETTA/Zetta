"use client"

import { useEffect, useState, useCallback } from "react"
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import {
  loadConsolidatedScanResult,
  getActiveRepoUrl,
  getSavedRepositories,
} from "@/lib/zettascan-api"
import { useLanguage } from "@/lib/language-provider"
import { BarChart2, ArrowRight } from "lucide-react"
import Link from "next/link"

interface ChartData {
  label: string
  count: number
  fill: string
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="border border-border bg-card px-3 py-2 text-xs shadow-xl text-card-foreground">
      <p className="mb-1 font-bold text-foreground uppercase">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-muted-foreground">
          <span className="h-2 w-2" style={{ background: p.fill }} />
          <span className="font-bold text-foreground">{p.value}</span> findings
        </p>
      ))}
    </div>
  )
}

export function EventsTimeline() {
  const { t } = useLanguage()
  const [data, setData] = useState<ChartData[] | null>(null)
  const [scopeLabel, setScopeLabel] = useState("")

  const refresh = useCallback(() => {
    const activeUrl = getActiveRepoUrl()
    const result = loadConsolidatedScanResult(activeUrl)
    const allRepos = getSavedRepositories()

    if (!result) {
      setData(null)
      return
    }

    if (!activeUrl && allRepos.length > 1) {
      setScopeLabel(`${t.repoSelector.consolidated} — ${allRepos.length} ${t.repoSelector.connectedRepos}`)
    } else {
      setScopeLabel(`${t.repoSelector.label} ${result.repositorio.split("/").pop() ?? result.repositorio}`)
    }

    setData([
      { label: t.scan.critical, count: result.criticas, fill: "#f43f5e" },
      { label: t.scan.high,     count: result.altas,    fill: "#f59e0b" },
      { label: t.scan.medium,   count: result.medias,   fill: "#818cf8" },
      { label: t.scan.low,      count: result.baixas,   fill: "#00e5ff" },
    ])
  }, [t])

  useEffect(() => {
    refresh()
    const handler = () => refresh()
    window.addEventListener("zettascan:repo_change", handler)
    return () => window.removeEventListener("zettascan:repo_change", handler)
  }, [refresh])

  return (
    <div className="saas-card p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-foreground">
            {t.dash.severityDistribution}
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {data ? scopeLabel : t.dash.waitingAuditData}
          </p>
        </div>
        {data && (
          <div className="flex items-center gap-3 text-[11px]">
            {[
              { label: t.scan.critical, color: "bg-rose-500" },
              { label: t.scan.high,     color: "bg-amber-500" },
              { label: t.scan.medium,   color: "bg-indigo-500" },
              { label: t.scan.low,      color: "bg-primary" },
            ].map(l => (
              <span key={l.label} className="flex items-center gap-1.5 text-muted-foreground">
                <span className={`h-2 w-2 ${l.color}`} />
                {l.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {!data ? (
        <div className="flex h-60 flex-col items-center justify-center gap-2 border border-dashed border-border bg-muted/20">
          <BarChart2 className="h-8 w-8 text-muted-foreground/30" />
          <div className="text-center">
            <p className="text-xs text-muted-foreground">{t.dash.waitingAuditData}</p>
            <Link
              href="/configuracoes"
              className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline font-bold"
            >
              {t.dash.connectRepo} <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="h-60 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barSize={44}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
              <XAxis
                dataKey="label"
                stroke="#64748b"
                tickLine={false}
                axisLine={false}
                fontSize={11}
              />
              <YAxis
                stroke="#64748b"
                tickLine={false}
                axisLine={false}
                fontSize={11}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255, 255, 255, 0.03)" }} />
              <Bar
                dataKey="count"
                isAnimationActive={true}
                animationDuration={600}
              >
                {data!.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
