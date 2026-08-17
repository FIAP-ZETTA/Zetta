"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  ShieldAlert,
  GitBranch,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Link2,
  X,
} from "lucide-react"
import { scanRepo, saveScanResult, type ScanResponse } from "@/lib/zettascan-api"
import { useLanguage } from "@/lib/language-provider"
import { cn } from "@/lib/utils"

const DEMO_REPOS = [
  {
    name: "we45/Vulnerable-Flask-App",
    url: "https://github.com/we45/Vulnerable-Flask-App",
    desc: "App Flask vulnerável (SQLi, SSTI, Hardcoded Secrets)",
  },
  {
    name: "OWASP/NodeGoat",
    url: "https://github.com/OWASP/NodeGoat",
    desc: "Node.js OWASP Top 10 benchmark",
  },
  {
    name: "juice-shop/juice-shop",
    url: "https://github.com/juice-shop/juice-shop",
    desc: "Aplicação intencionalmente vulnerável (Modern JS)",
  },
]

interface ScanFormProps {
  onScanComplete?: () => void
}

export function ScanForm({ onScanComplete }: ScanFormProps) {
  const router = useRouter()
  const { t } = useLanguage()
  const [repo, setRepo] = useState("")
  const [token, setToken] = useState("")
  const [scanning, setScanning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState<"cloning" | "analyzing" | "gemini" | "done">("cloning")
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [resultSummary, setResultSummary] = useState<{
    total: number
    criticas: number
    altas: number
    tempo: number
  } | null>(null)

  function normalizeRepoInput(val: string): string {
    const trimmed = val.trim()
    if (!trimmed) return ""
    if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) return trimmed
    if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(trimmed)) {
      return `https://github.com/${trimmed}`
    }
    return trimmed
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setDone(false)
    setResultSummary(null)

    const finalRepo = normalizeRepoInput(repo)
    if (!finalRepo) {
      setError("Por favor, informe a URL ou o padrão usuario/repositorio do GitHub.")
      return
    }

    setScanning(true)
    setProgress(15)
    setStage("cloning")

    const timer1 = setTimeout(() => {
      setProgress(45)
      setStage("analyzing")
    }, 1200)

    const timer2 = setTimeout(() => {
      setProgress(75)
      setStage("gemini")
    }, 2400)

    try {
      const result: ScanResponse = await scanRepo(finalRepo, token)

      clearTimeout(timer1)
      clearTimeout(timer2)
      setProgress(100)
      setStage("done")

      saveScanResult(result)

      setResultSummary({
        total: result.total_vulnerabilidades,
        criticas: result.criticas,
        altas: result.altas,
        tempo: result.tempo_segundos,
      })

      setDone(true)
      if (onScanComplete) onScanComplete()
    } catch (err: any) {
      clearTimeout(timer1)
      clearTimeout(timer2)
      setError(
        err.message || t.connections.errorFallback
      )
    } finally {
      setScanning(false)
    }
  }

  function handleDemoSelect(url: string) {
    setRepo(url)
    setError(null)
  }

  const stages: Record<typeof stage, string> = {
    cloning: "Clonando repositório em ambiente isolado...",
    analyzing: "Executando Semgrep (regras OWASP & Secrets)...",
    gemini: "IA contextualizando riscos e correções...",
    done: "Auditoria finalizada com sucesso!",
  }

  return (
    <div className="saas-card p-6 space-y-6">
      <div>
        <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-foreground">
          {t.connections.formTitle}
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t.connections.formSub}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Token Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5 text-primary" />
            {t.connections.tokenLabel}
          </label>
          <input
            id="token"
            type="password"
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            value={token}
            disabled={scanning}
            onChange={(e) => setToken(e.target.value)}
            className="w-full border border-border bg-background px-3.5 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
          <p className="text-[11px] text-muted-foreground">
            {t.connections.tokenHint}
          </p>
        </div>

        {/* Repo Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Link2 className="h-3.5 w-3.5 text-primary" />
            {t.connections.repoLabel}
          </label>
          <input
            id="repo"
            type="text"
            placeholder="https://github.com/usuario/repositorio"
            value={repo}
            disabled={scanning}
            onChange={(e) => setRepo(e.target.value)}
            onBlur={(e) => setRepo(normalizeRepoInput(e.target.value))}
            className="w-full border border-border bg-background px-3.5 py-2 text-xs font-mono text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
        </div>

        {/* Error notice */}
        {error && (
          <div className="flex items-start gap-2.5 border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-rose-400">{t.connections.errorTitle}</p>
              <p className="mt-0.5 opacity-90">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-rose-400 hover:text-rose-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Progress bar during scan */}
        {scanning && (
          <div className="space-y-2 bg-muted/40 p-4 border border-border">
            <div className="flex items-center justify-between text-xs">
              <span className="font-mono text-primary font-medium">{stages[stage]}</span>
              <span className="font-mono text-muted-foreground font-semibold">{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 w-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Done summary banner */}
        {done && resultSummary && (
          <div className="border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs">
            <div className="flex items-center gap-2 font-bold text-emerald-500 mb-2">
              <CheckCircle2 className="h-4 w-4" />
              {t.connections.doneTitle.replace("{sec}", String(resultSummary.tempo))}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center my-3">
              <div className="bg-card p-2 border border-border shadow-sm">
                <p className="font-heading text-lg font-bold text-foreground">{resultSummary.total}</p>
                <p className="text-[10px] text-muted-foreground uppercase">{t.devops.total}</p>
              </div>
              <div className="bg-card p-2 border border-border shadow-sm">
                <p className="font-heading text-lg font-bold text-rose-500">{resultSummary.criticas}</p>
                <p className="text-[10px] text-muted-foreground uppercase">{t.scan.critical}</p>
              </div>
              <div className="bg-card p-2 border border-border shadow-sm">
                <p className="font-heading text-lg font-bold text-amber-500">{resultSummary.altas}</p>
                <p className="text-[10px] text-muted-foreground uppercase">{t.scan.high}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push("/zettascan")}
              className="btn-electric w-full py-2 text-xs font-bold uppercase tracking-wider"
            >
              {t.connections.viewDetailedBtn}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Action button */}
        <button
          id="btn-start-scan"
          type="submit"
          disabled={scanning}
          className="btn-electric w-full py-2.5 text-xs font-bold uppercase tracking-wider disabled:opacity-50"
        >
          {scanning ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              {t.connections.runningAuditBtn}
            </>
          ) : (
            <>
              <GitBranch className="h-4 w-4" />
              {t.connections.startAuditBtn}
            </>
          )}
        </button>
      </form>

      {/* Demo Repos Quick Links */}
      <div className="border-t border-border pt-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
          {t.connections.demoTitle}
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {DEMO_REPOS.map((d) => (
            <button
              key={d.name}
              type="button"
              onClick={() => handleDemoSelect(d.url)}
              className="text-left p-2.5 border border-border bg-card hover:border-primary/50 transition-all"
            >
              <p className="font-mono text-xs font-bold text-foreground truncate">{d.name}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{d.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
