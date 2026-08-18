"use client"

import { useEffect, useState, useCallback } from "react"
import {
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Layers,
  Activity,
} from "lucide-react"
import { useLanguage } from "@/lib/language-provider"
import Link from "next/link"
import {
  getGuardStats,
  checkGuardHealth,
  GuardStats,
  GuardHealthStatus,
} from "@/lib/zettaguard-api"
import { AttackSandbox } from "@/components/guard/attack-sandbox"
import { AttackChart } from "@/components/guard/attack-chart"
import { OwaspMatrix } from "@/components/guard/owasp-matrix"
import { EventsTable } from "@/components/guard/events-table"
import { cn } from "@/lib/utils"

export default function ZettaGuardPage() {
  const { t, lang } = useLanguage()
  const [stats, setStats] = useState<GuardStats | null>(null)
  const [health, setHealth] = useState<GuardHealthStatus | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const loadData = useCallback(async () => {
    setRefreshing(true)
    const [s, h] = await Promise.all([getGuardStats(), checkGuardHealth()])
    setStats(s)
    setHealth(h)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    loadData()
    const handleUpdate = () => loadData()
    window.addEventListener("zettaguard:event_added", handleUpdate)
    return () => window.removeEventListener("zettaguard:event_added", handleUpdate)
  }, [loadData])

  const total = stats?.total || 0
  const bloqueados = stats?.bloqueados || 0
  const emAnalise = stats?.em_analise || 0
  const taxaBloqueio = stats?.taxa_bloqueio || 0
  const scoreProtecao = total > 0 ? Math.max(100 - (emAnalise * 5), 85) : 98

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="saas-card p-5 border-primary/30 relative overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2.5">
              <h1 className="font-heading text-lg font-bold text-foreground tracking-tight">
                {t.guard.bannerTitle}
              </h1>
              <span className="text-[10px] font-mono text-primary px-2 py-0.5 rounded border border-primary/30 bg-primary/10">
                Layer 5 · Runtime
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t.guard.bannerDesc}
            </p>

            {/* Camadas Minimalistas com Theme Accent */}
            <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
              <span className="px-2 py-0.5 rounded border border-border bg-card font-medium text-foreground hover:border-primary/50 transition-colors">
                {lang === "en" ? "L1 Regex (~60 patterns)" : "L1 Regex (~60 padrões)"}
              </span>
              <span className="text-muted-foreground">•</span>
              <span className="px-2 py-0.5 rounded border border-border bg-card font-medium text-foreground hover:border-primary/50 transition-colors">
                {lang === "en" ? "L2 Semantic AI (Gemini)" : "L2 IA Semântica (Gemini)"}
              </span>
              <span className="text-muted-foreground">•</span>
              <span className="px-2 py-0.5 rounded border border-border bg-card font-medium text-foreground hover:border-primary/50 transition-colors">
                {lang === "en" ? "L3 Output Inspection" : "L3 Inspeção de Saída"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div
              className={cn(
                "flex items-center gap-1.5 text-xs font-mono px-2.5 py-1 rounded border",
                health?.status === "online"
                  ? "border-primary/30 text-primary bg-primary/10"
                  : "border-border text-muted-foreground bg-muted/30"
              )}
            >
              <Activity className={cn("h-3 w-3", health?.status === "online" && "text-primary animate-pulse")} />
              <span>
                {health?.status === "online"
                  ? `Online (${health.latency}ms)`
                  : (lang === "en" ? "Simulation Active" : "Simulação Ativa")}
              </span>
            </div>

            <button
              onClick={loadData}
              disabled={refreshing}
              className="p-1.5 rounded border border-border bg-card hover:border-primary text-muted-foreground hover:text-foreground transition-colors"
              title={lang === "en" ? "Reload" : "Recarregar"}
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", refreshing && "animate-spin text-primary")}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Métricas Principais (KPIs) com saas-card */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {/* Total Analisado */}
        <div className="saas-card p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              {t.guard.attacksDetected}
            </p>
            <p className="mt-1.5 font-heading text-2xl sm:text-3xl font-bold text-foreground font-mono">
              {total}
            </p>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {lang === "en" ? "Prompts inspected" : "Prompts inspecionados"}
          </p>
        </div>

        {/* Ataques Bloqueados */}
        <div className="saas-card p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              {t.guard.blockedWaf}
            </p>
            <p className="mt-1.5 font-heading text-2xl sm:text-3xl font-bold text-rose-400 font-mono">
              {bloqueados}
            </p>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {lang === "en" ? "Threats neutralized" : "Ameaças neutralizadas"}
          </p>
        </div>

        {/* Taxa de Bloqueio */}
        <div className="saas-card p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              {t.guard.mitigationRate}
            </p>
            <p className="mt-1.5 font-heading text-2xl sm:text-3xl font-bold text-primary font-mono">
              {taxaBloqueio}%
            </p>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {lang === "en" ? `${emAnalise} under review` : `${emAnalise} em análise manual`}
          </p>
        </div>

        {/* Score de Proteção */}
        <div className="saas-card p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              {t.guard.protectionScore}
            </p>
            <p className="mt-1.5 font-heading text-2xl sm:text-3xl font-bold text-emerald-400 font-mono">
              {scoreProtecao}<span className="text-xs text-muted-foreground font-normal">/100</span>
            </p>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {lang === "en" ? "Active defense posture" : "Postura de defesa ativa"}
          </p>
        </div>
      </div>

      {/* Sandbox de Testes */}
      <AttackSandbox />

      {/* Gráfico & Matriz OWASP */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AttackChart />
        <OwaspMatrix />
      </div>

      {/* Tabela de Incidentes */}
      <EventsTable />

      {/* Footer ASPM com saas-card e botão com cor do tema */}
      <div className="saas-card p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <Layers className="h-4 w-4 text-primary" />
          <p className="text-muted-foreground">
            {lang === "en" ? (
              <>Full ASPM integration with <strong className="text-foreground">ZettaScan</strong> (SAST/SCA/IaC) and <strong className="text-foreground">ZettaGuard</strong> (Runtime AI).</>
            ) : (
              <>Integração ASPM com <strong className="text-foreground">ZettaScan</strong> (SAST/SCA/IaC) e <strong className="text-foreground">ZettaGuard</strong> (Runtime IA).</>
            )}
          </p>
        </div>

        <Link
          href="/zettascan"
          className="btn-electric px-3.5 py-1.5 text-xs font-bold flex items-center gap-1.5"
        >
          {lang === "en" ? "Code Audit" : "Auditoria de Código"} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  )
}


