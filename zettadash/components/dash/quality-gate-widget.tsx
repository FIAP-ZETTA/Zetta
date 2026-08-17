"use client"

import { useState, useEffect } from "react"
import {
  GitPullRequest, CheckCircle2, XCircle, AlertTriangle,
  Copy, Check, Download, ShieldCheck, ShieldAlert,
  Terminal, ExternalLink, Code2, ChevronDown, ChevronUp, Lock
} from "lucide-react"
import { useLanguage } from "@/lib/language-provider"
import {
  loadConsolidatedScanResult,
  getActiveRepoUrl,
  evaluateQualityGate,
  type QualityGateResult,
  type ScanResponse,
} from "@/lib/zettascan-api"
import { cn } from "@/lib/utils"

export function QualityGateWidget() {
  const { t } = useLanguage()
  const [qgResult, setQgResult] = useState<QualityGateResult | null>(null)
  const [scanData, setScanData] = useState<ScanResponse | null>(null)
  const [copied, setCopied] = useState(false)
  const [showPrPreview, setShowPrPreview] = useState(false)

  const loadData = async () => {
    const activeUrl = getActiveRepoUrl()
    const result = loadConsolidatedScanResult(activeUrl)
    setScanData(result)

    if (result) {
      if (result.quality_gate) {
        setQgResult(result.quality_gate)
      } else {
        const evalRes = await evaluateQualityGate(
          result.vulnerabilidades,
          result.iac_findings,
          undefined,
          result.repositorio.split("/").pop()
        )
        setQgResult(evalRes)
      }
    } else {
      setQgResult(null)
    }
  }

  useEffect(() => {
    loadData()
    window.addEventListener("zettascan:repo_change", loadData)
    return () => window.removeEventListener("zettascan:repo_change", loadData)
  }, [])

  if (!scanData || !qgResult) {
    return (
      <div className="saas-card p-5 border-border/80">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <GitPullRequest className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-heading text-sm font-bold text-foreground">
              {t.qualityGate.title}
            </h3>
            <p className="text-xs text-muted-foreground">
              Conecte um repositório para avaliar as regras de Quality Gate e bloqueio de PRs.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const isPassed = qgResult.passed
  const workflowCode = qgResult.github_action_workflow || `# Zetta Guard Quality Gate Workflow
name: "Zetta ASPM Quality Gate"
on: [pull_request, push]
jobs:
  security-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Scan & Gate
        run: |
          echo "Checking vulnerabilities against Zetta Quality Gate..."
`

  const handleCopyWorkflow = async () => {
    try {
      await navigator.clipboard.writeText(workflowCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {}
  }

  const handleDownloadWorkflow = () => {
    const blob = new Blob([workflowCode], { type: "text/yaml" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "zetta-aspm.yml"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="saas-card p-5 space-y-5 border-border/80">
      {/* Header & Main Status Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border",
            isPassed
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(52,211,153,0.2)]"
              : "bg-rose-500/10 text-rose-400 border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.2)]"
          )}>
            {isPassed ? <ShieldCheck className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading text-sm font-bold text-foreground">
                {t.qualityGate.title}
              </h3>
              <span className={cn(
                "text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border",
                isPassed
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/40"
                  : "bg-rose-500/10 text-rose-400 border-rose-500/40"
              )}>
                {isPassed ? t.qualityGate.statusPassed : t.qualityGate.statusBlocked}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isPassed ? t.qualityGate.passedSummary : t.qualityGate.blockedSummary}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyWorkflow}
            className="px-3 py-1.5 rounded-lg border border-border bg-muted/30 hover:bg-muted text-xs font-bold text-foreground transition-colors flex items-center gap-1.5"
            title={t.qualityGate.copyWorkflow}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
            <span>{copied ? t.qualityGate.copied : "Copiar Action"}</span>
          </button>
          <button
            onClick={handleDownloadWorkflow}
            className="px-3 py-1.5 rounded-lg border border-border bg-muted/30 hover:bg-muted text-xs font-bold text-foreground transition-colors flex items-center gap-1.5"
            title={t.qualityGate.downloadWorkflow}
          >
            <Download className="h-3.5 w-3.5 text-muted-foreground" />
            <span>YAML</span>
          </button>
        </div>
      </div>

      {/* Rules Evaluation Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Rule 1: Zero Critical */}
        <div className={cn(
          "p-3 rounded-xl border flex items-center justify-between",
          qgResult.counts.critical === 0
            ? "border-emerald-500/30 bg-emerald-500/[0.03]"
            : "border-rose-500/30 bg-rose-500/[0.04]"
        )}>
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-foreground">{t.qualityGate.ruleMaxCritical}</p>
            <p className="text-[10px] text-muted-foreground">{qgResult.counts.critical} críticas encontradas</p>
          </div>
          {qgResult.counts.critical === 0 ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
          )}
        </div>

        {/* Rule 2: Max High */}
        <div className={cn(
          "p-3 rounded-xl border flex items-center justify-between",
          qgResult.counts.high <= 2
            ? "border-emerald-500/30 bg-emerald-500/[0.03]"
            : "border-rose-500/30 bg-rose-500/[0.04]"
        )}>
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-foreground">{t.qualityGate.ruleMaxHigh}</p>
            <p className="text-[10px] text-muted-foreground">{qgResult.counts.high} altas encontradas</p>
          </div>
          {qgResult.counts.high <= 2 ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
          )}
        </div>

        {/* Rule 3: Zero Secrets */}
        <div className={cn(
          "p-3 rounded-xl border flex items-center justify-between",
          qgResult.counts.secrets === 0
            ? "border-emerald-500/30 bg-emerald-500/[0.03]"
            : "border-rose-500/30 bg-rose-500/[0.04]"
        )}>
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-foreground">{t.qualityGate.ruleNoSecrets}</p>
            <p className="text-[10px] text-muted-foreground">{qgResult.counts.secrets} segredos expostos</p>
          </div>
          {qgResult.counts.secrets === 0 ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 text-rose-400 shrink-0" />
          )}
        </div>
      </div>

      {/* GitHub PR Comment Simulation Drawer */}
      <div className="border border-border/80 rounded-xl overflow-hidden bg-muted/10">
        <button
          onClick={() => setShowPrPreview(!showPrPreview)}
          className="w-full flex items-center justify-between p-3 text-xs font-bold text-foreground hover:bg-muted/30 transition-colors"
        >
          <span className="flex items-center gap-2">
            <GitPullRequest className="h-4 w-4 text-primary" />
            {t.qualityGate.viewPrSimulator} (GitHub Pull Request Bot)
          </span>
          {showPrPreview ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>

        {showPrPreview && (
          <div className="p-4 border-t border-border bg-card/60 space-y-3 animate-in fade-in duration-200 font-sans">
            {/* PR Mock Comment Box */}
            <div className="rounded-xl border border-border bg-background p-4 space-y-3 shadow-inner">
              <div className="flex items-center gap-2 border-b border-border/60 pb-2">
                <div className="flex h-5 w-5 items-center justify-center rounded bg-primary text-primary-foreground text-[10px] font-bold">
                  Z
                </div>
                <span className="text-xs font-bold text-foreground">github-actions[bot]</span>
                <span className="text-[10px] text-muted-foreground">comentou agora</span>
              </div>

              <div className="space-y-2 text-xs text-foreground">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "font-bold px-2 py-0.5 rounded text-[11px]",
                    isPassed ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                  )}>
                    {isPassed ? "✅ Quality Gate Aprovado" : "❌ Merge Bloqueado pelo Zetta Guard"}
                  </span>
                </div>

                <p className="text-muted-foreground">
                  O scan automatizado do ASPM foi concluído em <span className="font-mono font-bold text-foreground">{scanData.tempo_segundos}s</span>.
                </p>

                <div className="p-2.5 rounded bg-muted/40 font-mono text-[11px] space-y-1">
                  <p>• Total de Achados: {scanData.total_vulnerabilidades}</p>
                  <p className="text-rose-400">• Críticas: {scanData.criticas} (Limite permitido: 0)</p>
                  <p className="text-orange-400">• Altas: {scanData.altas} (Limite permitido: 2)</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
