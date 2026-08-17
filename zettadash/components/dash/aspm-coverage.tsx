"use client"

import { useLanguage } from "@/lib/language-provider"
import { loadConsolidatedScanResult, getActiveRepoUrl, loadDastResult } from "@/lib/zettascan-api"
import { getGuardStats } from "@/lib/zettaguard-api"
import { useEffect, useState } from "react"
import {
  Code2, Package, GitBranch, Server,
  CheckCircle2, Activity, Globe, ShieldCheck, ArrowRight
} from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"

type LayerStatus = "active" | "monitored" | "roadmap"

interface Layer {
  id: number
  key: string
  statusKey: LayerStatus
  icon: typeof Code2
  color: string
  bgColor: string
  borderColor: string
  poweredBy: string[]
  count?: number
  href?: string
}

export function AspmCoverageTracker({ compact = false }: { compact?: boolean }) {
  const { t } = useLanguage()
  const [hasScan, setHasScan] = useState(false)
  const [sastCount, setSastCount] = useState(0)
  const [scaCount, setScaCount] = useState(0)
  const [iacCount, setIacCount] = useState(0)
  const [dastCount, setDastCount] = useState<number | undefined>(undefined)
  const [guardCount, setGuardCount] = useState<number | undefined>(undefined)

  useEffect(() => {
    async function load() {
      const activeUrl = getActiveRepoUrl()
      const result = loadConsolidatedScanResult(activeUrl)
      const dastRes = loadDastResult()
      const guardStats = await getGuardStats()

      if (guardStats && guardStats.total > 0) {
        setGuardCount(guardStats.bloqueados)
      } else {
        setGuardCount(undefined)
      }

      if (dastRes) {
        setDastCount(dastRes.total_findings)
      } else {
        setDastCount(undefined)
      }

      if (result) {
        setHasScan(true)
        const vulns = result.vulnerabilidades ?? []
        setSastCount(vulns.filter(v => v.tipo === "codigo").length)
        setScaCount(vulns.filter(v => v.tipo === "dependencia").length)
        setIacCount((result as any).iac_total ?? vulns.filter(v => v.tipo === "iac").length)
      } else {
        setHasScan(false)
        setSastCount(0)
        setScaCount(0)
        setIacCount(0)
      }
    }
    load()
    window.addEventListener("zettascan:repo_change", load)
    window.addEventListener("zettascan:dast_change", load)
    window.addEventListener("zettaguard:event_added", load)
    return () => {
      window.removeEventListener("zettascan:repo_change", load)
      window.removeEventListener("zettascan:dast_change", load)
      window.removeEventListener("zettaguard:event_added", load)
    }
  }, [])

  const layers: Layer[] = [
    {
      id: 1,
      key: "layer1",
      statusKey: "active",
      icon: Code2,
      color: "text-sky-400",
      bgColor: "bg-sky-500/10",
      borderColor: "border-sky-500/30",
      poweredBy: ["Semgrep", "OWASP"],
      count: hasScan ? sastCount : undefined,
      href: "/zettascan?q=codigo",
    },
    {
      id: 2,
      key: "layer2",
      statusKey: "active",
      icon: Package,
      color: "text-violet-400",
      bgColor: "bg-violet-500/10",
      borderColor: "border-violet-500/30",
      poweredBy: ["OSV.dev", "CVEs"],
      count: hasScan ? scaCount : undefined,
      href: "/zettascan?q=dependencia",
    },
    {
      id: 3,
      key: "layer3",
      statusKey: "monitored",
      icon: GitBranch,
      color: "text-amber-400",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/30",
      poweredBy: ["CI/CD Gate", "GitHub"],
      count: hasScan ? iacCount : undefined,
      href: "/devops",
    },
    {
      id: 4,
      key: "layer4",
      statusKey: "monitored",
      icon: Server,
      color: "text-orange-400",
      bgColor: "bg-orange-500/10",
      borderColor: "border-orange-500/30",
      poweredBy: ["Docker", "Compose"],
      count: hasScan ? iacCount : undefined,
      href: "/devops",
    },
    {
      id: 5,
      key: "layer5",
      statusKey: "active",
      icon: ShieldCheck,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/30",
      poweredBy: ["ZettaGuard", "LLM WAF"],
      count: guardCount,
      href: "/zettaguard",
    },
  ]

  const statusConfig: Record<LayerStatus, { label: string; dotColor: string; textColor: string }> = {
    active: {
      label: "Ativo",
      dotColor: "bg-emerald-500",
      textColor: "text-emerald-500",
    },
    monitored: {
      label: "Monitorado",
      dotColor: "bg-amber-500",
      textColor: "text-amber-500",
    },
    roadmap: {
      label: "Roadmap",
      dotColor: "bg-muted-foreground/50",
      textColor: "text-muted-foreground",
    },
  }

  const layerLabels = [
    { title: "Código (SAST)", desc: "Estática e OWASP Top 10" },
    { title: "Dependências (SCA)", desc: "Vulnerabilidades CVEs" },
    { title: "Pipeline CI/CD", desc: "Quality Gate & Workflows" },
    { title: "Containers & IaC", desc: "Dockerfile & Infraestrutura" },
    { title: "Runtime & IA", desc: "ZettaGuard LLM Shield & DAST" },
  ]

  const activeCount = layers.filter(l => l.statusKey === "active").length
  const monitoredCount = layers.filter(l => l.statusKey === "monitored").length
  const coveragePct = Math.round(((activeCount + monitoredCount * 0.5) / layers.length) * 100)

  return (
    <div className="saas-card p-4 sm:p-5 space-y-3.5 w-full h-full flex flex-col justify-between">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-heading text-xs font-bold text-foreground">
              Cobertura ASPM
            </h3>
            <p className="text-[10px] text-muted-foreground">
              5 camadas Code-to-Cloud
            </p>
          </div>
        </div>

        {/* Coverage Badge */}
        <div className="flex items-center gap-2">
          <span className="font-heading text-base font-extrabold text-primary">
            {coveragePct}%
          </span>
          <span className="text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded">
            {activeCount}/5
          </span>
        </div>
      </div>

      {/* Grid das Camadas (Flex-1 para preencher altura exata) */}
      <div className={cn(
        "grid gap-2.5 flex-1",
        compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-5"
      )}>
        {layers.map((layer, idx) => {
          const Icon = layer.icon
          const info = layerLabels[idx]
          const status = statusConfig[layer.statusKey]

          return (
            <Link
              key={layer.id}
              href={layer.href || "/zettascan"}
              className={cn(
                "p-3 rounded-lg border border-border bg-card hover:border-primary/50 hover:bg-muted/20 transition-all group cursor-pointer flex-1 flex items-center justify-between gap-3",
                !compact && "flex-col justify-between space-y-3"
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg border shrink-0 transition-transform group-hover:scale-105",
                  layer.bgColor, layer.borderColor
                )}>
                  <Icon className={cn("h-4 w-4", layer.color)} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                    {info.title}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {layer.poweredBy[0]}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {layer.count !== undefined && (
                  <span className="text-[10px] font-mono font-bold text-foreground bg-muted px-2 py-0.5 rounded border border-border">
                    {layer.count}
                  </span>
                )}
                <span className={cn(
                  "text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1",
                  status.textColor, "bg-muted border border-border"
                )}>
                  <span className={cn("h-1.5 w-1.5 rounded-full", status.dotColor)} />
                  {status.label}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
