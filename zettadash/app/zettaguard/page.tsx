"use client"

import { ShieldOff, Activity, ArrowRight, ShieldCheck, Globe, BarChart2 } from "lucide-react"
import { useLanguage } from "@/lib/language-provider"
import Link from "next/link"

export default function ZettaGuardPage() {
  const { t } = useLanguage()

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Banner Informativo */}
      <div className="saas-card p-5 border-chart-2/40 bg-chart-2/[0.02]">
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-chart-2/10 text-chart-2">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-heading text-sm font-bold text-foreground">{t.guard.bannerTitle}</h2>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              {t.guard.bannerDesc}
            </p>
            <div className="mt-3 flex items-center gap-2 text-[11px] text-emerald-500 font-bold">
              <Activity className="h-3.5 w-3.5" />
              <span>{t.guard.bannerStatus}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Métricas stubs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {[
          { label: t.guard.attacksDetected, color: "text-rose-500" },
          { label: t.guard.blockedWaf,      color: "text-primary" },
          { label: t.guard.mitigationRate,   color: "text-emerald-500" },
          { label: t.guard.protectionScore,  color: "text-amber-500" },
        ].map((m, i) => (
          <div key={i} className="saas-card p-4 sm:p-5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{m.label}</p>
            <p className={`mt-2 font-heading text-3xl font-extrabold ${m.color} opacity-30`}>—</p>
            <p className="mt-1 text-[10px] text-muted-foreground/60">{t.guard.waitingTelemetry}</p>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 saas-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-heading text-sm font-bold text-foreground">{t.guard.threatTrafficPerHour}</h3>
              <p className="text-[11px] text-muted-foreground">{t.guard.last24h}</p>
            </div>
          </div>
          <div className="flex h-48 flex-col items-center justify-center gap-2 border border-dashed border-border bg-muted/20">
            <BarChart2 className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">{t.guard.waitingWafData}</p>
          </div>
        </div>

        <div className="saas-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Globe className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-heading text-sm font-bold text-foreground">{t.guard.attackOrigin}</h3>
              <p className="text-[11px] text-muted-foreground">{t.guard.geoIP}</p>
            </div>
          </div>
          <div className="flex h-48 flex-col items-center justify-center gap-2 border border-dashed border-border bg-muted/20">
            <Globe className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground text-center">{t.guard.noSuspiciousTraffic}</p>
          </div>
        </div>
      </div>

      {/* Histórico vazio */}
      <div className="saas-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border p-5">
          <div>
            <h3 className="font-heading text-sm font-bold text-foreground">{t.guard.incidentLog}</h3>
            <p className="text-[11px] text-muted-foreground">{t.guard.securityEvents}</p>
          </div>
          <span className="bg-muted px-2.5 py-0.5 text-[11px] font-mono text-muted-foreground border border-border">
            0 {t.guard.incidentLog.toLowerCase()}
          </span>
        </div>
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center max-w-sm mx-auto">
          <div className="flex h-12 w-12 items-center justify-center bg-card border border-border">
            <ShieldOff className="h-6 w-6 text-muted-foreground/40" />
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-foreground">{t.guard.noEvents}</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {t.guard.noEventsSub}
            </p>
          </div>
          <Link
            href="/zettascan"
            className="btn-electric mt-2 px-4 py-2 text-xs font-bold"
          >
            {t.guard.viewSast} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}
