"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Server,
  Activity,
  Cpu,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Container,
  Network,
  Globe,
  GitBranch,
  WifiOff,
} from "lucide-react"
import { checkBackendHealth, loadScanResult, type ScanResponse } from "@/lib/zettascan-api"
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
  const [lastScan, setLastScan] = useState<ScanResponse | null>(null)

  const [services, setServices] = useState<ServiceStatus[]>([
    {
      name: "FastAPI + Semgrep Engine",
      desc: "SAST & security rule evaluation",
      port: "8000",
      url: "http://localhost:8000/health",
      status: "checking",
    },
    {
      name: "Next.js 16 App Router",
      desc: "ZettaGuard UI & ASPM telemetry platform",
      port: "3000",
      url: "/",
      status: "online",
      latency: 12,
    },
  ])

  const runHealthCheck = useCallback(async () => {
    setChecking(true)

    // Checar FastAPI (porta 8000)
    const t0 = performance.now()
    const result = await checkBackendHealth()
    const latency = Math.round(performance.now() - t0)

    setServices((prev) =>
      prev.map((s) => {
        if (s.port === "8000") {
          return {
            ...s,
            status: result.status === "online" ? "online" : "offline",
            latency: result.status === "online" ? latency : undefined,
            detail:
              result.status === "online"
                ? `Engine: ${result.semgrep ?? "ok"} | Gemini: ${result.gemini ?? "ok"}`
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
    setLastScan(loadScanResult())
  }, [runHealthCheck])

  const dockerInfoCards = [
    {
      label: t.devops.orchestration,
      value: "docker-compose.yml",
      sub: t.devops.orchestrationSub,
      icon: Layers,
    },
    {
      label: t.devops.internalNetwork,
      value: "bridge driver",
      sub: t.devops.internalNetworkSub,
      icon: Network,
    },
    {
      label: t.devops.backendBase,
      value: "fastapi + uvicorn",
      sub: t.devops.backendBaseSub,
      icon: Cpu,
    },
    {
      label: t.devops.frontendBase,
      value: "standalone build",
      sub: t.devops.frontendBaseSub,
      icon: Container,
    },
  ]

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header com Ação de Verificação */}
      <div className="saas-card p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-primary/10 border border-primary/30 text-primary">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-heading text-base font-bold text-foreground">
                {t.devops.serviceHealth}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {lastCheck
                  ? t.devops.lastCheck.replace("{time}", lastCheck.toLocaleTimeString())
                  : t.devops.checkingInitial}
              </p>
            </div>
          </div>

          <button
            id="btn-recheck-health"
            onClick={runHealthCheck}
            disabled={checking}
            className="btn-electric px-4 py-2 text-xs font-bold shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", checking && "animate-spin")} />
            {checking ? t.devops.testing + "..." : t.devops.checkNow}
          </button>
        </div>
      </div>

      {/* Grid de Serviços */}
      <div className="grid gap-4 md:grid-cols-2">
        {services.map((svc) => {
          const isOnline = svc.status === "online"
          const isChecking = svc.status === "checking"

          return (
            <div
              key={svc.name}
              className={cn(
                "saas-card p-5 space-y-4 border-l-[3px]",
                isOnline ? "border-l-emerald-500" : isChecking ? "border-l-amber-500" : "border-l-rose-500"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-card border border-border text-primary mt-0.5">
                    {svc.port === "8000" ? <Server className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-bold text-foreground truncate">{svc.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{svc.desc}</p>
                  </div>
                </div>

                <div className="shrink-0">
                  {isChecking ? (
                    <span className="flex items-center gap-1.5 bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                      <RefreshCw className="h-3 w-3 animate-spin" /> {t.devops.testing}
                    </span>
                  ) : isOnline ? (
                    <span className="flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-500 border border-emerald-500/25">
                      <CheckCircle2 className="h-3 w-3" /> {t.devops.online}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 bg-rose-500/10 px-2.5 py-1 text-[11px] font-bold text-rose-500 border border-rose-500/25">
                      <XCircle className="h-3 w-3" /> {t.devops.offline}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="bg-muted/40 px-3 py-2 border border-border">
                  <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">{t.devops.port}</p>
                  <p className="font-mono font-bold text-foreground mt-0.5">{svc.port}</p>
                </div>
                <div className="bg-muted/40 px-3 py-2 border border-border">
                  <p className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">{t.devops.latency}</p>
                  <p className="font-mono font-bold text-foreground mt-0.5">
                    {svc.latency != null ? (
                      <span className={svc.latency < 200 ? "text-emerald-500 font-bold" : "text-amber-500 font-bold"}>
                        {svc.latency}ms
                      </span>
                    ) : isChecking ? "—" : svc.detail ?? "N/A"}
                  </p>
                </div>
              </div>

              {!isOnline && !isChecking && svc.detail && (
                <p className="text-xs text-rose-500 bg-rose-500/10 p-2.5 border border-rose-500/20">
                  {svc.detail}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* Docker Infra Bento */}
      <div>
        <h2 className="font-heading text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">
          {t.devops.architecture}
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {dockerInfoCards.map((c) => {
            const Icon = c.icon
            return (
              <div key={c.label} className="saas-card p-4 flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{c.label}</p>
                  <p className="truncate font-heading text-xs font-bold text-foreground mt-0.5">{c.value}</p>
                  <p className="truncate text-[10px] text-muted-foreground/70">{c.sub}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Last Scan Status */}
      <div className="saas-card p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="flex h-8 w-8 items-center justify-center bg-primary/10 text-primary">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-heading text-sm font-bold text-foreground">{t.devops.lastAudit}</h3>
            <p className="text-[11px] text-muted-foreground">{t.devops.aspmData}</p>
          </div>
        </div>

        {lastScan ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5 border border-border">
                <GitBranch className="h-3.5 w-3.5 text-primary" />
                <span className="font-mono text-foreground font-semibold">{lastScan.repositorio}</span>
              </div>
              {lastScan.scanned_at && (
                <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5 border border-border text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {new Date(lastScan.scanned_at).toLocaleString()}
                </div>
              )}
              <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5 border border-border text-muted-foreground">
                <Activity className="h-3.5 w-3.5 text-emerald-500" />
                {t.devops.analysisDuration.replace("{sec}", String(lastScan.tempo_segundos))}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: t.devops.total,    v: lastScan.total_vulnerabilidades, cls: "text-foreground" },
                { label: t.devops.criticas, v: lastScan.criticas,               cls: "text-rose-500 font-bold" },
                { label: t.devops.altas,    v: lastScan.altas,                  cls: "text-amber-500 font-bold" },
                { label: t.devops.medias,   v: lastScan.medias,                 cls: "text-indigo-500 font-bold" },
              ].map(item => (
                <div key={item.label} className="bg-muted/40 p-3 border border-border">
                  <p className={cn("font-heading text-xl font-extrabold", item.cls)}>{item.v}</p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-muted-foreground text-xs py-2">
            <WifiOff className="h-4 w-4 shrink-0 text-muted-foreground/50" />
            <span>{t.devops.noScanYet}</span>
          </div>
        )}
      </div>
    </div>
  )
}
