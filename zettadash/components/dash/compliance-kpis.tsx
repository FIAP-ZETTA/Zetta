"use client"

import { useLanguage } from "@/lib/language-provider"
import { loadConsolidatedScanResult, getActiveRepoUrl, getSavedRepositories } from "@/lib/zettascan-api"
import { useEffect, useState } from "react"
import {
  TrendingDown, TrendingUp, Minus, Clock, ShieldCheck,
  BarChart3, AlertCircle, CheckCircle2
} from "lucide-react"
import { cn } from "@/lib/utils"

// Categorias OWASP Top 10 mapeadas para padrões de tipo/ID de vulnerabilidade
const OWASP_CATEGORIES = [
  { id: "A01", label: "A01 - Access Control", patterns: ["access-control", "broken-access", "idor", "path-traversal"] },
  { id: "A02", label: "A02 - Cryptography",   patterns: ["crypto", "md5", "sha1", "weak-cipher", "ssl"] },
  { id: "A03", label: "A03 - Injection",       patterns: ["sql", "injection", "command", "xss", "xxe"] },
  { id: "A04", label: "A04 - Insecure Design", patterns: ["insecure-design", "design"] },
  { id: "A05", label: "A05 - Misconfiguration",patterns: ["misconfiguration", "config", "iac", "docker", "terraform"] },
  { id: "A06", label: "A06 - Vuln Components", patterns: ["dependencia", "cve", "osv", "sca"] },
  { id: "A07", label: "A07 - Auth Failures",   patterns: ["auth", "session", "token", "secret", "hardcoded"] },
  { id: "A08", label: "A08 - Data Integrity",  patterns: ["integrity", "supply-chain", "action", "ci-cd"] },
  { id: "A09", label: "A09 - Logging Failures",patterns: ["logging", "monitoring"] },
  { id: "A10", label: "A10 - SSRF",            patterns: ["ssrf", "request-forgery", "redirect"] },
]

function detectOwaspCoverage(vulns: { tipo?: string; titulo?: string; regra?: string; explicacao?: string }[]): number {
  let covered = 0
  for (const cat of OWASP_CATEGORIES) {
    const found = vulns.some(v => {
      const text = `${v.tipo ?? ""} ${v.titulo ?? ""} ${v.regra ?? ""} ${v.explicacao ?? ""}`.toLowerCase()
      return cat.patterns.some(p => text.includes(p))
    })
    if (found) covered++
  }
  return covered
}

function computeMttr(criticas: number, altas: number): number {
  // Heurística: número de achados críticos/altos estima MTTR em dias
  // MTTR baixo = boa postura. Referência: < 7 dias = excelente, < 30 = adequado
  const base = 3 // dias mínimos
  const penalty = (criticas * 2.5) + (altas * 0.8)
  return Math.min(Math.round(base + penalty), 120) // cap em 120 dias
}

