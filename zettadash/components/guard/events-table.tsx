"use client"

import { useEffect, useState, useCallback } from "react"
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Search,
  Filter,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Clock,
  Code2,
} from "lucide-react"
import {
  getSecurityEvents,
  SecurityEvent,
  clearSecurityEvents,
} from "@/lib/zettaguard-api"
import { useLanguage } from "@/lib/language-provider"
import { cn } from "@/lib/utils"

export function EventsTable() {
  const { t } = useLanguage()
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
    if (confirm("Deseja realmente limpar todo o histórico de eventos do ZettaGuard?")) {
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
        <div>
          <h3 className="font-heading text-sm font-bold text-foreground uppercase tracking-wider">
            {t.guard.incidentLog}
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {t.guard.securityEvents}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="bg-muted px-2.5 py-1 text-[11px] font-mono font-bold text-foreground border border-border rounded">
            {filteredEvents.length} de {total} eventos
          </span>

          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/20 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Limpar
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-2.5 p-3.5 border-b border-border bg-muted/20 text-xs">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filtrar por padrão, prompt ou categoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded border border-border bg-card pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded border border-border bg-card px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
        >
          <option value="all">Todas as Categorias</option>
          <option value="injection_direct">Prompt Injection</option>
          <option value="jailbreak">Jailbreak (DAN)</option>
          <option value="exfiltration">Exfiltração de Dados</option>
          <option value="injection_indirect">Injeção Indireta</option>
          <option value="data_leakage">Data Leakage</option>
          <option value="none">Seguro / Limpo</option>
        </select>

        <select
          value={decisionFilter}
          onChange={(e) => setDecisionFilter(e.target.value)}
          className="rounded border border-border bg-card px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
        >
          <option value="all">Todas as Decisões</option>
          <option value="Bloqueado">Bloqueados</option>
          <option value="Em análise">Em análise</option>
          <option value="Permitido">Permitidos</option>
        </select>
      </div>

      {/* Table Body */}
      {filteredEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
          <ShieldCheck className="h-8 w-8 text-muted-foreground/30" />
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

            return (
              <div
                key={evt.id}
                className={cn(
                  "p-4 transition-colors hover:bg-muted/30 cursor-pointer",
                  isExpanded && "bg-muted/40"
                )}
                onClick={() => setExpandedEventId(isExpanded ? null : evt.id)}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                        isBlocked
                          ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                          : isReview
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                          : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                      )}
                    >
                      {isBlocked ? (
                        <ShieldAlert className="h-4 w-4" />
                      ) : isReview ? (
                        <AlertTriangle className="h-4 w-4" />
                      ) : (
                        <ShieldCheck className="h-4 w-4" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-foreground">
                          {evt.category_label || evt.category}
                        </span>
                        <span
                          className={cn(
                            "text-[9px] font-mono font-bold px-1.5 py-0.2 rounded",
                            isBlocked
                              ? "bg-rose-500 text-white"
                              : isReview
                              ? "bg-amber-500 text-black font-bold"
                              : "bg-emerald-500 text-white"
                          )}
                        >
                          {evt.decision}
                        </span>
                        <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(evt.timestamp).toLocaleTimeString("pt-BR")}
                        </span>
                      </div>

                      <p className="text-xs font-mono text-muted-foreground mt-1 line-clamp-1">
                        "{evt.prompt_snippet}"
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
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
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Details Drawer */}
                {isExpanded && (
                  <div
                    className="mt-3 pt-3 border-t border-border/60 text-xs space-y-2.5 animate-in fade-in duration-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-3 rounded bg-card border border-border space-y-1.5 font-mono">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Direção: {evt.direction === "input" ? "Entrada (Prompt)" : "Saída (LLM)"}</span>
                        <span>ID: {evt.id}</span>
                      </div>
                      <p className="text-foreground text-xs whitespace-pre-wrap">
                        {evt.prompt_snippet}
                      </p>
                    </div>

                    {evt.matched_patterns && evt.matched_patterns.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] text-muted-foreground font-bold">
                          Padrões L1 disparados:
                        </span>
                        {evt.matched_patterns.map((pat) => (
                          <span
                            key={pat}
                            className="font-mono text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded"
                          >
                            {pat}
                          </span>
                        ))}
                      </div>
                    )}

                    {evt.ai_classification && (
                      <div className="p-2.5 rounded bg-primary/5 border border-primary/20 text-[11px] space-y-1">
                        <span className="font-bold text-primary flex items-center gap-1.5">
                          🤖 Classificação L2 (Gemini):
                        </span>
                        <p className="text-foreground">
                          {evt.ai_classification.razao} (Confiança: {(evt.ai_classification.confianca * 100).toFixed(0)}%, Risco: {evt.ai_classification.risco})
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
