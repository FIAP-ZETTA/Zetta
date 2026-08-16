"use client"

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card } from "@/components/ui/card"

const data = [
  { t: "00h", ameacas: 120, alertas: 12 },
  { t: "03h", ameacas: 98, alertas: 8 },
  { t: "06h", ameacas: 160, alertas: 18 },
  { t: "09h", ameacas: 240, alertas: 22 },
  { t: "12h", ameacas: 320, alertas: 34 },
  { t: "15h", ameacas: 280, alertas: 27 },
  { t: "18h", ameacas: 410, alertas: 41 },
  { t: "21h", ameacas: 360, alertas: 30 },
  { t: "24h", ameacas: 300, alertas: 24 },
]

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.dataKey === "ameacas" ? "Ameaças" : "Alertas"}:{" "}
          <span className="font-medium text-foreground">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

export function EventsTimeline() {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-base font-semibold text-foreground">Linha do tempo de eventos</h2>
          <p className="text-xs text-muted-foreground">Eventos de segurança nas últimas 24 horas</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-chart-1" /> Ameaças
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full bg-chart-5" /> Alertas
          </span>
        </div>
      </div>

      <div className="mt-4 h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="gAmeacas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gAlertas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-5)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="var(--chart-5)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="t" stroke="var(--muted-foreground)" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis stroke="var(--muted-foreground)" tickLine={false} axisLine={false} fontSize={12} />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="ameacas"
              stroke="var(--chart-1)"
              strokeWidth={2}
              fill="url(#gAmeacas)"
            />
            <Area
              type="monotone"
              dataKey="alertas"
              stroke="var(--chart-5)"
              strokeWidth={2}
              fill="url(#gAlertas)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
