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
  type Vulnerabilidade,
} from "@/lib/zettascan-api"
import { useLanguage } from "@/lib/language-provider"
import {
  BarChart3,
  PieChart as PieIcon,
  LineChart as AreaIcon,
  ShieldAlert,
  ArrowRight,
  Layers,
  Sparkles,
  GitBranch,
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

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const data = item.payload as ItemData

  return (
    <div className="border border-border bg-card p-3 text-xs shadow-2xl text-card-foreground">
      <div className="flex items-center gap-2 mb-1">
        <span className="h-2.5 w-2.5 shrink-0" style={{ background: data.fill }} />
        <p className="font-bold text-foreground uppercase tracking-wider">{data.label}</p>
      </div>
      <div className="flex items-center justify-between gap-4 text-muted-foreground mt-1 text-[11px]">
        <span>Achados / Findings:</span>
        <span className="font-mono font-bold text-foreground text-xs">{data.count}</span>
      </div>
      {data.percent !== undefined && (
        <div className="flex items-center justify-between gap-4 text-muted-foreground mt-0.5 text-[11px]">
          <span>Proporção / Share:</span>
          <span className="font-mono font-bold text-primary text-xs">{data.percent}%</span>
        </div>
      )}
      {data.sub && (
        <p className="text-[10px] text-muted-foreground/70 mt-1 border-t border-border/50 pt-1">
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
        fill: "#00e5ff",
        percent: Math.round((scanResult.baixas / total) * 100),
      },
    ]
  }, [scanResult, t])

  // 2. Dados por Categorias OWASP / Vetores de Falha
  const categoryData = useMemo<ItemData[]>(() => {
    if (!scanResult || scanResult.vulnerabilidades.length === 0) return []
    const countsMap: Record<string, { count: number; maxSev: string }> = {}

    scanResult.vulnerabilidades.forEach((v) => {
      // Normalização amigável da categoria
      let cat = v.titulo.trim()
      if (cat.length > 25) cat = cat.slice(0, 24) + "…"
      if (!countsMap[cat]) {
        countsMap[cat] = { count: 0, maxSev: v.severidade }
      }
      countsMap[cat].count += 1
    })

    const total = scanResult.total_vulnerabilidades || 1
    const colorPalette = [
      "#f43f5e",
      "#f59e0b",
      "#00e5ff",
      "#a855f7",
      "#10b981",
      "#3b82f6",
      "#fb7185",
      "#e2e8f0",
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

  // 3. Dados por Repositório (Comparativo Multi-Repo)
  const repoComparisonData = useMemo<ItemData[]>(() => {
    if (reposList.length === 0) return []
    const totalAll = reposList.reduce((acc, r) => acc + r.total_vulnerabilidades, 0) || 1
    const colorPalette = ["#00e5ff", "#a855f7", "#10b981", "#f59e0b", "#3b82f6", "#f43f5e"]

    return reposList.map((r, i) => {
      const name = r.repositorio.split("/").slice(-2).join("/")
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

  if (!scanResult) {
    return (
      <div className="saas-card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-foreground">
            {t.dash.chartAnalytics}
          </h2>
        </div>
        <div className="flex h-64 flex-col items-center justify-center gap-2 border border-dashed border-border bg-muted/20">
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
    <div className="saas-card p-5 space-y-4">
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

        {/* Controles de Dimensão & Formato de Gráfico */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Tabs de Dimensão */}
          <div className="flex items-center border border-border bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setDimension("severity")}
              className={cn(
                "px-2.5 py-1 text-[11px] font-bold transition-all",
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
                "px-2.5 py-1 text-[11px] font-bold transition-all",
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
                  "px-2.5 py-1 text-[11px] font-bold transition-all",
                  dimension === "repo"
                    ? "bg-card text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.dash.dimRepo}
              </button>
            )}
          </div>

          {/* Seletor de Tipo de Gráfico */}
          <div className="flex items-center border border-border bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setChartType("bar")}
              className={cn(
                "p-1 text-xs transition-all",
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
                "p-1 text-xs transition-all",
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
                "p-1 text-xs transition-all",
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
        </div>
      </div>

      {/* Renderização do Gráfico Selecionado */}
      <div className="h-64 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "bar" ? (
            <BarChart
              data={currentChartData}
              margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
              barSize={dimension === "severity" ? 44 : 32}
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
              <Bar dataKey="count" isAnimationActive={true} animationDuration={600}>
                {currentChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          ) : chartType === "donut" ? (
            <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <Tooltip content={<CustomTooltip />} />
              <Pie
                data={currentChartData}
                dataKey="count"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={4}
                isAnimationActive={true}
                animationDuration={600}
              >
                {currentChartData.map((entry, index) => (
                  <Cell key={`donut-${index}`} fill={entry.fill} stroke="transparent" />
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

      {/* Legenda & Detalhes Interativos */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {currentChartData.map((d) => (
            <span key={d.label} className="flex items-center gap-1.5 text-muted-foreground font-mono text-[11px]">
              <span className="h-2 w-2 shrink-0" style={{ background: d.fill }} />
              <span className="text-foreground font-medium">{d.label}:</span>
              <span className="font-bold text-foreground">{d.count}</span>
              {d.percent !== undefined && (
                <span className="text-muted-foreground/60 text-[10px]">({d.percent}%)</span>
              )}
            </span>
          ))}
        </div>

        <span className="text-[10px] font-mono text-muted-foreground">
          {dimension === "repo"
            ? t.dash.repositoriesCompared.replace("{count}", String(reposList.length))
            : `${scanResult.total_vulnerabilidades} ${t.dash.totalFindingsWord.toLowerCase()}`}
        </span>
      </div>
    </div>
  )
}
