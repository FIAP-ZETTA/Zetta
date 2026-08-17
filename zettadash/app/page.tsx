"use client"

import Link from "next/link"
import {
  ScanLine,
  ShieldCheck,
  Container,
  Sparkles,
  GitBranch,
  ArrowRight,
  LayoutDashboard,
} from "lucide-react"
import { useLanguage } from "@/lib/language-provider"

export default function HomePage() {
  const { t } = useLanguage()

  return (
    <div className="relative min-h-[calc(100vh-8rem)] pb-16 overflow-hidden">
      {/* Hero Section Central */}
      <div className="relative z-10 flex flex-col items-center text-center pt-10 pb-12 max-w-4xl mx-auto px-4">
        {/* Headline */}
        <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-foreground leading-[1.1]">
          {t.home.heroTitle1} <br />
          <span className="text-primary">
            {t.home.heroTitle2}
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mt-4 text-xs sm:text-sm text-muted-foreground max-w-xl leading-relaxed">
          {t.home.heroSub}
        </p>
      </div>

      {/* Bento Grid Principal (Módulos do Sistema) */}
      <div className="relative z-10 max-w-6xl mx-auto grid gap-4 md:grid-cols-3 mb-4 px-2 sm:px-4">
        {/* Card 1: ZettaDash Dashboard */}
        <div className="saas-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <LayoutDashboard className="h-5 w-5 text-primary" />
              <h3 className="font-heading text-sm font-bold text-foreground uppercase tracking-wider">{t.home.card1Title}</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-6">
              {t.home.card1Desc}
            </p>
          </div>

          <Link
            href="/zettadash"
            className="btn-electric w-full py-2.5 text-xs font-bold uppercase tracking-wider"
          >
            {t.home.card1Btn}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Card 2: ZettaScan */}
        <div className="saas-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <ScanLine className="h-5 w-5 text-primary" />
              <h3 className="font-heading text-sm font-bold text-foreground uppercase tracking-wider">{t.home.card2Title}</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-6">
              {t.home.card2Desc}
            </p>
          </div>

          <Link
            href="/zettascan"
            className="btn-electric w-full py-2.5 text-xs font-bold uppercase tracking-wider"
          >
            {t.home.card2Btn}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Card 3: ZettaGuard */}
        <div className="saas-card p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <h3 className="font-heading text-sm font-bold text-foreground uppercase tracking-wider">{t.home.card3Title}</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-6">
              {t.home.card3Desc}
            </p>
          </div>

          <Link
            href="/zettaguard"
            className="btn-electric w-full py-2.5 text-xs font-bold uppercase tracking-wider"
          >
            {t.home.card3Btn}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Bento Grid Secundário (Diferenciais e Infraestrutura) */}
      <div className="relative z-10 max-w-6xl mx-auto grid gap-4 md:grid-cols-3 mb-6 px-2 sm:px-4">
        {/* Recurso 1: Conexões GitHub */}
        <div className="saas-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-2 text-foreground">
              <GitBranch className="h-4 w-4 text-primary" />
              <h4 className="font-heading text-xs font-bold uppercase tracking-wider">{t.home.feature1Title}</h4>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t.home.feature1Desc}
            </p>
          </div>
          <Link
            href="/configuracoes"
            className="mt-3 text-xs text-primary hover:underline font-bold inline-flex items-center gap-1"
          >
            {t.home.feature1Link} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {/* Recurso 2 */}
        <div className="saas-card p-5">
          <div className="flex items-center gap-2.5 mb-2 text-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            <h4 className="font-heading text-xs font-bold uppercase tracking-wider">{t.home.feature2Title}</h4>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t.home.feature2Desc}
          </p>
        </div>

        {/* Recurso 3: DevOps */}
        <div className="saas-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 mb-2 text-foreground">
              <Container className="h-4 w-4 text-primary" />
              <h4 className="font-heading text-xs font-bold uppercase tracking-wider">{t.home.feature3Title}</h4>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t.home.feature3Desc}
            </p>
          </div>
          <Link
            href="/devops"
            className="mt-3 text-xs text-primary hover:underline font-bold inline-flex items-center gap-1"
          >
            {t.home.feature3Link} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </div>
  )
}
