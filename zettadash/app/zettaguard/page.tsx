"use client"

import { useEffect, useState, useCallback } from "react"
import {
  ShieldCheck,
  ShieldAlert,
  Activity,
  ArrowRight,
  Cpu,
  Lock,
  Layers,
  Sparkles,
  Zap,
  RefreshCw,
  Sliders,
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
  const { t } = useLanguage()
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
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Banner Informativo & Status da API */}
      <div className="saas-card p-5 border-primary/40 bg-primary/[0.03] relative overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5 max-w-3xl">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/30 text-primary shadow-sm">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="font-heading text-base font-bold text-foreground">
                  {t.guard.bannerTitle}
                </h2>
                <span className="text-[10px] font-mono font-bold bg-primary/15 text-primary px-2 py-0.5 rounded border border-primary/30">
                  ASPM Layer 5 · Runtime & LLM
                </span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                {t.guard.bannerDesc}
              </p>

              {/* Badges das 3 camadas */}
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="flex items-center gap-1.5 font-bold px-2 py-0.5 rounded bg-card border border-border text-foreground">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  L1: Regex Curados (~60 padrões)
                </span>
                <span className="flex items-center gap-1.5 font-bold px-2 py-0.5 rounded bg-card border border-border text-foreground">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  L2: IA Semântica (Gemini 2.0)
                </span>
                <span className="flex items-center gap-1.5 font-bold px-2 py-0.5 rounded bg-card border border-border text-foreground">
                  <span className="h-2 w-2 rounded-full bg-indigo-500" />
                  L3: Inspeção de Saída (Data Leakage)
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex items-center gap-1.5 text-xs font-mono font-bold px-2.5 py-1 rounded border",
                  health?.status === "online"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                )}
              >
                <Activity className="h-3.5 w-3.5 animate-pulse" />
                <span>
                  {health?.status === "online"
                    ? `Porta 8002 Online (${health.latency}ms)`
                    : "Simulação Ativa (Offline)"}
                </span>
              </div>

              <button
                onClick={loadData}
                disabled={refreshing}
                className="p-1.5 rounded border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Recarregar Telemetria"
              >
                <RefreshCw
                  className={cn("h-4 w-4", refreshing && "animate-spin")}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Métricas Principais (KPIs) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {/* Total Analisado */}
        <div className="saas-card p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {t.guard.attacksDetected}
              </p>
              <Cpu className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 font-heading text-3xl font-extrabold text-foreground font-mono">
              {total}
            </p>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Prompts e respostas inspecionados
          </p>
        </div>

        {/* Ataques Bloqueados */}
        <div className="saas-card p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {t.guard.blockedWaf}
              </p>
              <ShieldAlert className="h-4 w-4 text-rose-400" />
            </div>
            <p className="mt-2 font-heading text-3xl font-extrabold text-rose-400 font-mono">
              {bloqueados}
            </p>
          </div>
          <p className="mt-1 text-[10px] text-rose-400/80 font-bold">
            Ameaças neutralizadas em tempo real
          </p>
        </div>

        {/* Taxa de Bloqueio */}
        <div className="saas-card p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {t.guard.mitigationRate}
              </p>
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <p className="mt-2 font-heading text-3xl font-extrabold text-primary font-mono">
              {taxaBloqueio}%
            </p>
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            {emAnalise} requisições em análise manual
          </p>
        </div>

        {/* Score de Proteção */}
        <div className="saas-card p-4 sm:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {t.guard.protectionScore}
              </p>
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="mt-2 font-heading text-3xl font-extrabold text-emerald-400 font-mono">
              {scoreProtecao}/100
            </p>
          </div>
          <p className="mt-1 text-[10px] text-emerald-400 font-bold">
            Defesa ativa de alto nível
          </p>
        </div>
      </div>

      {/* Red-Teaming Sandbox & Attack Simulator */}
      <AttackSandbox />

      {/* Charts & OWASP Threat Matrix Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AttackChart />
        <OwaspMatrix />
      </div>

      {/* Security Incident Log Table */}
      <EventsTable />

      {/* ASPM Correlation Footer */}
      <div className="saas-card p-5 border-border bg-card/60 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-foreground">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
              Integração ASPM Completa: ZettaScan + ZettaGuard + ZettaDash
            </h4>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Conectamos a análise estática de código (SAST), CVEs de dependências (SCA), IaC e proteção em runtime de IA.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/zettascan"
            className="btn-electric px-4 py-2 text-xs font-bold flex items-center gap-1.5"
          >
            Auditar Código (ZettaScan) <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}
