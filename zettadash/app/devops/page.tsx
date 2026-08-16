"use client"

import { useEffect, useState, useCallback } from "react"
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Clock,
  Activity,
  Globe,
  GitBranch,
  Cpu,
  ScanLine,
  Wifi,
  WifiOff,
  Layers,
  HardDrive,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { healthCheck, loadScanResult, type ScanResponse } from "@/lib/zettascan-api"

type ServiceStatus = "online" | "offline" | "checking"

interface Service {
  id: string
  name: string
  description: string
  port: string
  status: ServiceStatus
  latency?: number
  detail?: string
  icon: any
}

const DOCKER_SERVICES: Array<Omit<Service, "status">> = [
  {
    id: "zettascan",
    name: "ZettaScan",
    description: "Motor de análise de segurança — FastAPI + Semgrep + Gemini",
    port: ":8000",
    icon: ScanLine,
  },
  {
    id: "zettadash",
    name: "ZettaDash",
    description: "Frontend dashboard — Next.js 16",
    port: ":3000",
    icon: Globe,
  },
]

const dockerInfoCards = [
  { label: "Orquestração", value: "Docker Compose", icon: Layers, sub: "docker-compose.yml" },
  { label: "Rede interna", value: "zetta_net", icon: Wifi, sub: "bridge driver" },
  { label: "Backend base", value: "Python 3.11", icon: Cpu, sub: "slim + multi-stage" },
  { label: "Frontend base", value: "Node 20", icon: HardDrive, sub: "slim + standalone" },
]

