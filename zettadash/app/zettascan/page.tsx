"use client"

import { useEffect, useState, Suspense, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { Search, ScanLine, Clock, GitBranch, RefreshCw, ShieldOff, ArrowRight, ShieldAlert, AlertTriangle, Zap, CheckCircle2, Layers } from "lucide-react"
import { VulnerabilityCard, type Vulnerability } from "@/components/scan/vulnerability-card"
import { RepoSelector } from "@/components/repo-selector"
import { useLanguage } from "@/lib/language-provider"
import { cn } from "@/lib/utils"
import {
  loadConsolidatedScanResult,
  getActiveRepoUrl,
  getSavedRepositories,
  type ScanResponse,
} from "@/lib/zettascan-api"
import Link from "next/link"

function ZettaScanInner() {
  const { t } = useLanguage()
  const searchParams = useSearchParams()
  const queryParam = searchParams.get("q") ?? ""

  const [vulns, setVulns] = useState<Vulnerability[]>([])
  const [scanMeta, setScanMeta] = useState<ScanResponse | null>(null)
  const [filter, setFilter] = useState<string>("ALL")
  const [search, setSearch] = useState(queryParam)
  const [repoCount, setRepoCount] = useState(0)

  const severityMap: Record<string, Vulnerability["severity"]> = {
    CRITICAL: "CRITICAL",
    HIGH: "HIGH",
    MEDIUM: "MEDIUM",
    LOW: "LOW",
  }

  function apiToVuln(v: ScanResponse["vulnerabilidades"][0], idx: number): Vulnerability {
    return {
      id: String(idx),
      file: v.arquivo || "unknown",
      line: typeof v.linha === "number" ? v.linha : 0,
      type: v.titulo,
      severity: severityMap[v.severidade?.toUpperCase()] ?? "LOW",
      description: v.explicacao,
      explicacao: v.explicacao,
      impacto: v.impacto,
      correcao: v.correcao,
      repo: v.repositorio,
    }
  }

  const refresh = useCallback(() => {
    const activeUrl = getActiveRepoUrl()
    const result = loadConsolidatedScanResult(activeUrl)
    const all = getSavedRepositories()
    setRepoCount(all.length)

    if (result) {
      setVulns(result.vulnerabilidades.map(apiToVuln))
      setScanMeta(result)
    } else {
      setVulns([])
      setScanMeta(null)
    }
  }, [])

  useEffect(() => {
    if (queryParam) setSearch(queryParam)
  }, [queryParam])

  useEffect(() => {
    refresh()
    const handler = () => refresh()
    window.addEventListener("zettascan:repo_change", handler)
    return () => window.removeEventListener("zettascan:repo_change", handler)
  }, [refresh])

  const counts = {
    CRITICAL: vulns.filter(v => v.severity === "CRITICAL").length,
    HIGH:     vulns.filter(v => v.severity === "HIGH").length,
    MEDIUM:   vulns.filter(v => v.severity === "MEDIUM").length,
    LOW:      vulns.filter(v => v.severity === "LOW").length,
  }

  const filtered = vulns.filter(v => {
    const matchSev    = filter === "ALL" || v.severity === filter
    const matchSearch = search === "" ||
      v.file.toLowerCase().includes(search.toLowerCase()) ||
      v.type.toLowerCase().includes(search.toLowerCase()) ||
      (v.repo ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (v.description ?? "").toLowerCase().includes(search.toLowerCase())
    return matchSev && matchSearch
  })

  // ── Estado vazio (sem scan realizado) ──────────────────────────────────────
  if (!scanMeta) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-6 max-w-md mx-auto">
        <div className="flex h-16 w-16 items-center justify-center bg-card border border-border shadow-sm">
          <ShieldOff className="h-8 w-8 text-primary/60" />
        </div>
        <div className="space-y-2">
          <h2 className="font-heading text-xl font-bold text-foreground">{t.scan.noRepoConnected}</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t.scan.noRepoSub}
          </p>
        </div>
        <Link
          href="/configuracoes"
          className="btn-electric px-5 py-2.5 text-xs font-bold uppercase tracking-wider"
        >
          {t.dash.connectRepo} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    )
  }

  const activeUrl = getActiveRepoUrl()
  const isConsolidated = !activeUrl && repoCount > 1

  const filterTabs = [
    { id: "ALL",      label: t.scan.allTabs, count: vulns.length },
    { id: "CRITICAL", label: t.scan.critical, count: counts.CRITICAL },
    { id: "HIGH",     label: t.scan.high,     count: counts.HIGH },
    { id: "MEDIUM",   label: t.scan.medium,   count: counts.MEDIUM },
    { id: "LOW",      label: t.scan.low,      count: counts.LOW },
  ]

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Selector Multi-Repositório & Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border p-3.5 shadow-sm">
        <RepoSelector />
        <div className="flex items-center gap-2">
          <Link
            href="/zettadash"
            className="border border-border hover:border-primary/50 bg-card px-3 py-1.5 text-xs font-bold text-foreground shrink-0 transition-colors"
          >
            {t.scan.viewDashboard}
          </Link>
          <Link
            href="/configuracoes"
            className="btn-electric px-3 py-1.5 text-xs font-bold shrink-0"
          >
            {t.scan.manageConnections} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Header com metadata do Scan */}
      <div className="saas-card p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-primary/10 border border-primary/30 text-primary mt-0.5">
              {isConsolidated ? <Layers className="h-5 w-5" /> : <ScanLine className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-heading text-base font-bold text-foreground tracking-tight truncate">
                  {isConsolidated ? t.scan.consolidatedTitle.replace("{count}", String(repoCount)) : scanMeta.repositorio}
                </span>
                <span className="bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 font-mono text-[10px] font-bold px-2 py-0.5">
                  {t.scan.sastAudited}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground font-mono flex-wrap">
                {scanMeta.scanned_at && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(scanMeta.scanned_at).toLocaleString()}
                  </span>
                )}
                {scanMeta.tempo_segundos > 0 && (
                  <span>{t.scan.duration.replace("{sec}", String(scanMeta.tempo_segundos))}</span>
                )}
                <span>{t.scan.engine}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cards de Contagem por Severidade */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        {[
          { id: "CRITICAL", label: t.scan.critical, count: counts.CRITICAL, icon: ShieldAlert, color: "text-rose-500", border: "hover:border-rose-500/50" },
          { id: "HIGH",     label: t.scan.high,     count: counts.HIGH,     icon: AlertTriangle, color: "text-amber-500", border: "hover:border-amber-500/50" },
          { id: "MEDIUM",   label: t.scan.medium,   count: counts.MEDIUM,   icon: Zap,           color: "text-indigo-500", border: "hover:border-indigo-500/50" },
          { id: "LOW",      label: t.scan.low,      count: counts.LOW,      icon: Zap,           color: "text-primary",    border: "hover:border-primary/50" },
        ].map((s) => {
          const Icon = s.icon
          const isSelected = filter === s.id
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setFilter(filter === s.id ? "ALL" : s.id)}
              className={cn(
                "saas-card p-4 text-left transition-all",
                s.border,
                isSelected && "border-primary bg-primary/5 shadow-sm"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </span>
                <Icon className={cn("h-4 w-4", s.color)} />
              </div>
              <p className={cn("font-heading text-3xl font-extrabold mt-1 tracking-tight", s.color)}>
                {s.count}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {s.count === 1 ? t.scan.findingWordSingle : t.scan.findingsWord}
              </p>
            </button>
          )
        })}
      </div>

      {/* Toolbar de Filtro e Busca */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border p-3 shadow-sm">
        {/* Tabs de severidade */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {filterTabs.map((tab) => {
            const active = filter === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={cn(
                  "px-3 py-1 text-xs font-bold transition-all whitespace-nowrap",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {tab.label} ({tab.count})
              </button>
            )
          })}
        </div>

        {/* Busca por arquivo, tipo ou repositório */}
        <div className="flex items-center gap-2 border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground transition-all hover:border-primary/50 focus-within:border-primary">
          <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <input
            placeholder={t.scan.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48 sm:w-56 bg-transparent text-foreground placeholder:text-muted-foreground/50 focus:outline-none text-xs"
          />
        </div>
      </div>

      {/* Lista de Vulnerabilidades */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="saas-card p-12 text-center space-y-3">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
            <p className="text-sm font-semibold text-foreground">
              {t.scan.noVulnFound}
            </p>
            <p className="text-xs text-muted-foreground">
              {t.scan.noVulnSub}
            </p>
          </div>
        ) : (
          filtered.map((vuln, idx) => (
            <VulnerabilityCard key={`${vuln.file}-${vuln.line}-${idx}`} vuln={vuln} />
          ))
        )}
      </div>
    </div>
  )
}

export default function ZettaScanPage() {
  return (
    <Suspense fallback={
      <div className="flex h-64 items-center justify-center text-xs text-muted-foreground">
        Loading...
      </div>
    }>
      <ZettaScanInner />
    </Suspense>
  )
}
