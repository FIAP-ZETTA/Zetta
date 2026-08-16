import { ShieldX, AlertTriangle, Server, TrendingUp, TrendingDown } from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const metrics = [
  {
    label: "Ameaças Bloqueadas",
    value: "48.392",
    delta: "+12,4%",
    up: true,
    icon: ShieldX,
    accent: "text-primary",
    ring: "ring-primary/25",
    bg: "bg-primary/10",
    spark: [12, 18, 14, 22, 19, 28, 24, 34],
  },
  {
    label: "Alertas Críticos",
    value: "27",
    delta: "+5",
    up: true,
    icon: AlertTriangle,
    accent: "text-destructive",
    ring: "ring-destructive/25",
    bg: "bg-destructive/10",
    spark: [4, 6, 5, 9, 7, 12, 10, 14],
  },
  {
    label: "Ativos Monitorados",
    value: "1.284",
    delta: "-0,8%",
    up: false,
    icon: Server,
    accent: "text-chart-3",
    ring: "ring-chart-3/25",
    bg: "bg-chart-3/10",
    spark: [30, 28, 31, 29, 27, 26, 25, 24],
  },
]

export function MetricCards() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {metrics.map((m) => {
        const Icon = m.icon
        const TrendIcon = m.up ? TrendingUp : TrendingDown
        const max = Math.max(...m.spark)
        return (
          <Card key={m.label} className="relative overflow-hidden p-5">
            <div className="flex items-start justify-between">
              <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg ring-1", m.bg, m.ring)}>
                <Icon className={cn("h-5 w-5", m.accent)} aria-hidden="true" />
              </div>
              <span
                className={cn(
                  "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                  m.up ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                <TrendIcon className="h-3 w-3" aria-hidden="true" />
                {m.delta}
              </span>
            </div>
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">{m.label}</p>
              <p className="mt-1 font-heading text-3xl font-bold tracking-tight text-foreground">{m.value}</p>
            </div>
            <div className="mt-4 flex h-10 items-end gap-1">
              {m.spark.map((v, i) => (
                <span
                  key={i}
                  className={cn("flex-1 rounded-sm", m.bg)}
                  style={{ height: `${(v / max) * 100}%` }}
                />
              ))}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
