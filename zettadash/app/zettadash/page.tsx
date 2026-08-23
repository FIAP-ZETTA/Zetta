"use client"

import { MetricCards } from "@/components/dash/metric-cards"
import { AdvancedCharts } from "@/components/dash/advanced-charts"
import { RiskPostureCard } from "@/components/dash/risk-posture-card"
import { RecentActivity } from "@/components/dash/recent-activity"
import { AspmCoverageTracker } from "@/components/dash/aspm-coverage"
import { ComplianceKpis } from "@/components/dash/compliance-kpis"
import { RepoSelector } from "@/components/repo-selector"
import { useLanguage } from "@/lib/language-provider"
import { Plus, ArrowRight } from "lucide-react"
import Link from "next/link"

export default function ZettaDashDashboardPage() {
  const { t } = useLanguage()

  return (
    <div className="space-y-5 max-w-[1440px] mx-auto">
      {/* ── BARRA SUPERIOR (REPOSITÓRIO & AÇÕES) ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card border border-border p-3.5 shadow-sm rounded-xl">
        <RepoSelector />
        <div className="flex items-center gap-2">
          <Link
            href="/zettascan"
            className="btn-electric px-3.5 py-1.5 text-xs font-bold shrink-0 rounded-lg flex items-center gap-1.5"
          >
            {t.dash.viewDetailedAudit} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="/configuracoes"
            className="border border-border hover:border-primary/50 bg-card px-3 py-1.5 text-xs font-bold text-foreground shrink-0 inline-flex items-center gap-1.5 transition-colors rounded-lg"
          >
            <Plus className="h-3.5 w-3.5 text-primary" />
            {t.dash.newScan}
          </Link>
        </div>
      </div>

      {/* ── LINHA 1: GRÁFICO (ESQUERDA) + 4 MÉTRICAS 2x2 (DIREITA) ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Esquerda: Análise Visual de Segurança */}
        <div className="lg:col-span-6 flex flex-col">
          <AdvancedCharts />
        </div>

        {/* Direita: Grid 2x2 (Total, Altas, Críticas, Médias) */}
        <div className="lg:col-span-6 flex flex-col">
          <MetricCards layout="grid-2x2" />
        </div>
      </div>

      {/* ── LINHA 2: POSTURA DE SEGURANÇA (ESQUERDA) + KPIS (DIREITA) ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Esquerda: Postura de Segurança (Grau D / 12 pts) */}
        <div className="lg:col-span-5 flex flex-col">
          <RiskPostureCard />
        </div>

        {/* Direita: KPIs de Conformidade (MTTR, Tendência, OWASP Top 10) */}
        <div className="lg:col-span-7 flex flex-col">
          <ComplianceKpis />
        </div>
      </div>

      {/* ── LINHA 3: COBERTURA ASPM (ESQUERDA) + TOP FALHAS (DIREITA) ────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        {/* Esquerda: Cobertura ASPM (5 Camadas Code-to-Cloud) */}
        <div className="lg:col-span-6 flex flex-col">
          <AspmCoverageTracker compact={true} />
        </div>

        {/* Direita: Top Falhas Críticas / Atividades Recentes */}
        <div className="lg:col-span-6 flex flex-col">
          <RecentActivity />
        </div>
      </div>
    </div>
  )
}
