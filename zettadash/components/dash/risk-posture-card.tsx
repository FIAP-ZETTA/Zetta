"use client"

import { useEffect, useState, useCallback } from "react"
import { ShieldCheck, ShieldAlert, AlertTriangle, Activity, CheckCircle2 } from "lucide-react"
import {
  loadConsolidatedScanResult,
  getActiveRepoUrl,
  type ScanResponse,
} from "@/lib/zettascan-api"
import { useLanguage } from "@/lib/language-provider"
import { cn } from "@/lib/utils"

export function RiskPostureCard() {
  const { t, lang } = useLanguage()
  const [scanResult, setScanResult] = useState<ScanResponse | null>(null)

  const refresh = useCallback(() => {
    const activeUrl = getActiveRepoUrl()
    const result = loadConsolidatedScanResult(activeUrl)
    setScanResult(result)
  }, [])

  useEffect(() => {
    refresh()
    const handler = () => refresh()
    window.addEventListener("zettascan:repo_change", handler)
    return () => window.removeEventListener("zettascan:repo_change", handler)
  }, [refresh])

  if (!scanResult) {
    return null
  }

  // Cálculo da pontuação de postura de segurança (100 = seguro, decai com falhas)
  const penalty =
    scanResult.criticas * 10 +
    scanResult.altas * 4 +
    scanResult.medias * 1.5 +
    scanResult.baixas * 0.5

  const score = Math.max(12, Math.min(100, Math.round(100 - penalty)))

  let grade = "A"
  let gradeColor = "text-emerald-500 border-emerald-500/30 bg-emerald-500/10"
  let statusText = lang === "pt" ? "Postura Segura" : "Strong Posture"
  let statusSub = lang === "pt" ? "Nenhuma vulnerabilidade crítica pendente" : "No critical vulnerabilities pending"
  let borderColor = "border-l-emerald-500"
  let Icon = ShieldCheck
  let iconColor = "text-emerald-500"

  if (score < 50 || scanResult.criticas > 3) {
    grade = "D"
    gradeColor = "text-rose-500 border-rose-500/30 bg-rose-500/10"
    statusText = lang === "pt" ? "Risco Elevado" : "High Risk"
    statusSub = lang === "pt"
      ? `${scanResult.criticas} falhas críticas exigem correção`
      : `${scanResult.criticas} critical findings require action`
    borderColor = "border-l-rose-500"
    Icon = ShieldAlert
    iconColor = "text-rose-500"
  } else if (score < 75 || scanResult.criticas > 0 || scanResult.altas > 2) {
    grade = "B"
    gradeColor = "text-amber-500 border-amber-500/30 bg-amber-500/10"
    statusText = lang === "pt" ? "Atenção Requerida" : "Moderate Risk"
    statusSub = lang === "pt"
      ? `${scanResult.altas} falhas de alto risco detectadas`
      : `${scanResult.altas} high risk findings detected`
    borderColor = "border-l-amber-500"
    Icon = AlertTriangle
    iconColor = "text-amber-500"
  }

  const criticalRatio =
    scanResult.total_vulnerabilidades > 0
      ? Math.round((scanResult.criticas / scanResult.total_vulnerabilidades) * 100)
      : 0

  return (
    <div className={cn("saas-card p-5 border-l-[3px] space-y-4", borderColor)}>
      {/* Cabeçalho Limpo e sem quebra de texto */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4 shrink-0", iconColor)} />
          <h2 className="font-heading text-xs font-bold uppercase tracking-wider text-foreground">
            {lang === "pt" ? "Postura de Segurança" : "Security Posture"}
          </h2>
        </div>
        <span className={cn("px-2.5 py-0.5 font-mono text-xs font-bold border whitespace-nowrap shrink-0", gradeColor)}>
          {lang === "pt" ? `Grau ${grade}` : `Grade ${grade}`} · {statusText}
        </span>
      </div>

      {/* Conteúdo Principal com Grade em Destaque */}
      <div className="flex items-center justify-between gap-4 pt-1">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center font-heading text-2xl font-black border", gradeColor)}>
            {grade}
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="font-heading text-2xl font-extrabold text-foreground tracking-tight">
                {score}
              </span>
              <span className="text-xs font-mono text-muted-foreground">/100 pts</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
              {statusSub}
            </p>
          </div>
        </div>

        {/* Estatísticas na Direita */}
        <div className="text-right font-mono text-xs shrink-0 pl-2 border-l border-border">
          <p className="text-[10px] uppercase text-muted-foreground font-bold">
            {lang === "pt" ? "Taxa Crítica" : "Critical Ratio"}
          </p>
          <p className={cn("text-base font-extrabold mt-0.5", criticalRatio > 0 ? "text-rose-500" : "text-emerald-500")}>
            {criticalRatio}%
          </p>
        </div>
      </div>

      {/* Barra de Progresso Visual de Saúde */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
          <span>{lang === "pt" ? "Índice de Proteção" : "Health Index"}</span>
          <span className="font-bold text-foreground">{score}%</span>
        </div>
        <div className="h-1.5 w-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-500",
              score >= 75 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-rose-500"
            )}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>
    </div>
  )
}
