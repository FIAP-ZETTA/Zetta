"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Server,
  Activity,
  Cpu,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Layers,
  Container,
  Network,
  Globe,
  ShieldCheck,
  Zap,
} from "lucide-react"
import { checkBackendHealth } from "@/lib/zettascan-api"
import { checkGuardHealth } from "@/lib/zettaguard-api"
import { QualityGateWidget } from "@/components/dash/quality-gate-widget"
import { useLanguage } from "@/lib/language-provider"
import { cn } from "@/lib/utils"

interface ServiceStatus {
  name: string
  desc: string
  port: string
  url: string
  status: "online" | "offline" | "checking"
  latency?: number
  detail?: string
}

export default function DevOpsPage() {
  const { t } = useLanguage()
  const [lastCheck, setLastCheck] = useState<Date | null>(null)
  const [checking, setChecking] = useState(false)

  const [services, setServices] = useState<ServiceStatus[]>([
    {
      name: "FastAPI + Semgrep Engine",
      desc: "SAST, DAST, SCA & Quality Gate Backend",
      port: "8000",
      url: "http://localhost:8000/health",
      status: "checking",
    },
    {
      name: "ZettaGuard LLM Shield",
      desc: "Proteção LLM em Tempo Real, Regex L1 & IA L2",
      port: "8002",
      url: "http://localhost:8002/health",
      status: "checking",
    },
    {
      name: "Next.js 16 App Router",
      desc: "ZettaDash UI & Telemetria ASPM",
      port: "3000",
      url: "/",
      status: "online",
      latency: 12,
    },
  ])

  const runHealthCheck = useCallback(async () => {
    setChecking(true)

    const t0 = performance.now()
    const [scanResult, guardResult] = await Promise.all([
      checkBackendHealth(),
      checkGuardHealth(),
    ])
    const scanLatency = Math.round(performance.now() - t0)

    setServices((prev) =>
      prev.map((s) => {
        if (s.port === "8000") {
          return {
            ...s,
            status: scanResult.status === "online" ? "online" : "offline",
            latency: scanResult.status === "online" ? scanLatency : undefined,
            detail:
              scanResult.status === "online"
                ? `Semgrep: ${scanResult.semgrep ?? "ok"} · Gemini: ${scanResult.gemini ?? "ok"}`
                : "Sem resposta do backend",
          }
        }
        if (s.port === "8002") {
          return {
            ...s,
            status: guardResult.status === "online" ? "online" : "offline",
            latency: guardResult.status === "online" ? guardResult.latency : undefined,
            detail:
              guardResult.status === "online"
                ? `Motor 3 Camadas · Gemini: ${guardResult.gemini_configurado ? "Ativo" : "Fallback L1"}`
                : "Sem resposta do backend",
          }
        }
        return s
      })
    )

    setLastCheck(new Date())
    setChecking(false)
  }, [])

  useEffect(() => {
    runHealthCheck()
  }, [runHealthCheck])

  const dockerInfoCards = [
    {
      label: "Orquestração",
      value: "docker-compose.yml",
      sub: "3 containers gerenciados",
      icon: Layers,
    },
    {
      label: "Rede Interna",
      value: "bridge driver",
      sub: "Isolamento de tráfego",
      icon: Network,
    },
    {
      label: "Backend Base",
      value: "FastAPI + Uvicorn",
      sub: "Python 3.12 engine",
      icon: Cpu,
    },
    {
      label: "Frontend Base",
      value: "Next.js 16",
      sub: "Standalone build",
      icon: Container,
    },
  ]

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* ── BARRA SUPERIOR DE DEVOPS ────────────────────────────────────────── */}
      <div className="saas-card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-heading text-base font-bold text-foreground">
              DevOps & Pipeline Security
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Políticas de bloqueio de CI/CD, Quality Gate e saúde da infraestrutura
            </p>
          </div>
        </div>

        {/* Botão Health Check */}
        <button
          id="btn-recheck-health"
          onClick={runHealthCheck}
          disabled={checking}
          className="btn-electric px-3.5 py-1.5 text-xs font-bold shrink-0 disabled:opacity-50 flex items-center gap-2 rounded-lg"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", checking && "animate-spin")} />
          <span>{checking ? "Verificando..." : "Testar Serviços"}</span>
        </button>
      </div>

      {/* ── 1. CI/CD QUALITY GATE (PRINCIPAL ELEMENTO DEVSECOPS) ────────────── */}
      <QualityGateWidget />

      {/* ── 2. STATUS DOS SERVIÇOS EM TEMPO REAL ────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground px-1 flex items-center gap-2">
          <Server className="h-3.5 w-3.5 text-primary" />
          <span>Status dos Serviços & Motores ASPM</span>
        </h2>

        <div className="grid gap-3 md:grid-cols-2">
          {services.map((svc) => {
            const isOnline = svc.status === "online"
            const isChecking = svc.status === "checking"

            return (
              <div
                key={svc.name}
                className={cn(
                  "saas-card p-4 space-y-3 border-l-[3px] rounded-xl transition-all",
                  isOnline ? "border-l-emerald-500" : isChecking ? "border-l-amber-500" : "border-l-rose-500"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-muted/60 border border-border rounded-lg text-primary mt-0.5">
                      {svc.port === "8000" ? <Server className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-bold text-foreground truncate">{svc.name}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{svc.desc}</p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isChecking ? (
                      <span className="flex items-center gap-1.5 bg-muted px-2.5 py-1 text-[10px] font-bold text-muted-foreground rounded">
                        <RefreshCw className="h-3 w-3 animate-spin" /> Verificando
                      </span>
                    ) : isOnline ? (
                      <span className="flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-400 border border-emerald-500/30 rounded">
                        <CheckCircle2 className="h-3 w-3" /> Online
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 bg-rose-500/10 px-2.5 py-1 text-[10px] font-bold text-rose-400 border border-rose-500/30 rounded">
                        <XCircle className="h-3 w-3" /> Offline
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div className="bg-muted/30 px-3 py-2 rounded-lg border border-border">
                    <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Porta</p>
                    <p className="font-mono font-bold text-foreground mt-0.5">{svc.port}</p>
                  </div>
                  <div className="bg-muted/30 px-3 py-2 rounded-lg border border-border">
                    <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">Latência</p>
                    <p className="font-mono font-bold text-foreground mt-0.5">
                      {svc.latency != null ? (
                        <span className={svc.latency < 200 ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                          {svc.latency}ms
                        </span>
                      ) : isChecking ? "—" : svc.detail ?? "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── 3. ARQUITETURA DE INFRAESTRUTURA DOCKER ──────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground px-1 flex items-center gap-2">
          <Cpu className="h-3.5 w-3.5 text-primary" />
          <span>Arquitetura de Infraestrutura & Containers</span>
        </h2>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {dockerInfoCards.map((c) => {
            const Icon = c.icon
            return (
              <div key={c.label} className="saas-card p-3.5 flex items-center gap-3 rounded-xl">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{c.label}</p>
                  <p className="truncate font-heading text-xs font-bold text-foreground mt-0.5">{c.value}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{c.sub}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