export function ComplianceKpis() {
  const { t } = useLanguage()
  const [hasScan, setHasScan] = useState(false)
  const [owaspCovered, setOwaspCovered] = useState(0)
  const [mttr, setMttr] = useState(0)
  const [criticalPct, setCriticalPct] = useState(0)
  const [repoCount, setRepoCount] = useState(0)
  const [trend, setTrend] = useState<"improving" | "stable" | "degrading">("stable")

  useEffect(() => {
    function load() {
      const activeUrl = getActiveRepoUrl()
      const result = loadConsolidatedScanResult(activeUrl)
      const repos = getSavedRepositories()
      setRepoCount(repos.length)

      if (!result || result.total_vulnerabilidades === 0) {
        setHasScan(false)
        return
      }

      setHasScan(true)
      const vulns = result.vulnerabilidades ?? []

      // OWASP coverage
      const owaspCount = detectOwaspCoverage(
        vulns.map(v => ({ tipo: v.tipo, titulo: v.titulo, regra: (v as any).regra, explicacao: v.explicacao }))
      )
      setOwaspCovered(owaspCount)

      // MTTR estimado
      const mttrDays = computeMttr(result.criticas, result.altas)
      setMttr(mttrDays)

      // Taxa críticas
      const pct = result.total_vulnerabilidades > 0
        ? Math.round((result.criticas / result.total_vulnerabilidades) * 100)
        : 0
      setCriticalPct(pct)

      // Trend baseado em proporção de críticas
      if (pct <= 10) setTrend("improving")
      else if (pct <= 30) setTrend("stable")
      else setTrend("degrading")
    }

    load()
    window.addEventListener("zettascan:repo_change", load)
    return () => window.removeEventListener("zettascan:repo_change", load)
  }, [])

  if (!hasScan) {
    return (
      <div className="saas-card p-5">
        <h3 className="font-heading text-sm font-bold text-foreground">{t.compliance.title}</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5 mb-4">{t.compliance.subtitle}</p>
        <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
          <BarChart3 className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">{t.compliance.noData}</p>
        </div>
      </div>
    )
  }

  const mttrLabel = mttr <= 7 ? t.compliance.mttrGood : mttr <= 30 ? t.compliance.mttrOk : t.compliance.mttrBad
  const mttrColor = mttr <= 7 ? "text-emerald-500" : mttr <= 30 ? "text-amber-500" : "text-rose-500"
  const mttrBg = mttr <= 7 ? "bg-emerald-500/10 border-emerald-500/30" : mttr <= 30 ? "bg-amber-500/10 border-amber-500/30" : "bg-rose-500/10 border-rose-500/30"

  const TrendIcon = trend === "improving" ? TrendingDown : trend === "degrading" ? TrendingUp : Minus
  const trendColor = trend === "improving" ? "text-emerald-500" : trend === "degrading" ? "text-rose-500" : "text-amber-500"
  const trendLabel = trend === "improving" ? t.compliance.trendImproving : trend === "degrading" ? t.compliance.trendDegrading : t.compliance.trendStable
  const trendBg = trend === "improving" ? "bg-emerald-500/10 border-emerald-500/30" : trend === "degrading" ? "bg-rose-500/10 border-rose-500/30" : "bg-amber-500/10 border-amber-500/30"

  const owaspPct = Math.round((owaspCovered / 10) * 100)
  const critColor = criticalPct <= 10 ? "text-emerald-500" : criticalPct <= 30 ? "text-amber-500" : "text-rose-500"

  return (
    <div className="saas-card overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-border">
        <h3 className="font-heading text-sm font-bold text-foreground">{t.compliance.title}</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">{t.compliance.subtitle}</p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 divide-x divide-y divide-border">

        {/* MTTR */}
        <div className="p-4 space-y-2">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {t.compliance.mttr}
            </span>
          </div>
          <div className={cn("inline-flex items-center gap-1.5 px-2 py-1 border text-xs font-bold", mttrBg, mttrColor)}>
            {mttr} {t.compliance.mttrUnit}
          </div>
          <p className={cn("text-[10px] font-semibold", mttrColor)}>{mttrLabel}</p>
          <p className="text-[10px] text-muted-foreground">{t.compliance.mttrFull}</p>
        </div>

        {/* Trend */}
        <div className="p-4 space-y-2">
          <div className="flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {t.compliance.trend}
            </span>
          </div>
          <div className={cn("inline-flex items-center gap-1.5 px-2 py-1 border text-xs font-bold", trendBg, trendColor)}>
            <TrendIcon className="h-3.5 w-3.5" />
            {trendLabel}
          </div>
          <p className="text-[10px] text-muted-foreground">
            {t.compliance.criticalRatioDesc.replace("{pct}", String(criticalPct))}
          </p>
        </div>

        {/* OWASP Coverage */}
        <div className="p-4 space-y-2 col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {t.compliance.owaspScore}
              </span>
            </div>
            <span className="text-xs font-bold text-foreground tabular-nums">
              {owaspCovered}/10
            </span>
          </div>
          {/* Barra de progresso OWASP */}
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-700 rounded-full"
              style={{ width: `${owaspPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">
              {t.compliance.owaspDesc.replace("{count}", String(owaspCovered))}
            </span>
            <span className="font-bold text-primary">{owaspPct}%</span>
          </div>
          {/* Mini lista das categorias */}
          <div className="flex flex-wrap gap-1 mt-1">
            {OWASP_CATEGORIES.map(cat => {
              const covered = owaspCovered >= OWASP_CATEGORIES.indexOf(cat) + 1
              return (
                <span
                  key={cat.id}
                  className={cn(
                    "text-[9px] font-mono px-1 py-0.5 border",
                    covered
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "bg-muted border-border text-muted-foreground/50"
                  )}
                  title={cat.label}
                >
                  {cat.id}
                </span>
              )
            })}
          </div>
        </div>

        {/* Critical Ratio */}
        <div className="p-4 space-y-2">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {t.compliance.criticalRatio}
            </span>
          </div>
          <p className={cn("font-heading text-2xl font-extrabold tabular-nums", critColor)}>
            {criticalPct}%
          </p>
          <p className="text-[10px] text-muted-foreground">{t.compliance.criticalRatio}</p>
        </div>

        {/* Repos auditados */}
        <div className="p-4 space-y-2">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {t.compliance.totalScanned}
            </span>
          </div>
          <p className="font-heading text-2xl font-extrabold text-foreground tabular-nums">
            {repoCount}
          </p>
          <p className="text-[10px] text-muted-foreground">{t.compliance.totalScanned}</p>
        </div>
      </div>
    </div>
  )
}
