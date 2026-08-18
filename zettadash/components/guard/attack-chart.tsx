"use client"

import { useEffect, useState, useCallback } from "react"
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { getGuardStats, GuardStats } from "@/lib/zettaguard-api"
import { useLanguage } from "@/lib/language-provider"

const CATEGORY_CONFIG: Record<string, { labelPt: string; labelEn: string; fill: string }> = {
  injection_direct: { labelPt: "Prompt Injection", labelEn: "Prompt Injection", fill: "#f43f5e" },
  jailbreak: { labelPt: "Jailbreak", labelEn: "Jailbreak", fill: "#f59e0b" },
  exfiltration: { labelPt: "Exfiltração", labelEn: "Exfiltration", fill: "#a855f7" },
  injection_indirect: { labelPt: "Injeção Indireta", labelEn: "Indirect Injection", fill: "#ec4899" },
  data_leakage: { labelPt: "Vazamento de Saída", labelEn: "Output Leakage", fill: "#3b82f6" },
  none: { labelPt: "Seguro", labelEn: "Safe", fill: "#10b981" },
}

export function AttackChart() {
  const { t, lang } = useLanguage()
  const [stats, setStats] = useState<GuardStats | null>(null)
  const [chartData, setChartData] = useState<any[]>([])

  const loadData = useCallback(async () => {
    const s = await getGuardStats()
    setStats(s)

    const formatted = Object.entries(s.by_category || {}).map(([key, count]) => {
      const config = CATEGORY_CONFIG[key] || { labelPt: key, labelEn: key, fill: "var(--primary)" }
      return {
        key,
        name: lang === "en" ? config.labelEn : config.labelPt,
        count,
        fill: config.fill,
      }
    })

    setChartData(formatted)
  }, [lang])

  useEffect(() => {
    loadData()
    const handleUpdate = () => loadData()
    window.addEventListener("zettaguard:event_added", handleUpdate)
    return () => window.removeEventListener("zettaguard:event_added", handleUpdate)
  }, [loadData])

  return (
    <div className="saas-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-sm font-bold text-foreground uppercase tracking-wider">
            {t.guard.threatTrafficPerHour}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t.guard.last24h}
          </p>
        </div>

        {stats && stats.total > 0 && (
          <span className="text-[10px] font-mono font-bold text-primary px-2 py-0.5 rounded border border-primary/30 bg-primary/10">
            {lang === "en"
              ? `${stats.bloqueados} blocked / ${stats.total} total`
              : `${stats.bloqueados} bloqueados / ${stats.total} total`}
          </span>
        )}
      </div>

      {chartData.length === 0 ? (
        <div className="flex h-52 flex-col items-center justify-center gap-1 border border-dashed border-border bg-card/20 rounded">
          <p className="text-xs text-muted-foreground">
            {t.guard.waitingWafData}
          </p>
        </div>
      ) : (
        <div className="h-52 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barSize={32}>
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
                    <div className="border border-border bg-card px-3 py-2 text-xs shadow-xl text-card-foreground">
                      <p className="font-bold text-foreground">{item.name}</p>
                      <p className="text-muted-foreground mt-0.5 font-mono">
                        Total: <span className="font-bold" style={{ color: item.fill }}>{item.count}</span>
                      </p>
                    </div>
                  )
                }}
              />
              <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} className="hover:opacity-80 transition-opacity" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
