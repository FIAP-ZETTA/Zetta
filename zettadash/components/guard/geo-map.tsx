import { Globe } from "lucide-react"
import { useLanguage } from "@/lib/language-provider"

export function GeoMap() {
  const { t } = useLanguage()

  return (
    <div className="saas-card p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center bg-primary/10 border border-primary/30 text-primary">
          <Globe className="h-4 w-4" />
        </div>
        <div>
          <h2 className="font-heading text-sm font-bold text-foreground uppercase tracking-wider">
            {t.guard.attackOrigin}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">{t.guard.geoIP}</p>
        </div>
      </div>

      {/* Estado vazio */}
      <div className="flex flex-col items-center justify-center gap-2 py-12 border border-dashed border-border bg-muted/20">
        <Globe className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-xs text-muted-foreground/70 text-center">
          {t.guard.waitingTelemetry}
        </p>
      </div>
    </div>
  )
}
