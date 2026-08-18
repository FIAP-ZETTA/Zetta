"use client"

import { useEffect, useState, useCallback } from "react"
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Search,
  Trash2,
  ChevronDown,
  ChevronUp,
  Clock,
} from "lucide-react"
import {
  getSecurityEvents,
  SecurityEvent,
  clearSecurityEvents,
} from "@/lib/zettaguard-api"
import { useLanguage } from "@/lib/language-provider"
import { cn } from "@/lib/utils"

export function EventsTable() {
  const { t, lang } = useLanguage()
  const [events, setEvents] = useState<SecurityEvent[]>([])
  const [total, setTotal] = useState<number>(0)
  const [searchTerm, setSearchTerm] = useState<string>("")
  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [decisionFilter, setDecisionFilter] = useState<string>("all")
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)

  const loadEvents = useCallback(async () => {
    const data = await getSecurityEvents(100)
    setEvents(data.events)
    setTotal(data.total)
  }, [])

  useEffect(() => {
    loadEvents()
    const handleUpdate = () => loadEvents()
    window.addEventListener("zettaguard:event_added", handleUpdate)
    return () => window.removeEventListener("zettaguard:event_added", handleUpdate)
  }, [loadEvents])

  const handleClear = () => {
    if (confirm(lang === "en" ? "Clear all security event history?" : "Deseja limpar o histórico de eventos?")) {
      clearSecurityEvents()
      loadEvents()
    }
  }

  const filteredEvents = events.filter((e) => {
    if (categoryFilter !== "all" && e.category !== categoryFilter) return false
    if (decisionFilter !== "all" && e.decision !== decisionFilter) return false
    if (searchTerm) {
      const q = searchTerm.toLowerCase()
      const inPrompt = e.prompt_snippet?.toLowerCase().includes(q)
      const inCat = e.category?.toLowerCase().includes(q)
      const inPats = e.matched_patterns?.some((p) => p.toLowerCase().includes(q))
      if (!inPrompt && !inCat && !inPats) return false
    }
    return true
  })

  return (
    <div className="saas-card overflow-hidden">
      {/* Table Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-4 sm:p-5">
        <div>
          <h2 className="font-heading text-sm font-bold text-foreground uppercase tracking-wider">
            {t.guard.incidentLog}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t.guard.securityEvents}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="bg-muted px-2.5 py-1 text-[10px] font-mono font-bold text-primary border border-primary/30 rounded">
            {lang === "en"
              ? `${filteredEvents.length} of ${total} events`
              : `${filteredEvents.length} de ${total} eventos`}
          </span>

          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:border-primary border border-border bg-card transition-colors"
          >
            <Trash2 className="h-3 w-3" />
            {lang === "en" ? "Clear" : "Limpar"}
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-border bg-muted/20 text-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder={lang === "en" ? "Filter by pattern, text or category..." : "Filtrar por padrão, texto ou categoria..."}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded border border-border bg-card pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded border border-border bg-card px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
        >
          <option value="all">{lang === "en" ? "All Categories" : "Todas as Categorias"}</option>
          <option value="injection_direct">Prompt Injection</option>
          <option value="jailbreak">Jailbreak</option>
          <option value="exfiltration">{lang === "en" ? "Exfiltration" : "Exfiltração"}</option>
          <option value="injection_indirect">{lang === "en" ? "Indirect Injection" : "Injeção Indireta"}</option>
          <option value="data_leakage">{lang === "en" ? "Output Leakage" : "Vazamento de Saída"}</option>
          <option value="none">{lang === "en" ? "Safe" : "Seguro"}</option>
        </select>

        <select
          value={decisionFilter}
          onChange={(e) => setDecisionFilter(e.target.value)}
          className="rounded border border-border bg-card px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors"
        >
          <option value="all">{lang === "en" ? "All Decisions" : "Todas as Decisões"}</option>
          <option value="Bloqueado">{t.guard.decisionBlocked}</option>
          <option value="Em análise">{t.guard.decisionReview}</option>
          <option value="Permitido">{t.guard.decisionAllowed}</option>
        </select>
      </div>

      {/* Table Body */}
      {filteredEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-1.5 py-12 text-center text-muted-foreground">
          <p className="text-xs">{t.guard.noEvents}</p>
          <p className="text-[11px] text-muted-foreground/70">
            {t.guard.noEventsSub}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {filteredEvents.map((evt) => {
            const isExpanded = expandedEventId === evt.id
            const isBlocked = evt.decision === "Bloqueado"
            const isReview = evt.decision === "Em análise"

            const decisionLabel = isBlocked
              ? t.guard.decisionBlocked
              : isReview
              ? t.guard.decisionReview
              : t.guard.decisionAllowed

            return (
              <div
                key={evt.id}
                className={cn(
                  "p-3.5 transition-all hover:bg-primary/[0.03] cursor-pointer",
                  isExpanded && "bg-primary/[0.05]"
                )}
                onClick={() => setExpandedEventId(isExpanded ? null : evt.id)}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-foreground">
                          {evt.category_label || evt.category}
                        </span>

                        <span
                          className={cn(
                            "text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border",
                            isBlocked
                              ? "border-rose-500/30 text-rose-400 bg-rose-500/10"
                              : isReview
                              ? "border-amber-500/30 text-amber-400 bg-amber-500/10"
                              : "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                          )}
                        >
                          {decisionLabel}
                        </span>

                        <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {new Date(evt.timestamp).toLocaleTimeString(lang === "en" ? "en-US" : "pt-BR")}
                        </span>
                      </div>

                      <p className="text-xs font-mono text-muted-foreground mt-1 line-clamp-1">
                        "{evt.prompt_snippet}"
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] text-muted-foreground block">
                        Score
                      </span>
                      <span
                        className={cn(
                          "font-mono text-xs font-bold",
                          evt.score >= 65
                            ? "text-rose-400"
                            : evt.score >= 35
                            ? "text-amber-400"
                            : "text-emerald-400"
                        )}
                      >
                        {evt.score}/100
                      </span>
                    </div>

                    <button className="text-muted-foreground hover:text-foreground">
                      {isExpanded ? (
                        <ChevronUp className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Details Drawer */}
                {isExpanded && (
                  <div
                    className="mt-3 pt-3 border-t border-border text-xs space-y-2 animate-in fade-in duration-150"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-3 rounded bg-card border border-border space-y-1.5 font-mono">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>
                          {lang === "en"
                            ? `Direction: ${evt.direction === "input" ? "Input (Prompt)" : "Output (LLM)"}`
                            : `Direção: ${evt.direction === "input" ? "Entrada (Prompt)" : "Saída (LLM)"}`}
                        </span>
                        <span>ID: {evt.id}</span>
                      </div>
                      <p className="text-foreground text-xs whitespace-pre-wrap leading-relaxed">
                        {evt.prompt_snippet}
                      </p>
                    </div>

                    {evt.matched_patterns && evt.matched_patterns.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] text-muted-foreground font-bold">
                          {lang === "en" ? "L1 Patterns:" : "Padrões L1:"}
                        </span>
                        {evt.matched_patterns.map((pat) => (
                          <span
                            key={pat}
                            className="font-mono text-[10px] text-rose-400 px-1.5 py-0.2 rounded border border-rose-500/30 bg-rose-500/10 font-bold"
                          >
                            {pat}
                          </span>
                        ))}
                      </div>
                    )}

                    {evt.ai_classification && (
                      <div className="p-2.5 rounded bg-card border border-border text-[11px] space-y-0.5">
                        <span className="text-[10px] text-primary font-bold font-mono block">
                          {lang === "en" ? "L2 Classification (Gemini)" : "Classificação L2 (Gemini)"}
                        </span>
                        <p className="text-foreground">
                          {evt.ai_classification.razao} ({t.guard.confidence}: {(evt.ai_classification.confianca * 100).toFixed(0)}%)
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
