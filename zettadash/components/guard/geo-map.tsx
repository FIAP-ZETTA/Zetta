import { Globe } from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const origins = [
  { country: "Rússia", flag: "🇷🇺", attacks: 87, pct: 25 },
  { country: "China", flag: "🇨🇳", attacks: 71, pct: 21 },
  { country: "Brasil", flag: "🇧🇷", attacks: 54, pct: 16 },
  { country: "EUA", flag: "🇺🇸", attacks: 43, pct: 12 },
  { country: "Alemanha", flag: "🇩🇪", attacks: 29, pct: 8 },
  { country: "Índia", flag: "🇮🇳", attacks: 21, pct: 6 },
  { country: "Outros", flag: "🌐", attacks: 37, pct: 12 },
]

function barColor(idx: number) {
  const colors = [
    "bg-destructive",
    "bg-chart-5",
    "bg-chart-4",
    "bg-chart-2",
    "bg-chart-3",
    "bg-primary",
    "bg-muted-foreground",
  ]
  return colors[idx % colors.length]
}

export function GeoMap() {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
          <Globe className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <h2 className="font-heading text-sm font-semibold text-foreground">
            Origem dos ataques
          </h2>
          <p className="text-xs text-muted-foreground">Por país de origem do IP</p>
        </div>
      </div>

      <ul className="space-y-3">
        {origins.map((o, i) => (
          <li key={o.country} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-foreground">
                <span className="text-base leading-none">{o.flag}</span>
                {o.country}
              </span>
              <span className="font-mono text-muted-foreground">
                {o.attacks} <span className="text-muted-foreground/50">({o.pct}%)</span>
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full transition-all", barColor(i))}
                style={{ width: `${o.pct}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
