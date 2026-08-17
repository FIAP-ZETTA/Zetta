import { BarChart2 } from "lucide-react"
import { useLanguage } from "@/lib/language-provider"

export function AttackChart() {
  const { t } = useLanguage()

  return (
    <div className="saas-card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center bg-primary/10 border border-primary/30 text-primary">
          <BarChart2 className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-heading text-sm font-bold text-foreground uppercase tracking-wider">
            {t.guard.threatTrafficPerHour}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t.guard.last24h}</p>
        </div>
      </div>

      {/* Estado vazio */}
      <div className="flex h-52 flex-col items-center justify-center gap-2 border border-dashed border-border bg-muted/20">
        <BarChart2 className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground/70 text-center">
          {t.guard.waitingWafData}
        </p>
      </div>
    </div>
  )
}
