"use client"

import { useEffect, useState } from "react"
import { ShieldCheck, ShieldAlert, Cpu, Sparkles, AlertTriangle, Eye, Lock } from "lucide-react"
import { getGuardStats, GuardStats } from "@/lib/zettaguard-api"
import { cn } from "@/lib/utils"

interface LLMRiskCategory {
  id: string
  code: string
  title: string
  desc: string
  categoryKey: string
  severity: "CRITICAL" | "HIGH" | "MEDIUM"
  icon: typeof ShieldAlert
  mitigation: string
}

const OWASP_LLM_MATRIX: LLMRiskCategory[] = [
  {
    id: "llm01",
    code: "LLM01:2025",
    title: "Prompt Injection (Direto & Indireto)",
    desc: "Manipulação da entrada do usuário para sobrescrever system prompts e regras de segurança.",
    categoryKey: "injection_direct",
    severity: "CRITICAL",
    icon: ShieldAlert,
    mitigation: "Camada 1 (Regex) + Camada 2 (Classificação Semântica Gemini)",
  },
  {
    id: "llm02",
    code: "LLM01.2:2025",
    title: "Jailbreak & Bypass de Políticas (DAN)",
    desc: "Técnicas de roleplay, modo de teste ou contexto ficcional para desarmar travas éticas.",
    categoryKey: "jailbreak",
    severity: "CRITICAL",
    icon: AlertTriangle,
    mitigation: "Detecção de personas maliciosas e score de risco cumulativo",
  },
  {
    id: "llm03",
    code: "LLM02:2025",
    title: "Sensitive Information Disclosure / Exfiltração",
    desc: "Tentativas de extrair segredos, chaves de API, credenciais ou conversas confidenciais.",
    categoryKey: "exfiltration",
    severity: "HIGH",
    icon: Eye,
    mitigation: "Bloqueio de solicitações de extração e saída mascarada",
  },
  {
    id: "llm04",
    code: "LLM02.2:2025",
    title: "Data Leakage na Saída do Modelo (L3)",
    desc: "Vazamento inadvertido de PII, CPFs, cartões ou tokens gerados na resposta do LLM.",
    categoryKey: "data_leakage",
    severity: "CRITICAL",
    icon: Lock,
    mitigation: "Camada 3 (Inspeção heurística de saída antes do retorno ao usuário)",
  },
]

export function OwaspMatrix() {
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
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/30 text-primary">
            <Cpu className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-heading text-sm font-bold text-foreground uppercase tracking-wider">
              Matriz OWASP Top 10 for LLMs
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Cobertura ativa das ameaças modernas de Inteligência Artificial
            </p>
          </div>
        </div>

        <span className="text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          100% Cobertura
        </span>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {OWASP_LLM_MATRIX.map((item) => {
          const Icon = item.icon
          const count = (stats?.by_category?.[item.categoryKey] || 0) +
            (item.categoryKey === "injection_direct" ? (stats?.by_category?.["injection_indirect"] || 0) : 0)

          return (
            <div
              key={item.id}
              className="p-3.5 rounded-lg border border-border bg-card/60 flex flex-col justify-between hover:border-primary/40 transition-colors"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                    {item.code}
                  </span>
                  <span
                    className={cn(
                      "text-[9px] font-bold px-1.5 py-0.5 rounded",
                      item.severity === "CRITICAL"
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                        : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                    )}
                  >
                    {item.severity}
                  </span>
                </div>

                <div className="flex items-start gap-2 pt-1">
                  <Icon className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-foreground leading-tight">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground truncate max-w-[190px]">
                  🛡️ {item.mitigation}
                </span>
                <span className="font-mono font-bold text-foreground bg-muted px-2 py-0.5 rounded border border-border">
                  {count} bloqueios
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
