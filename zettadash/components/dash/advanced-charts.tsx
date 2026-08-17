"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  AreaChart,
  Area,
} from "recharts"
import {
  loadConsolidatedScanResult,
  getActiveRepoUrl,
  getSavedRepositories,
  type ScanResponse,
} from "@/lib/zettascan-api"
import { useLanguage } from "@/lib/language-provider"
import {
  BarChart3,
  PieChart as PieIcon,
  LineChart as AreaIcon,
  ArrowRight,
  Sparkles,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

type ChartType = "bar" | "donut" | "area"
type Dimension = "severity" | "category" | "repo"

interface ItemData {
  label: string
  count: number
  fill: string
  percent?: number
  sub?: string
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const data = item.payload as ItemData

  return (
    <div className="border border-border bg-card p-3 rounded-xl text-xs shadow-2xl text-card-foreground space-y-1">
      <div className="flex items-center gap-2 mb-1">
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: data.fill }} />
        <p className="font-bold text-foreground uppercase tracking-wider">{data.label}</p>
      </div>
      <div className="flex items-center justify-between gap-4 text-muted-foreground text-[11px]">
        <span>Achados:</span>
        <span className="font-mono font-bold text-foreground text-xs">{data.count}</span>
      </div>
      {data.percent !== undefined && (
        <div className="flex items-center justify-between gap-4 text-muted-foreground text-[11px]">
          <span>Proporção:</span>
          <span className="font-mono font-bold text-primary text-xs">{data.percent}%</span>
        </div>
      )}
      {data.sub && (
        <p className="text-[10px] text-muted-foreground mt-1 border-t border-border/50 pt-1">
          {data.sub}
        </p>
      )}
    </div>
  )
}

