"use client"

import { useState } from "react"
import { TrendingDown, TrendingUp, ShieldX, Siren, Clock, Activity } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { AttackChart } from "@/components/guard/attack-chart"
import { GeoMap } from "@/components/guard/geo-map"

type Status = "Bloqueado" | "Mitigado" | "Em análise" | "Permitido"

type Attack = {
  time: string
  type: string
  ip: string
  score: number
  status: Status
}

const attacks: Attack[] = [
  { time: "14:32:08", type: "SQL Injection", ip: "192.168.4.21", score: 94, status: "Bloqueado" },
  { time: "14:18:51", type: "Port Scan", ip: "203.0.113.9", score: 61, status: "Mitigado" },
  { time: "13:54:12", type: "Brute Force", ip: "198.51.100.7", score: 88, status: "Bloqueado" },
  { time: "13:40:33", type: "DDoS", ip: "45.33.12.0/24", score: 72, status: "Mitigado" },
  { time: "13:12:09", type: "XSS", ip: "172.16.0.45", score: 79, status: "Bloqueado" },
  { time: "12:47:55", type: "Path Traversal", ip: "10.0.0.18", score: 44, status: "Em análise" },
  { time: "12:30:21", type: "Credential Stuffing", ip: "203.0.113.55", score: 91, status: "Bloqueado" },
  { time: "11:58:40", type: "Bot Scraping", ip: "198.51.100.200", score: 33, status: "Permitido" },
  { time: "11:21:14", type: "CSRF", ip: "192.0.2.78", score: 67, status: "Mitigado" },
  { time: "10:45:02", type: "Command Injection", ip: "203.0.113.142", score: 96, status: "Bloqueado" },
  { time: "10:12:30", type: "Prompt Injection", ip: "185.220.101.5", score: 85, status: "Bloqueado" },
  { time: "09:55:17", type: "SSRF", ip: "198.51.100.88", score: 58, status: "Mitigado" },
]

const statusStyles: Record<Status, string> = {
  Bloqueado: "bg-destructive/15 text-destructive ring-1 ring-destructive/30",
  Mitigado: "bg-chart-4/15 text-chart-4 ring-1 ring-chart-4/30",
  "Em análise": "bg-chart-2/15 text-chart-2 ring-1 ring-chart-2/30",
  Permitido: "bg-primary/15 text-primary ring-1 ring-primary/30",
}

function scoreColor(score: number) {
  if (score >= 80) return "text-destructive"
  if (score >= 60) return "text-chart-4"
  return "text-primary"
}

function barColor(score: number) {
  if (score >= 80) return "bg-destructive"
  if (score >= 60) return "bg-chart-4"
  return "bg-primary"
}

const metrics = [
  {
    label: "Ataques hoje",
    value: "342",
    delta: "+8%",
    up: true,
    icon: Siren,
    accent: "text-destructive",
    ring: "ring-destructive/25",
    bg: "bg-destructive/10",
    spark: [28, 34, 22, 41, 38, 55, 47, 62],
  },
  {
    label: "Bloqueados",
    value: "318",
    delta: "+6%",
    up: true,
    icon: ShieldX,
    accent: "text-primary",
    ring: "ring-primary/25",
    bg: "bg-primary/10",
    spark: [24, 31, 19, 38, 35, 51, 44, 58],
  },
  {
    label: "Taxa de bloqueio",
    value: "92,9%",
    delta: "+1,2%",
    up: true,
    icon: Activity,
    accent: "text-chart-3",
    ring: "ring-chart-3/25",
    bg: "bg-chart-3/10",
    spark: [88, 90, 87, 91, 89, 92, 93, 93],
  },
  {
    label: "Score médio",
    value: "71",
    delta: "-3pts",
    up: false,
    icon: Clock,
    accent: "text-chart-4",
    ring: "ring-chart-4/25",
    bg: "bg-chart-4/10",
    spark: [78, 75, 80, 72, 70, 68, 71, 71],
  },
]

const allStatuses: (Status | "Todos")[] = ["Todos", "Bloqueado", "Mitigado", "Em análise", "Permitido"]

export default function ZettaGuardPage() {
  const [statusFilter, setStatusFilter] = useState<Status | "Todos">("Todos")

  const filtered = statusFilter === "Todos"
    ? attacks
    : attacks.filter(a => a.status === statusFilter)

  return (
    <div className="space-y-6">
      {/* Metric cards with sparklines */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {metrics.map((m) => {
          const Icon = m.icon
          const TrendIcon = m.up ? TrendingUp : TrendingDown
          const max = Math.max(...m.spark)
          return (
            <Card key={m.label} className="relative overflow-hidden p-4">
              <div className="flex items-start justify-between">
                <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg ring-1", m.bg, m.ring)}>
                  <Icon className={cn("h-4.5 w-4.5", m.accent)} aria-hidden />
                </div>
                <span className={cn(
                  "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                  m.up ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  <TrendIcon className="h-3 w-3" />
                  {m.delta}
                </span>
              </div>
              <div className="mt-3">
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="mt-0.5 font-heading text-2xl font-bold tracking-tight text-foreground">
                  {m.value}
                </p>
              </div>
              {/* Sparkline */}
              <div className="mt-3 flex h-8 items-end gap-0.5">
                {m.spark.map((v, i) => (
                  <span
                    key={i}
                    className={cn("flex-1 rounded-sm opacity-60", m.bg)}
                    style={{ height: `${(v / max) * 100}%` }}
                  />
                ))}
              </div>
            </Card>
          )
        })}
      </div>

      {/* Chart + Geo side by side */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AttackChart />
        </div>
        <GeoMap />
      </div>

      {/* Attack log with status filter */}
      <Card className="overflow-hidden p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 className="font-heading text-base font-semibold text-foreground">
              Histórico de ataques
            </h2>
            <p className="text-xs text-muted-foreground">
              Eventos de segurança detectados em tempo real
            </p>
          </div>
          {/* Status filter pills */}
          <div className="flex flex-wrap gap-1">
            {allStatuses.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 transition-all",
                  statusFilter === s
                    ? s === "Todos"
                      ? "bg-primary/15 text-primary ring-primary/30"
                      : statusStyles[s as Status]
                    : "bg-muted/50 text-muted-foreground ring-border hover:bg-muted"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="whitespace-nowrap">Horário</TableHead>
                <TableHead>Tipo de Ataque</TableHead>
                <TableHead>IP de Origem</TableHead>
                <TableHead className="w-48">Score de Risco</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a, i) => (
                <TableRow key={i} className="group">
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {a.time}
                  </TableCell>
                  <TableCell className="font-medium text-foreground">{a.type}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{a.ip}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full transition-all", barColor(a.score))}
                          style={{ width: `${a.score}%` }}
                        />
                      </div>
                      <span className={cn("font-mono text-xs font-semibold", scoreColor(a.score))}>
                        {a.score}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      className={cn(
                        "rounded-full border-0 px-2.5 py-0.5",
                        statusStyles[a.status]
                      )}
                    >
                      {a.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">
          {filtered.length} de {attacks.length} eventos exibidos
        </div>
      </Card>
    </div>
  )
}
