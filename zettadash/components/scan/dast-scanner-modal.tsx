"use client"

import { useState } from "react"
import {
  Globe, Shield, ShieldAlert, ShieldCheck, CheckCircle2,
  XCircle, AlertTriangle, Play, RefreshCw, X, Clock,
  Lock, Unlock, ArrowRight, Server, FileCode, Check
} from "lucide-react"
import { useLanguage } from "@/lib/language-provider"
import { scanDast, type DastResponse, type DastFinding } from "@/lib/zettascan-api"
import { cn } from "@/lib/utils"

interface DastScannerModalProps {
  isOpen: boolean
  onClose: () => void
  onAddFindingsToReport?: (findings: DastFinding[]) => void
}

export function DastScannerModal({
  isOpen,
  onClose,
  onAddFindingsToReport,
}: DastScannerModalProps) {
  const { t } = useLanguage()
  const [targetUrl, setTargetUrl] = useState("http://localhost:3000")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DastResponse | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (!isOpen) return null

  const handleRunDast = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!targetUrl.trim() || loading) return

    setLoading(true)
    setErrorMsg(null)
    try {
      const res = await scanDast(targetUrl.trim())
      setResult(res)
    } catch (err: any) {
      setErrorMsg(err.message || "Erro ao conectar com o endpoint de teste DAST.")
    } finally {
      setLoading(false)
    }
  }

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case "A+":
      case "A":
        return "text-emerald-400 border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_20px_rgba(52,211,153,0.2)]"
      case "B":
        return "text-sky-400 border-sky-500/40 bg-sky-500/10"
      case "C":
        return "text-amber-400 border-amber-500/40 bg-amber-500/10"
      default:
        return "text-rose-400 border-rose-500/40 bg-rose-500/10 shadow-[0_0_20px_rgba(244,63,94,0.2)]"
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[90vh] bg-card border border-border shadow-2xl rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/30 shadow-[0_0_15px_rgba(56,189,248,0.2)]">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading text-base font-bold text-foreground">
                  {t.dast.title}
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Runtime Probe
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {t.dast.subtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Target URL Input Bar */}
          <form onSubmit={handleRunDast} className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              URL Alvo para Auditoria Dinâmica
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder={t.dast.inputPlaceholder}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-muted/30 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono placeholder:text-muted-foreground/60"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !targetUrl.trim()}
                className="btn-electric px-6 py-2.5 text-xs font-bold flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>{t.dast.scanning}</span>
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 fill-current" />
                    <span>{t.dast.scanAction}</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
              <span>Sugestões rápidas:</span>
              <button
                type="button"
                onClick={() => setTargetUrl("http://localhost:3000")}
                className="font-mono text-primary hover:underline"
              >
                localhost:3000 (ZettaDash)
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() => setTargetUrl("http://localhost:8000")}
                className="font-mono text-primary hover:underline"
              >
                localhost:8000 (ZettaScan API)
              </button>
            </div>
          </form>

          {errorMsg && (
            <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-500/10 text-xs text-rose-400 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Results View */}
          {result && (() => {
            const score = result.security_score ?? (result as any).securityScore ?? 0
            const statusCode = result.status_code ?? (result as any).statusCode ?? 200
            const responseTime = result.response_time_ms ?? (result as any).responseTimeMs ?? 0
            const totalFindings = result.total_findings ?? (result as any).totalFindings ?? (result.findings?.length || 0)
            const headersFound = result.headers_found ?? (result as any).headersFound ?? {}
            const missingHeaders = result.missing_headers ?? (result as any).missingHeaders ?? []

            return (
              <div className="space-y-6 animate-in fade-in duration-300">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* Score & Grade */}
                  <div className="saas-card p-4 flex items-center gap-3">
                    <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border font-heading text-xl font-extrabold", getGradeColor(result.grade))}>
                      {result.grade}
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">{t.dast.securityScore}</p>
                      <p className="font-heading text-xl font-extrabold text-foreground">
                        {score}<span className="text-xs text-muted-foreground font-normal">/100</span>
                      </p>
                    </div>
                  </div>

                  {/* HTTP Status & Latency */}
                  <div className="saas-card p-4 space-y-1">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">{t.dast.statusHttp}</p>
                    <p className="font-heading text-lg font-bold text-foreground">
                      HTTP {statusCode}
                    </p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                      <Clock className="h-3 w-3" /> {responseTime}ms
                    </p>
                  </div>

                  {/* SSL/TLS */}
                  <div className="saas-card p-4 space-y-1">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">{t.dast.sslStatus}</p>
                    <div className="flex items-center gap-1.5 pt-0.5">
                      {result.ssl_enabled ? (
                        <span className="flex items-center gap-1 text-xs font-bold text-emerald-400">
                          <Lock className="h-3.5 w-3.5" /> {t.dast.sslActive}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-bold text-rose-400">
                          <Unlock className="h-3.5 w-3.5" /> {t.dast.sslInactive}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {result.ssl_enabled ? "Criptografado TLS" : "Texto claro"}
                    </p>
                  </div>

                  {/* Findings Count */}
                  <div className="saas-card p-4 space-y-1">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground">Achados Dinâmicos</p>
                    <p className="font-heading text-xl font-extrabold text-foreground">
                      {totalFindings}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      vulnerabilidades em runtime
                    </p>
                  </div>
                </div>

                {/* Security Headers Inspection Table */}
                <div className="saas-card p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      Inspeção de Cabeçalhos HTTP de Segurança
                    </h3>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {Object.keys(headersFound).length} presentes • {missingHeaders.length} ausentes
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Found Headers */}
                    {Object.entries(headersFound).map(([hdr, val]) => (
                      <div key={hdr} className="p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.04] flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-mono font-bold text-foreground truncate">{hdr}</p>
                          <p className="text-[10px] font-mono text-muted-foreground truncate">{String(val)}</p>
                        </div>
                      </div>
                    ))}

                    {/* Missing Headers */}
                    {missingHeaders.map((hdr) => (
                      <div key={hdr} className="p-2.5 rounded-lg border border-rose-500/30 bg-rose-500/[0.04] flex items-start gap-2">
                        <XCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-mono font-bold text-rose-300 truncate">{hdr}</p>
                          <p className="text-[10px] text-rose-400/80">Cabeçalho ausente na resposta HTTP</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              {/* Dynamic Findings List */}
              {result.findings.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-foreground flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-rose-400" />
                    Achados e Vulnerabilidades Detectadas ({result.findings.length})
                  </h3>

                  <div className="space-y-2">
                    {result.findings.map((f, i) => (
                      <div key={i} className="saas-card p-4 space-y-2 border-border/80">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "text-[10px] font-mono font-bold px-2 py-0.5 rounded border",
                              f.severidade === "CRITICAL" ? "bg-rose-500/10 text-rose-400 border-rose-500/30" :
                              f.severidade === "HIGH" ? "bg-orange-500/10 text-orange-400 border-orange-500/30" :
                              f.severidade === "MEDIUM" ? "bg-amber-500/10 text-amber-400 border-amber-500/30" :
                              "bg-sky-500/10 text-sky-400 border-sky-500/30"
                            )}>
                              {f.severidade}
                            </span>
                            <span className="text-xs font-bold text-foreground">{f.titulo}</span>
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground">{f.arquivo}</span>
                        </div>

                        <p className="text-xs text-muted-foreground leading-relaxed">{f.explicacao}</p>
                        
                        <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60 text-[11px] space-y-1">
                          <p className="text-muted-foreground"><span className="font-bold text-foreground">Impacto:</span> {f.impacto}</p>
                          <p className="text-primary font-mono"><span className="font-bold">Correção:</span> {f.correcao}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )})()}
        </div>
      </div>
    </div>
  )
}