export function AdvancedCharts() {
  const { t } = useLanguage()
  const [chartType, setChartType] = useState<ChartType>("bar")
  const [dimension, setDimension] = useState<Dimension>("severity")
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null)
  const [reposList, setReposList] = useState<ScanResponse[]>([])
  const [activeRepo, setActiveRepo] = useState<string | null>(null)

  const refresh = useCallback(() => {
    const activeUrl = getActiveRepoUrl()
    const result = loadConsolidatedScanResult(activeUrl)
    const all = getSavedRepositories()
    setActiveRepo(activeUrl)
    setReposList(all)
    setScanResult(result)
  }, [])

  useEffect(() => {
    refresh()
    const handler = () => refresh()
    window.addEventListener("zettascan:repo_change", handler)
    return () => window.removeEventListener("zettascan:repo_change", handler)
  }, [refresh])

  // 1. Dados por Severidade
  const severityData = useMemo<ItemData[]>(() => {
    if (!scanResult) return []
    const total = scanResult.total_vulnerabilidades || 1
    return [
      {
        label: t.scan.critical,
        count: scanResult.criticas,
        fill: "#f43f5e",
        percent: Math.round((scanResult.criticas / total) * 100),
      },
      {
        label: t.scan.high,
        count: scanResult.altas,
        fill: "#f59e0b",
        percent: Math.round((scanResult.altas / total) * 100),
      },
      {
        label: t.scan.medium,
        count: scanResult.medias,
        fill: "#818cf8",
        percent: Math.round((scanResult.medias / total) * 100),
      },
      {
        label: t.scan.low,
        count: scanResult.baixas,
        fill: "#38bdf8",
        percent: Math.round((scanResult.baixas / total) * 100),
      },
    ]
  }, [scanResult, t])

  // 2. Dados por Categoria / Tipo de Vulnerabilidade
  const categoryData = useMemo<ItemData[]>(() => {
    if (!scanResult || !scanResult.vulnerabilidades) return []

    const countsMap: Record<string, { count: number; maxSev: string }> = {}

    scanResult.vulnerabilidades.forEach((v) => {
      let cat = v.titulo.trim()
      if (cat.length > 22) cat = cat.slice(0, 20) + "…"
      if (!countsMap[cat]) {
        countsMap[cat] = { count: 0, maxSev: v.severidade }
      }
      countsMap[cat].count += 1
    })

    const total = scanResult.total_vulnerabilidades || 1
    const colorPalette = [
      "#f43f5e",
      "#f59e0b",
      "#38bdf8",
      "#a855f7",
      "#10b981",
      "#6366f1",
      "#ec4899",
      "#94a3b8",
    ]

    return Object.entries(countsMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 6)
      .map(([label, info], i) => ({
        label,
        count: info.count,
        fill: colorPalette[i % colorPalette.length],
        percent: Math.round((info.count / total) * 100),
      }))
  }, [scanResult])

  // 3. Dados por Repositório (Comparativo Multi-Repo Limpo)
  const repoComparisonData = useMemo<ItemData[]>(() => {
    if (reposList.length === 0) return []
    const totalAll = reposList.reduce((acc, r) => acc + r.total_vulnerabilidades, 0) || 1
    const colorPalette = ["#38bdf8", "#a855f7", "#10b981", "#f59e0b", "#6366f1", "#f43f5e"]

    return reposList.map((r, i) => {
      let name = r.repositorio.split("/").pop() || r.repositorio
      name = name.replace(/\.git$/i, "")
      return {
        label: name,
        count: r.total_vulnerabilidades,
        fill: colorPalette[i % colorPalette.length],
        percent: Math.round((r.total_vulnerabilidades / totalAll) * 100),
        sub: `${r.criticas} críticas · ${r.altas} altas`,
      }
    })
  }, [reposList])

  const currentChartData =
    dimension === "severity"
      ? severityData
      : dimension === "category"
      ? categoryData
      : repoComparisonData

  const [hoveredSlice, setHoveredSlice] = useState<ItemData | null>(null)

  const totalSum = useMemo(() => {
    return currentChartData.reduce((acc, d) => acc + d.count, 0)
  }, [currentChartData])

  if (!scanResult) {
    return (
      <div className="saas-card p-5 space-y-4 h-full flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-foreground">
            {t.dash.chartAnalytics}
          </h2>
        </div>
        <div className="flex flex-1 min-h-[320px] flex-col items-center justify-center gap-2 border border-dashed border-border bg-muted/20 rounded-xl">
          <BarChart3 className="h-8 w-8 text-muted-foreground/30" />
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
      </div>
    )
  }

  const isMultiRepo = reposList.length > 1

  return (
    <div className="saas-card p-5 space-y-4 h-full flex flex-col justify-between">
      {/* Header Toolbar: Controles de Personalização */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
        <div>
          <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {t.dash.chartAnalytics}
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {dimension === "severity" && t.dash.severityDistribution}
            {dimension === "category" && t.dash.dimCategory}
            {dimension === "repo" && t.dash.dimRepo}
          </p>
        </div>

        {/* Controles de Dimensão & Formato de Gráfico (Opção menor em cima da maior) */}
        <div className="flex flex-col sm:items-end gap-1.5">
          {/* Seletor de Tipo de Gráfico (Opção Menor - EM CIMA) */}
          <div className="flex items-center border border-border bg-muted/40 p-0.5 rounded-lg self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setChartType("bar")}
              className={cn(
                "p-1 text-xs transition-all rounded",
                chartType === "bar"
                  ? "bg-card text-primary shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title={t.dash.typeBar}
              aria-label={t.dash.typeBar}
            >
              <BarChart3 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setChartType("donut")}
              className={cn(
                "p-1 text-xs transition-all rounded",
                chartType === "donut"
                  ? "bg-card text-primary shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title={t.dash.typeDonut}
              aria-label={t.dash.typeDonut}
            >
              <PieIcon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setChartType("area")}
              className={cn(
                "p-1 text-xs transition-all rounded",
                chartType === "area"
                  ? "bg-card text-primary shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title={t.dash.typeArea}
              aria-label={t.dash.typeArea}
            >
              <AreaIcon className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Tabs de Dimensão (Opção Maior - EMBAIXO) */}
          <div className="flex items-center border border-border bg-muted/40 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => setDimension("severity")}
              className={cn(
                "px-2.5 py-1 text-[11px] font-bold transition-all rounded",
                dimension === "severity"
                  ? "bg-card text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.dash.dimSeverity}
            </button>
            <button
              type="button"
              onClick={() => setDimension("category")}
              className={cn(
                "px-2.5 py-1 text-[11px] font-bold transition-all rounded",
                dimension === "category"
                  ? "bg-card text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.dash.dimCategory}
            </button>
            {isMultiRepo && (
              <button
                type="button"
                onClick={() => setDimension("repo")}
                className={cn(
                  "px-2.5 py-1 text-[11px] font-bold transition-all rounded",
                  dimension === "repo"
                    ? "bg-card text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.dash.dimRepo}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Renderização do Gráfico Selecionado */}
      <div className="relative flex-1 min-h-[360px] sm:min-h-[400px] w-full pt-2 flex items-center justify-center">
        {/* Overlay Central no modo Donut (HUD Dinâmico no Hover) */}
        {chartType === "donut" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 text-center px-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate max-w-[160px]">
              {hoveredSlice ? hoveredSlice.label : "Total"}
            </span>
            <span
              className="font-heading text-3xl font-black transition-all duration-150"
              style={{ color: hoveredSlice ? hoveredSlice.fill : "var(--foreground)" }}
            >
              {hoveredSlice ? hoveredSlice.count : totalSum}
            </span>
            <span className="text-[10px] font-mono font-bold text-primary">
              {hoveredSlice
                ? `${hoveredSlice.percent ?? 0}% do total`
                : dimension === "severity"
                ? "Vulnerabilidades"
                : dimension === "category"
                ? "Categorias"
                : "Achados"}
            </span>
          </div>
        )}

        <ResponsiveContainer width="100%" height="100%">
          {chartType === "bar" ? (
            <BarChart
              data={currentChartData}
              margin={{ top: 12, right: 12, left: -20, bottom: 0 }}
              barSize={dimension === "severity" ? 48 : 36}
            >
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
              <Bar dataKey="count" radius={[6, 6, 0, 0]} isAnimationActive={true} animationDuration={600}>
                {currentChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          ) : chartType === "donut" ? (
            <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Pie
                data={currentChartData}
                dataKey="count"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={80}
                outerRadius={130}
                paddingAngle={4}
                isAnimationActive={true}
                animationDuration={600}
                onMouseEnter={(_, idx) => setHoveredSlice(currentChartData[idx])}
                onMouseLeave={() => setHoveredSlice(null)}
              >
                {currentChartData.map((entry, index) => (
                  <Cell
                    key={`donut-${index}`}
                    fill={entry.fill}
                    stroke="transparent"
                    className="cursor-pointer transition-opacity hover:opacity-80"
                  />
                ))}
              </Pie>
            </PieChart>
          ) : (
            <AreaChart data={currentChartData} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.0} />
                </linearGradient>
              </defs>
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
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="var(--primary)"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#areaGrad)"
                isAnimationActive={true}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Legenda & Detalhes Interativos Formatados em Grid Moderno */}
      <div className="pt-3 border-t border-border/60">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {currentChartData.map((d) => (
            <div
              key={d.label}
              className="p-2 rounded-lg bg-muted/20 border border-border/60 flex items-center justify-between gap-2 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.fill }} />
                <span className="font-bold text-foreground truncate text-xs">{d.label}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 font-mono">
                <span className="font-bold text-foreground">{d.count}</span>
                {d.percent !== undefined && (
                  <span className="text-muted-foreground text-[10px]">({d.percent}%)</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
