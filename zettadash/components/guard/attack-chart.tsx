"use client"

import { useEffect, useState, useCallback } from "react"
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { getGuardStats, GuardStats } from "@/lib/zettaguard-api"
import { useLanguage } from "@/lib/language-provider"
import { BarChart2, ShieldAlert } from "lucide-react"

const CATEGORY_NAMES: Record<string, { label: string; fill: string }> = {
  injection_direct: { label: "Prompt Injection", fill: "#f43f5e" },
  jailbreak: { label: "Jailbreak (DAN)", fill: "#f59e0b" },
  exfiltration: { label: "Exfiltração de Dados", fill: "#818cf8" },
  injection_indirect: { label: "Injeção Indireta", fill: "#ec4899" },
  data_leakage: { label: "Data Leakage", fill: "#ef4444" },
  none: { label: "Requisição Segura", fill: "#10b981" },
}

export function AttackChart() {
  const { t } = useLanguage()
  const [stats, setStats] = useState<GuardStats | null>(null)
  const [chartData, setChartData] = useState<any[]>([])

  const loadData = useCallback(async () => {
    const s = await getGuardStats()
    setStats(s)

    const formatted = Object.entries(s.by_category || {}).map(([key, count]) => {
      const info = CATEGORY_NAMES[key] || { label: key, fill: "#00e5ff" }
      return {
        key,
        name: info.label,
        count,
        fill: info.fill,
      }
    })

    setChartData(formatted)
  }, [])

  useEffect(() => {
    loadData()
    const handleUpdate = () => loadData()
    window.addEventListener("zettaguard:event_added", handleUpdate)
    return () => window.removeEventListener("zettaguard:event_added", handleUpdate)
  }, [loadData])

  return (
    <div className="saas-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div>
            <h2 className="font-heading text-sm font-bold text-foreground uppercase tracking-wider">
              {t.guard.threatTrafficPerHour}
            </h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">{t.guard.last24h}</p>
          </div>
        </div>

        {stats && stats.total > 0 && (
          <span className="text-[11px] font-mono font-bold text-foreground bg-muted px-2.5 py-1 rounded border border-border">
            {stats.bloqueados} bloqueios / {stats.total} total
          </span>
        )}
      </div>

      {chartData.length === 0 ? (
        <div className="flex h-56 flex-col items-center justify-center gap-2 border border-dashed border-border bg-muted/20 rounded-lg">
          <BarChart2 className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground/70 text-center">
            {t.guard.waitingWafData}
          </p>
        </div>
      ) : (
        <div className="h-56 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barSize={36}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
              <XAxis
                dataKey="name"
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
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const item = payload[0].payload
                  return (
                    <div className="border border-border bg-card px-3 py-2 text-xs shadow-xl text-card-foreground rounded">
                      <p className="font-bold text-foreground">{item.name}</p>
                      <p className="text-muted-foreground mt-1">
                        Total interceptado: <span className="font-bold text-foreground">{item.count}</span>
                      </p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="count" isAnimationActive={true} animationDuration={500}>
                {chartData.map((entry, index) => (
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
