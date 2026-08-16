"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card } from "@/components/ui/card"

const data = [
  { hora: "00h", bloqueados: 18, mitigados: 6 },
  { hora: "02h", bloqueados: 12, mitigados: 4 },
  { hora: "04h", bloqueados: 9, mitigados: 2 },
  { hora: "06h", bloqueados: 21, mitigados: 8 },
  { hora: "08h", bloqueados: 38, mitigados: 14 },
  { hora: "10h", bloqueados: 47, mitigados: 19 },
  { hora: "12h", bloqueados: 55, mitigados: 22 },
  { hora: "14h", bloqueados: 62, mitigados: 24 },
  { hora: "16h", bloqueados: 48, mitigados: 17 },
  { hora: "18h", bloqueados: 71, mitigados: 28 },
  { hora: "20h", bloqueados: 59, mitigados: 21 },
  { hora: "22h", bloqueados: 33, mitigados: 11 },
]

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ background: p.fill }} />
          {p.dataKey === "bloqueados" ? "Bloqueados" : "Mitigados"}:{" "}
          <span className="font-medium text-foreground">{p.value}</span>
        </p>
      ))}
    </div>
  )
}

export function AttackChart() {
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-base font-semibold text-foreground">
            Ataques por hora
          </h2>
          <p className="text-xs text-muted-foreground">Distribuição nas últimas 24h</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-sm bg-destructive" />
            Bloqueados
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-sm bg-chart-4" />
            Mitigados
          </span>
        </div>
      </div>

      <div className="mt-4 h-52 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="hora"
              stroke="var(--muted-foreground)"
              tickLine={false}
              axisLine={false}
              fontSize={11}
            />
            <YAxis
              stroke="var(--muted-foreground)"
              tickLine={false}
              axisLine={false}
              fontSize={11}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--muted)", opacity: 0.3 }} />
            <Bar dataKey="bloqueados" fill="var(--destructive)" radius={[3, 3, 0, 0]} opacity={0.85} />
            <Bar dataKey="mitigados" fill="var(--chart-4)" radius={[3, 3, 0, 0]} opacity={0.85} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