export default function DevOpsPage() {
  const [services, setServices] = useState<Service[]>(
    DOCKER_SERVICES.map((s) => ({ ...s, status: "checking" as ServiceStatus }))
  )
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastScan, setLastScan] = useState<ScanResponse | null>(null)

  useEffect(() => {
    setLastScan(loadScanResult())
  }, [])

  const checkServices = useCallback(async () => {
    setIsRefreshing(true)

    const zettscanHealth = await healthCheck()

    setServices([
      {
        id: "zettascan",
        name: "ZettaScan",
        description: "Motor de análise de segurança — FastAPI + Semgrep + Gemini",
        port: ":8000",
        icon: ScanLine,
        status: zettscanHealth.online ? "online" : "offline",
        latency: zettscanHealth.latency,
        detail: zettscanHealth.detail,
      },
      {
        id: "zettadash",
        name: "ZettaDash",
        description: "Frontend dashboard — Next.js 16",
        port: ":3000",
        icon: Globe,
        status: "online",
        latency: undefined,
      },
    ])

    setLastChecked(new Date())
    setIsRefreshing(false)
  }, [])

  useEffect(() => {
    checkServices()
  }, [checkServices])

  const onlineCount = services.filter((s) => s.status === "online").length
  const totalCount = services.length

  return (
    <div className="space-y-6">
      {/* Overall status banner */}
      <Card
        className={cn(
          "flex flex-wrap items-center justify-between gap-4 border-l-4 p-5",
          onlineCount === totalCount
            ? "border-l-chart-3 bg-chart-3/5"
            : onlineCount === 0
              ? "border-l-destructive bg-destructive/5"
              : "border-l-chart-4 bg-chart-4/5"
        )}
      >
        <div className="flex items-center gap-3">
          <Activity
            className={cn(
              "h-5 w-5",
              onlineCount === totalCount
                ? "text-chart-3"
                : onlineCount === 0
                  ? "text-destructive"
                  : "text-chart-4"
            )}
          />
          <div>
            <p className="font-heading text-sm font-semibold text-foreground">
              {onlineCount === totalCount
                ? "Todos os serviços operacionais"
                : `${onlineCount}/${totalCount} serviços online`}
            </p>
            {lastChecked && (
              <p className="text-xs text-muted-foreground">
                Último check: {lastChecked.toLocaleTimeString("pt-BR")}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={checkServices}
          disabled={isRefreshing}
          className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
          {isRefreshing ? "Verificando..." : "Verificar agora"}
        </button>
      </Card>

      {/* Service cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {services.map((svc) => {
          const Icon = svc.icon
          const isOnline = svc.status === "online"
          const isChecking = svc.status === "checking"
          return (
            <Card key={svc.id} className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1",
                      isOnline
                        ? "bg-chart-3/10 ring-chart-3/30"
                        : isChecking
                          ? "bg-muted ring-border"
                          : "bg-destructive/10 ring-destructive/30"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5",
                        isOnline
                          ? "text-chart-3"
                          : isChecking
                            ? "text-muted-foreground"
                            : "text-destructive"
                      )}
                    />
                  </div>
                  <div>
                    <p className="font-heading text-sm font-semibold text-foreground">
                      {svc.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{svc.description}</p>
                  </div>
                </div>

                <div className="shrink-0">
                  {isChecking ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      Verificando
                    </span>
                  ) : isOnline ? (
                    <span className="flex items-center gap-1.5 rounded-full bg-chart-3/15 px-2.5 py-1 text-xs font-medium text-chart-3 ring-1 ring-chart-3/30">
                      <CheckCircle2 className="h-3 w-3" />
                      Online
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 rounded-full bg-destructive/15 px-2.5 py-1 text-xs font-medium text-destructive ring-1 ring-destructive/30">
                      <XCircle className="h-3 w-3" />
                      Offline
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-muted/50 px-3 py-2">
                  <p className="text-muted-foreground">Porta</p>
                  <p className="font-mono font-medium text-foreground">{svc.port}</p>
                </div>
                <div className="rounded-md bg-muted/50 px-3 py-2">
                  <p className="text-muted-foreground">Latência</p>
                  <p className="font-mono font-medium text-foreground">
                    {svc.latency != null
                      ? `${svc.latency}ms`
                      : isChecking
                        ? "—"
                        : svc.detail ?? "N/A"}
                  </p>
                </div>
              </div>

              {!isOnline && !isChecking && svc.detail && (
                <p className="text-xs text-destructive/80 bg-destructive/5 rounded-md px-3 py-2">
                  {svc.detail}
                </p>
              )}
            </Card>
          )
        })}
      </div>

      {/* Docker infra info */}
      <div>
        <h2 className="font-heading text-base font-semibold text-foreground mb-3">
          Infraestrutura Docker
        </h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {dockerInfoCards.map((c) => {
            const Icon = c.icon
            return (
              <Card key={c.label} className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/25">
                  <Icon className="h-4.5 w-4.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {c.label}
                  </p>
                  <p className="truncate font-heading text-sm font-semibold text-foreground">
                    {c.value}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">{c.sub}</p>
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Last scan summary */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-heading text-base font-semibold text-foreground">
            Último scan realizado
          </h2>
        </div>
        {lastScan ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs">
                <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono text-foreground">{lastScan.repositorio}</span>
              </div>
              {lastScan.scanned_at && (
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {new Date(lastScan.scanned_at).toLocaleString("pt-BR")}
                </div>
              )}
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                <Activity className="h-3.5 w-3.5" />
                {lastScan.tempo_segundos}s de análise
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: "Total", v: lastScan.total_vulnerabilidades, cls: "text-foreground" },
                { label: "Críticas", v: lastScan.criticas, cls: "text-destructive" },
                { label: "Altas", v: lastScan.altas, cls: "text-chart-4" },
                { label: "Médias", v: lastScan.medias, cls: "text-chart-2" },
              ].map((item) => (
                <div key={item.label} className="rounded-lg bg-muted/40 p-3">
                  <p className={cn("font-heading text-xl font-bold", item.cls)}>{item.v}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-muted-foreground text-sm">
            <WifiOff className="h-4 w-4" />
            <span>
              Nenhum scan realizado ainda.{" "}
              <a
                href="/configuracoes"
                className="text-primary underline underline-offset-2"
              >
                Conecte um repositório
              </a>{" "}
              para iniciar.
            </span>
          </div>
        )}
      </Card>
    </div>
  )
}
