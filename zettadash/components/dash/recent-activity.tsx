import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const events = [
  { time: "14:32", text: "Tentativa de SQL Injection bloqueada", ip: "192.168.4.21", level: "high" },
  { time: "14:18", text: "Varredura de portas detectada", ip: "203.0.113.9", level: "medium" },
  { time: "13:54", text: "Login suspeito bloqueado", ip: "198.51.100.7", level: "high" },
  { time: "13:40", text: "Certificado TLS renovado", ip: "—", level: "info" },
  { time: "13:12", text: "Regra de firewall atualizada", ip: "—", level: "info" },
  { time: "12:47", text: "DDoS mitigado com sucesso", ip: "45.33.12.0/24", level: "medium" },
]

const levelStyles: Record<string, string> = {
  high: "bg-destructive",
  medium: "bg-chart-4",
  info: "bg-primary",
}

export function RecentActivity() {
  return (
    <Card className="p-5">
      <h2 className="font-heading text-base font-semibold text-foreground">Atividade recente</h2>
      <p className="text-xs text-muted-foreground">Últimos eventos do sistema</p>

      <ul className="mt-4 space-y-1">
        {events.map((e, i) => (
          <li key={i} className="flex gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50">
            <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", levelStyles[e.level])} />
            <div className="min-w-0 flex-1">
              <p className="text-sm leading-snug text-foreground">{e.text}</p>
              <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                {e.time} · {e.ip}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
