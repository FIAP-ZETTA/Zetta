"use client"

import { MetricCards } from "@/components/dash/metric-cards"
import { AdvancedCharts } from "@/components/dash/advanced-charts"
import { RiskPostureCard } from "@/components/dash/risk-posture-card"
import { RecentActivity } from "@/components/dash/recent-activity"
import { RepoSelector } from "@/components/repo-selector"
import { useLanguage } from "@/lib/language-provider"
import { Plus, ArrowRight } from "lucide-react"
import Link from "next/link"

export default function ZettaDashDashboardPage() {
  const { t } = useLanguage()

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Selector Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border p-3.5 shadow-sm">
        <RepoSelector />
        <div className="flex items-center gap-2">
          <Link
            href="/zettascan"
            className="btn-electric px-3 py-1.5 text-xs font-bold shrink-0"
          >
            {t.dash.viewDetailedAudit} <ArrowRight className="h-3 w-3" />
          </Link>
          <Link
            href="/configuracoes"
            className="border border-border hover:border-primary/50 bg-card px-3 py-1.5 text-xs font-bold text-foreground shrink-0 inline-flex items-center gap-1.5 transition-colors"
          >
            <Plus className="h-3 w-3 text-primary" />
            {t.dash.newScan}
          </Link>
        </div>
      </div>

      {/* Metric summary cards */}
      <MetricCards />

      {/* Grid Principal: Gráfico Avançado + Postura de Risco + Atividades Recentes */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <AdvancedCharts />
        </div>
        <div className="space-y-6">
          <RiskPostureCard />
          <RecentActivity />
        </div>
      </div>
    </div>
  )
}
