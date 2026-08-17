"use client"

import { useState } from "react"
import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  Play,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  FileCode2,
  Lock,
  ChevronRight,
  CheckCircle2,
  Clock,
  Layers,
} from "lucide-react"
import {
  ATTACK_SCENARIOS,
  analyzePrompt,
  analyzeOutput,
  AnalyzeResult,
  OutputAnalyzeResult,
} from "@/lib/zettaguard-api"
import { useLanguage } from "@/lib/language-provider"
import { cn } from "@/lib/utils"

export function AttackSandbox() {
  const { t } = useLanguage()
  const [selectedScenario, setSelectedScenario] = useState<string>(ATTACK_SCENARIOS[0].id)
  const [promptText, setPromptText] = useState<string>(ATTACK_SCENARIOS[0].prompt)
  const [isOutputMode, setIsOutputMode] = useState<boolean>(false)
  const [outputText, setOutputText] = useState<string>(
    ATTACK_SCENARIOS[4].simulatedOutput || ""
  )
  const [analyzing, setAnalyzing] = useState<boolean>(false)
  const [analysisResult, setAnalysisResult] = useState<AnalyzeResult | null>(null)
  const [outputResult, setOutputResult] = useState<OutputAnalyzeResult | null>(null)
  const [latencyMs, setLatencyMs] = useState<number | null>(null)

  const handleSelectScenario = (sc: (typeof ATTACK_SCENARIOS)[0]) => {
    setSelectedScenario(sc.id)
    if (sc.id === "data-leakage") {
      setIsOutputMode(true)
      setOutputText(sc.simulatedOutput || "")
      setPromptText(sc.prompt)
    } else {
      setIsOutputMode(false)
      setPromptText(sc.prompt)
    }
    setAnalysisResult(null)
    setOutputResult(null)
  }

  const handleRunAnalysis = async () => {
    if (!promptText.trim() && !outputText.trim()) return

    setAnalyzing(true)
    const t0 = performance.now()

    if (isOutputMode) {
      const res = await analyzeOutput(outputText, promptText)
      const lat = Math.round(performance.now() - t0)
      setOutputResult(res)
      setAnalysisResult(null)
      setLatencyMs(lat)
    } else {
      const res = await analyzePrompt(promptText)
      const lat = Math.round(performance.now() - t0)
      setAnalysisResult(res)
      setOutputResult(null)
      setLatencyMs(lat)
    }

    setAnalyzing(false)
  }

  const handleReset = () => {
    const sc = ATTACK_SCENARIOS[0]
    setSelectedScenario(sc.id)
    setIsOutputMode(false)
    setPromptText(sc.prompt)
    setOutputText("")
    setAnalysisResult(null)
    setOutputResult(null)
    setLatencyMs(null)
  }

  return (
    <div className="saas-card p-5 space-y-5 border-primary/30 bg-card/80">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/30 text-primary shadow-sm">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-heading text-sm font-bold text-foreground uppercase tracking-wider">
              {t.guard.sandboxTitle}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {t.guard.sandboxSubtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIsOutputMode(!isOutputMode)
              setAnalysisResult(null)
              setOutputResult(null)
            }}
            className={cn(
              "px-3 py-1.5 rounded text-xs font-bold transition-all border",
              isOutputMode
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted text-muted-foreground border-border hover:text-foreground"
            )}
          >
            {isOutputMode ? "🔍 Modo Saída (L3)" : "🛡️ Modo Entrada (L1/L2)"}
          </button>

          <button
            onClick={handleReset}
            className="p-1.5 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Limpar / Resetar"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Preset Scenarios Selector */}
      <div className="space-y-2">
        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {t.guard.presetScenarios}
        </label>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ATTACK_SCENARIOS.map((sc) => (
            <button
              key={sc.id}
              onClick={() => handleSelectScenario(sc)}
              className={cn(
                "p-3 rounded-lg border text-left transition-all relative overflow-hidden flex flex-col justify-between",
                selectedScenario === sc.id
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border bg-card/40 hover:border-primary/40 hover:bg-muted/20"
              )}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-bold text-xs text-foreground truncate">
                    {sc.title}
                  </span>
                  <span
                    className={cn(
                      "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0",
                      sc.severity === "CRITICAL"
                        ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                        : sc.severity === "HIGH"
                        ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                        : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    )}
                  >
                    {sc.severity}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground line-clamp-2">
                  {sc.desc}
                </p>
              </div>
              <span className="mt-2 text-[9px] font-mono text-primary font-semibold truncate">
                {sc.owasp}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs">
          <label className="font-bold text-foreground flex items-center gap-2">
            {isOutputMode ? (
              <>
                <Lock className="h-3.5 w-3.5 text-primary" />
                Texto de Saída do Modelo a ser Inspecionado (L3):
              </>
            ) : (
              <>
                <FileCode2 className="h-3.5 w-3.5 text-primary" />
                Prompt de Entrada do Usuário (L1 + L2):
              </>
            )}
          </label>
          <span className="text-[11px] font-mono text-muted-foreground">
            {isOutputMode ? outputText.length : promptText.length} caracteres
          </span>
        </div>

        {isOutputMode ? (
          <textarea
            value={outputText}
            onChange={(e) => setOutputText(e.target.value)}
            rows={4}
            placeholder="Insira a resposta gerada pelo modelo para verificar vazamento de dados..."
            className="w-full rounded-lg border border-border bg-muted/40 p-3 text-xs font-mono text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
          />
        ) : (
          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            rows={4}
            placeholder={t.guard.customPromptPlaceholder}
            className="w-full rounded-lg border border-border bg-muted/40 p-3 text-xs font-mono text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
          />
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Layers className="h-3.5 w-3.5 text-primary" />
            <span>Motor ativo: <strong>L1 Regex (60+ padrões)</strong> + <strong>L2 Gemini IA</strong> + <strong>L3 Output</strong></span>
          </div>

          <button
            onClick={handleRunAnalysis}
            disabled={analyzing || (!promptText.trim() && !outputText.trim())}
            className="btn-electric px-6 py-2.5 text-xs font-bold uppercase tracking-wider flex items-center gap-2 shadow-lg disabled:opacity-50"
          >
            {analyzing ? (
              <>
                <Sparkles className="h-4 w-4 animate-spin" />
                {t.guard.analyzing}
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" />
                {t.guard.analyzeBtn}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Analysis Result Box */}
      {(analysisResult || outputResult) && (
        <div
          className={cn(
            "p-5 rounded-xl border animate-in fade-in slide-in-from-top-3 duration-300 space-y-4",
            (analysisResult?.decision === "Bloqueado" || outputResult?.decision === "Bloqueado")
              ? "border-rose-500/50 bg-rose-950/20"
              : (analysisResult?.decision === "Em análise" || outputResult?.decision === "Em análise")
              ? "border-amber-500/50 bg-amber-950/20"
              : "border-emerald-500/50 bg-emerald-950/20"
          )}
        >
          {/* Top Result Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3.5">
            <div className="flex items-center gap-3">
              {(analysisResult?.decision === "Bloqueado" || outputResult?.decision === "Bloqueado") ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/40">
                  <ShieldAlert className="h-6 w-6" />
                </div>
              ) : (analysisResult?.decision === "Em análise" || outputResult?.decision === "Em análise") ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
                  <AlertTriangle className="h-6 w-6" />
                </div>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  <ShieldCheck className="h-6 w-6" />
                </div>
              )}

              <div>
                <div className="flex items-center gap-2">
                  <span className="font-heading text-base font-extrabold text-foreground">
                    Decisão: {analysisResult?.decision || outputResult?.decision}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider font-mono",
                      (analysisResult?.decision === "Bloqueado" || outputResult?.decision === "Bloqueado")
                        ? "bg-rose-500 text-white"
                        : (analysisResult?.decision === "Em análise" || outputResult?.decision === "Em análise")
                        ? "bg-amber-500 text-black font-bold"
                        : "bg-emerald-500 text-white"
                    )}
                  >
                    {analysisResult?.primary_severity || "CRITICAL"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {analysisResult?.explanation || outputResult?.explanation}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  Score de Risco
                </span>
                <span
                  className={cn(
                    "font-heading text-2xl font-black font-mono",
                    (analysisResult?.score ?? outputResult?.score ?? 0) >= 65
                      ? "text-rose-400"
                      : (analysisResult?.score ?? outputResult?.score ?? 0) >= 35
                      ? "text-amber-400"
                      : "text-emerald-400"
                  )}
                >
                  {analysisResult?.score ?? outputResult?.score ?? 0}/100
                </span>
              </div>

              {latencyMs !== null && (
                <div className="border-l border-border/60 pl-3 text-right">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block flex items-center gap-1 justify-end">
                    <Clock className="h-3 w-3" /> Latência
                  </span>
                  <span className="font-mono text-xs font-bold text-foreground">
                    {latencyMs} ms
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Breakdown Grid */}
          {analysisResult && (
            <div className="grid gap-3 sm:grid-cols-3 pt-1 text-xs">
              {/* L1 Regex */}
              <div className="p-3 rounded-lg bg-card/70 border border-border space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">Camada 1 (Regex)</span>
                  <span
                    className={cn(
                      "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded",
                      analysisResult.layer1_triggered
                        ? "bg-rose-500/20 text-rose-300"
                        : "bg-emerald-500/20 text-emerald-300"
                    )}
                  >
                    {analysisResult.layer1_triggered ? "Disparado" : "Limpo"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Score: {analysisResult.regex_score} pts
                </p>
                {analysisResult.matched_patterns.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {analysisResult.matched_patterns.map((p) => (
                      <span
                        key={p}
                        className="font-mono text-[9px] bg-rose-500/10 text-rose-400 border border-rose-500/30 px-1.5 py-0.5 rounded font-bold"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* L2 AI Semantic */}
              <div className="p-3 rounded-lg bg-card/70 border border-border space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">Camada 2 (IA Gemini)</span>
                  <span
                    className={cn(
                      "text-[9px] font-mono font-bold px-1.5 py-0.5 rounded",
                      analysisResult.ai_classification
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {analysisResult.ai_classification ? "Classificado" : "L1 Conclusivo"}
                  </span>
                </div>
                {analysisResult.ai_classification ? (
                  <div className="space-y-1 text-[11px]">
                    <p className="text-foreground">
                      Tipo: <strong>{analysisResult.ai_classification.tipo}</strong> ({(analysisResult.ai_classification.confianca * 100).toFixed(0)}% conf.)
                    </p>
                    <p className="text-muted-foreground text-[10px] line-clamp-2">
                      {analysisResult.ai_classification.razao}
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Bloqueio instantâneo L1 sem latência extra
                  </p>
                )}
              </div>

              {/* Vector / Action */}
              <div className="p-3 rounded-lg bg-card/70 border border-border space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">Vetor & Categoria</span>
                  <span className="text-[9px] font-mono font-bold bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                    ASPM
                  </span>
                </div>
                <p className="text-[11px] font-semibold text-foreground">
                  {analysisResult.primary_category_label}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Ação: {analysisResult.decision === "Bloqueado" ? "Requisição descartada antes do LLM" : "Liberada para processamento"}
                </p>
              </div>
            </div>
          )}

          {outputResult && (
            <div className="p-3 rounded-lg bg-card/70 border border-border text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground">
                  Inspeção de Vazamento de Dados (Camada 3)
                </span>
                <span className="font-mono text-[9px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded font-bold">
                  Score: {outputResult.score}/100
                </span>
              </div>
              {outputResult.leaked_types.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-[11px]">Dados Detectados:</span>
                  {outputResult.leaked_types.map((t, idx) => (
                    <span
                      key={idx}
                      className="bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded text-[10px] font-bold"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
