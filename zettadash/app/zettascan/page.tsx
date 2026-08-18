"use client"

import { useEffect, useState, Suspense, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import {
  Search, ScanLine, Clock, GitBranch, ShieldOff, ArrowRight,
  ShieldAlert, AlertTriangle, Zap, CheckCircle2, Layers,
  Download, FileJson, FileText, Code2, Package, Server, ChevronDown,
  Flame, Globe, Sparkles, Filter, RefreshCw, X
} from "lucide-react"
import { VulnerabilityCard, type Vulnerability } from "@/components/scan/vulnerability-card"
import { AttackPathViewer } from "@/components/scan/attack-path-viewer"
import { DastScannerModal } from "@/components/scan/dast-scanner-modal"
import { RepoSelector } from "@/components/repo-selector"
import { useLanguage } from "@/lib/language-provider"
import { cn } from "@/lib/utils"
import {
  loadConsolidatedScanResult,
  getActiveRepoUrl,
  getSavedRepositories,
  exportScanReport,
  fetchAttackPaths,
  type ScanResponse,
  type ExportFormat,
  type AttackPath,
} from "@/lib/zettascan-api"
import Link from "next/link"

type OriginFilter = "ALL" | "codigo" | "dependencia" | "iac" | "dast"

function ZettaScanInner() {
  const { t } = useLanguage()
  const searchParams = useSearchParams()
  const queryParam = searchParams.get("q") ?? ""

  const [vulns, setVulns] = useState<Vulnerability[]>([])
  const [scanMeta, setScanMeta] = useState<ScanResponse | null>(null)
  const [filter, setFilter] = useState<string>("ALL")
  const [originFilter, setOriginFilter] = useState<OriginFilter>("ALL")
  const [search, setSearch] = useState(queryParam)
  const [repoCount, setRepoCount] = useState(0)
  const [exporting, setExporting] = useState(false)
  const [exportDone, setExportDone] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showAttackPaths, setShowAttackPaths] = useState(false)
  const [showDastModal, setShowDastModal] = useState(false)
  const [attackPathsList, setAttackPathsList] = useState<AttackPath[]>([])
  const [loadingPaths, setLoadingPaths] = useState(false)

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
      origem: v.tipo || "codigo",
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
      if (result.attack_paths) {
        setAttackPathsList(result.attack_paths)
      }
    } else {
      setVulns([])
      setScanMeta(null)
      setAttackPathsList([])
    }
  }, [])

  const handleOpenAttackPaths = async () => {
    if (!scanMeta) return
    if (scanMeta.attack_paths && scanMeta.attack_paths.length > 0) {
      setAttackPathsList(scanMeta.attack_paths)
      setShowAttackPaths(true)
      return
    }
    setLoadingPaths(true)
    try {
      const paths = await fetchAttackPaths(scanMeta.vulnerabilidades, scanMeta.iac_findings)
      setAttackPathsList(paths)
      setShowAttackPaths(true)
    } finally {
      setLoadingPaths(false)
    }
  }

  const handleAddDastFindings = (findings: any[]) => {
    const dastVulns = findings.map((f, i) => ({
      id: `dast-${Date.now()}-${i}`,
      file: f.arquivo,
      line: f.linha,
      type: f.titulo,
      severity: f.severidade,
      description: f.explicacao,
      explicacao: f.explicacao,
      impacto: f.impacto,
      correcao: f.correcao,
      repo: scanMeta?.repositorio || "Runtime DAST",
      origem: "dast",
    }))
    setVulns(prev => [...prev, ...dastVulns])
    setOriginFilter("dast")
  }

  useEffect(() => {
    refresh()
    const handler = () => {
      setSearch("")
      setFilter("ALL")
      setOriginFilter("ALL")
      refresh()
    }
    window.addEventListener("zettascan:repo_change", handler)
    return () => window.removeEventListener("zettascan:repo_change", handler)
  }, [refresh])

  useEffect(() => {
    if (!showExportMenu) return
    const handler = () => setShowExportMenu(false)
    document.addEventListener("click", handler)
    return () => document.removeEventListener("click", handler)
  }, [showExportMenu])

  const counts = {
    CRITICAL: vulns.filter(v => v.severity === "CRITICAL").length,
    HIGH:     vulns.filter(v => v.severity === "HIGH").length,
    MEDIUM:   vulns.filter(v => v.severity === "MEDIUM").length,
    LOW:      vulns.filter(v => v.severity === "LOW").length,
  }

  const originCounts = {
    codigo:     vulns.filter(v => v.origem === "codigo").length,
    dependencia:vulns.filter(v => v.origem === "dependencia").length,
    iac:        vulns.filter(v => v.origem === "iac").length,
    dast:       vulns.filter(v => v.origem === "dast").length,
  }

  const filtered = vulns.filter(v => {
    const matchSev    = filter === "ALL" || v.severity === filter
    const matchOrigin = originFilter === "ALL" || v.origem === originFilter
    const matchSearch = search === "" ||
      v.file.toLowerCase().includes(search.toLowerCase()) ||
      v.type.toLowerCase().includes(search.toLowerCase()) ||
      (v.repo ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (v.description ?? "").toLowerCase().includes(search.toLowerCase())
    return matchSev && matchOrigin && matchSearch
  })

  async function handleExport(formato: ExportFormat) {
    if (!scanMeta || exporting) return
    setShowExportMenu(false)
    setExporting(true)
    try {
      await exportScanReport(scanMeta, formato)
      setExportDone(true)
      setTimeout(() => setExportDone(false), 3000)
    } catch {
      // ignore
    } finally {
      setExporting(false)
    }
  }

  // ── Estado vazio (sem scan realizado) ──────────────────────────────────────
  if (!scanMeta) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center space-y-6 max-w-md mx-auto">
        <div className="flex h-16 w-16 items-center justify-center bg-card border border-border shadow-sm rounded-2xl">
          <ShieldOff className="h-8 w-8 text-primary/60" />
        </div>
        <div className="space-y-2">
          <h2 className="font-heading text-xl font-bold text-foreground">{t.scan.noRepoConnected}</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t.scan.noRepoSub}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/configuracoes"
            className="btn-electric px-5 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2"
          >
            {t.dash.connectRepo} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <button
            id="btn-empty-dast"
            onClick={() => setShowDastModal(true)}
            className="border border-border bg-card hover:border-primary/50 text-foreground px-4 py-2.5 text-xs font-bold transition-all flex items-center gap-2 rounded-lg"
          >
            <Globe className="h-4 w-4 text-primary" />
            {t.dast.buttonOpen}
          </button>
        </div>

        {/* Modal de Scanner DAST */}
        <DastScannerModal
          isOpen={showDastModal}
          onClose={() => setShowDastModal(false)}
          onAddFindingsToReport={handleAddDastFindings}
        />
      </div>
    )
  }

  const activeUrl = getActiveRepoUrl()
  const isConsolidated = !activeUrl && repoCount > 1

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* ── BARRA SUPERIOR CONSOLIDADA E LIMPA ─────────────────────────────── */}
      <div className="saas-card p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Repo Selector & Status */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <RepoSelector />
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {scanMeta.tempo_segundos}s
            </span>
            <span>•</span>
            <span className="text-foreground font-bold">
              {vulns.length} {vulns.length === 1 ? t.scan.findingWordSingle : t.scan.findingsWord}
            </span>
          </div>
        </div>

        {/* Botões de Ação ASPM Agrupados e Elegantes */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Attack Paths */}
          <button
            id="btn-attack-paths"
            onClick={handleOpenAttackPaths}
            disabled={loadingPaths}
            className="px-3 py-1.5 rounded border border-border bg-card hover:border-primary text-foreground text-xs font-bold transition-all flex items-center gap-2 shadow-sm"
            title={t.attackPath.buttonOpen}
          >
            <Flame className="h-3.5 w-3.5 text-rose-500" />
            <span>Attack Paths</span>
            {attackPathsList.length > 0 && (
              <span className="text-[10px] font-mono font-bold bg-muted px-1.5 py-0.2 rounded border border-border">
                {attackPathsList.length}
              </span>
            )}
          </button>

          {/* DAST Scanner */}
          <button
            id="btn-dast-scanner"
            onClick={() => setShowDastModal(true)}
            className="px-3 py-1.5 rounded border border-border bg-card hover:border-primary text-foreground text-xs font-bold transition-all flex items-center gap-2 shadow-sm"
            title={t.dast.buttonOpen}
          >
            <Globe className="h-3.5 w-3.5 text-primary" />
            <span>DAST</span>
          </button>

          {/* Exportar Menu */}
          <div className="relative">
            <button
              id="export-report-btn"
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowExportMenu(s => !s) }}
              disabled={exporting}
              className="px-3 py-1.5 rounded border border-border bg-card hover:border-primary text-foreground text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
            >
              {exportDone ? (
                <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> {t.scan.exportSuccess}</>
              ) : (
                <><Download className="h-3.5 w-3.5 text-muted-foreground" /> {t.scan.exportReport} <ChevronDown className="h-3 w-3 opacity-60" /></>
              )}
            </button>

            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1.5 z-50 bg-card border border-border shadow-xl rounded min-w-[200px] py-1 animate-in fade-in zoom-in-95 duration-150">
                <button
                  type="button"
                  id="export-json-btn"
                  onClick={() => handleExport("json")}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-muted transition-colors"
                >
                  <FileJson className="h-4 w-4 text-primary" />
                  <div>
                    <p className="font-bold text-foreground">{t.scan.exportJson}</p>
                    <p className="text-[10px] text-muted-foreground">ASPM</p>
                  </div>
                </button>
                <button
                  type="button"
                  id="export-sbom-btn"
                  onClick={() => handleExport("sbom")}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-left hover:bg-muted transition-colors border-t border-border/40"
                >
                  <FileText className="h-4 w-4 text-violet-400" />
                  <div>
                    <p className="font-bold text-foreground">{t.scan.exportSbom}</p>
                    <p className="text-[10px] text-muted-foreground">{t.scan.exportSbomDesc}</p>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Atalho Configurações */}
          <Link
            href="/configuracoes"
            className="btn-electric px-3.5 py-1.5 text-xs font-bold shrink-0 flex items-center gap-1.5"
          >
            <span>{t.repoSelector.connectNew}</span> <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* ── BARRA UNIFICADA DE FILTROS & BUSCA (SEM POLUIÇÃO VISUAL) ─────────── */}
      <div className="saas-card p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Tabs de Origem (SAST / SCA / IaC / DAST) */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {[
            { id: "ALL" as OriginFilter, label: t.scan.filterAll, count: vulns.length },
            { id: "codigo" as OriginFilter, label: t.scan.originSast, count: originCounts.codigo },
            { id: "dependencia" as OriginFilter, label: t.scan.originSca, count: originCounts.dependencia },
            { id: "iac" as OriginFilter, label: t.scan.originIac, count: originCounts.iac },
            ...(originCounts.dast > 0 ? [{ id: "dast" as OriginFilter, label: "DAST", count: originCounts.dast }] : []),
          ].map((tab) => {
            const active = originFilter === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setOriginFilter(tab.id)}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold rounded transition-all flex items-center gap-1.5 whitespace-nowrap",
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                <span>{tab.label}</span>
                <span className={cn(
                  "text-[10px] font-mono px-1.5 py-0.2 rounded",
                  active ? "bg-white/20" : "bg-muted text-muted-foreground"
                )}>
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Filtros de Severidade & Busca */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Pills de Severidade Rápidas */}
          <div className="flex items-center gap-1 bg-muted/40 p-1 rounded border border-border">
            {[
              { id: "ALL", label: t.scan.allTabs, count: vulns.length },
              { id: "CRITICAL", label: t.scan.critical, count: counts.CRITICAL, color: "text-rose-400" },
              { id: "HIGH", label: t.scan.high, count: counts.HIGH, color: "text-amber-400" },
              { id: "MEDIUM", label: t.scan.medium, count: counts.MEDIUM, color: "text-indigo-400" },
            ].map((s) => {
              const active = filter === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => setFilter(s.id)}
                  className={cn(
                    "px-2 py-1 text-[11px] font-bold rounded transition-all flex items-center gap-1",
                    active
                      ? "bg-card text-foreground shadow-sm border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <span className={s.color}>{s.label}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">({s.count})</span>
                </button>
              )
            })}
          </div>

          {/* Busca Rápida */}
          <div className="relative flex-1 sm:w-60">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder={t.scan.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded border border-border bg-muted/30 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                title="Limpar busca"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── LISTA DE VULNERABILIDADES ─────────────────────────────────────────── */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="saas-card p-12 text-center space-y-4">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                {t.scan.noVulnFound}
              </p>
              <p className="text-xs text-muted-foreground">
                {t.scan.noVulnSub}
              </p>
            </div>
            {(search || filter !== "ALL" || originFilter !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("")
                  setFilter("ALL")
                  setOriginFilter("ALL")
                }}
                className="btn-electric px-4 py-1.5 text-xs font-bold rounded shadow-sm"
              >
                {t.scan.filterAll}
              </button>
            )}
          </div>
        ) : (
          filtered.map((vuln, idx) => (
            <VulnerabilityCard
              key={`${vuln.file}-${vuln.line}-${idx}`}
              vuln={vuln}
              defaultExpanded={search !== "" || filtered.length <= 2}
            />
          ))
        )}
      </div>

      {/* Modal de Attack Path Analysis */}
      <AttackPathViewer
        paths={attackPathsList}
        isOpen={showAttackPaths}
        onClose={() => setShowAttackPaths(false)}
        onSelectVuln={(file, line) => {
          setFilter("ALL")
          setOriginFilter("ALL")
          setSearch(file)
        }}
      />

      {/* Modal de Scanner DAST */}
      <DastScannerModal
        isOpen={showDastModal}
        onClose={() => setShowDastModal(false)}
        onAddFindingsToReport={handleAddDastFindings}
      />
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
