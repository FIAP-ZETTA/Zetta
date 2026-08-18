"use client"

import { useEffect, useState } from "react"
import { getGuardStats, GuardStats } from "@/lib/zettaguard-api"
import { useLanguage } from "@/lib/language-provider"
import { cn } from "@/lib/utils"

interface LLMRiskCategory {
  id: string
  code: string
  title: string
  titleEn: string
  desc: string
  descEn: string
  categoryKey: string
  severity: "CRITICAL" | "HIGH" | "MEDIUM"
  mitigation: string
  mitigationEn: string
}

const OWASP_LLM_MATRIX: LLMRiskCategory[] = [
  {
    id: "llm01",
    code: "LLM01",
    title: "Prompt Injection",
    titleEn: "Prompt Injection",
    desc: "Manipulação de instruções de entrada para desviar o comportamento do modelo.",
    descEn: "Manipulation of input instructions to hijack model behavior.",
    categoryKey: "injection_direct",
    severity: "CRITICAL",
    mitigation: "Regex curados e classificação semântica",
    mitigationEn: "Curated regex and semantic classification",
  },
  {
    id: "llm02",
    code: "LLM01.2",
    title: "Jailbreak & Bypass de Políticas",
    titleEn: "Jailbreak & Policy Bypass",
    desc: "Técnicas de roleplay e personas ficcionais para burlar diretrizes éticas.",
    descEn: "Roleplay techniques and fictional personas to bypass guardrails.",
    categoryKey: "jailbreak",
    severity: "CRITICAL",
    mitigation: "Detecção de personas e score de risco",
    mitigationEn: "Persona detection and risk scoring",
  },
  {
    id: "llm03",
    code: "LLM02",
    title: "Exfiltração de Informações",
    titleEn: "Information Exfiltration",
    desc: "Tentativas de extrair segredos, chaves de API e variáveis de ambiente.",
    descEn: "Attempts to extract secrets, API keys and environment variables.",
    categoryKey: "exfiltration",
    severity: "HIGH",
    mitigation: "Bloqueio de solicitações de extração",
    mitigationEn: "Extraction request interception",
  },
  {
    id: "llm04",
    code: "LLM02.2",
    title: "Vazamento de Saída (L3)",
    titleEn: "Output Data Leakage (L3)",
    desc: "Exposição involuntária de dados sensíveis na resposta gerada pelo LLM.",
    descEn: "Inadvertent disclosure of sensitive data in LLM responses.",
    categoryKey: "data_leakage",
    severity: "CRITICAL",
    mitigation: "Inspeção heurística de saída",
    mitigationEn: "Heuristic output inspection",
  },
]

export function OwaspMatrix() {
  const { lang } = useLanguage()
  const [stats, setStats] = useState<GuardStats | null>(null)

  useEffect(() => {
    async function load() {
      const s = await getGuardStats()
      setStats(s)
    }
    load()
    window.addEventListener("zettaguard:event_added", load)
    return () => window.removeEventListener("zettaguard:event_added", load)
  }, [])

  return (
    <div className="saas-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-sm font-bold text-foreground uppercase tracking-wider">
            {lang === "en" ? "OWASP LLM Matrix" : "Matriz OWASP LLM"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lang === "en" ? "Active coverage of top AI security risks" : "Cobertura ativa das principais ameaças"}
          </p>
        </div>

        <span className="text-[10px] font-mono text-primary font-bold px-2 py-0.5 rounded border border-primary/30 bg-primary/10">
          {lang === "en" ? "4 Active Categories" : "4 Categorias Ativas"}
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {OWASP_LLM_MATRIX.map((item) => {
          const count = (stats?.by_category?.[item.categoryKey] || 0) +
            (item.categoryKey === "injection_direct" ? (stats?.by_category?.["injection_indirect"] || 0) : 0)

          const title = lang === "en" ? item.titleEn : item.title
          const desc = lang === "en" ? item.descEn : item.desc
          const mitigation = lang === "en" ? item.mitigationEn : item.mitigation

          return (
            <div
              key={item.id}
              className="p-3.5 rounded border border-border bg-card/60 flex flex-col justify-between hover:border-primary hover:bg-primary/[0.02] transition-all"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-primary font-bold px-1.5 py-0.2 rounded border border-primary/30 bg-primary/10">
                    {item.code}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-mono font-bold",
                      item.severity === "CRITICAL"
                        ? "text-rose-500"
                        : item.severity === "HIGH"
                        ? "text-amber-500"
                        : "text-emerald-500"
                    )}
                  >
                    {item.severity}
                  </span>
                </div>

                <div className="pt-0.5">
                  <h3 className="text-xs font-bold text-foreground leading-tight">
                    {title}
                  </h3>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed line-clamp-2">
                    {desc}
                  </p>
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-border flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground truncate max-w-[170px]">
                  {mitigation}
                </span>
                <span className="font-mono font-bold text-foreground bg-muted px-1.5 py-0.2 rounded border border-border">
                  {count} {lang === "en" ? "blocks" : "bloqueios"}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
