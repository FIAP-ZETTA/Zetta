"use client"

import { useState } from "react"
import {
  ShieldAlert,
  ShieldCheck,
  Play,
  RotateCcw,
  Sparkles,
  AlertTriangle,
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
  const { t, lang } = useLanguage()
  const [promptText, setPromptText] = useState<string>(
    ATTACK_SCENARIOS[0].prompt
  )
  const [selectedScenario, setSelectedScenario] = useState<string>(
    ATTACK_SCENARIOS[0].id
  )
  const [isOutputMode, setIsOutputMode] = useState<boolean>(false)
  const [outputText, setOutputText] = useState<string>("")
  const [analyzing, setAnalyzing] = useState<boolean>(false)
  const [analysisResult, setAnalysisResult] = useState<AnalyzeResult | null>(
    null
  )
  const [outputResult, setOutputResult] = useState<OutputAnalyzeResult | null>(
    null
  )
  const [latencyMs, setLatencyMs] = useState<number | null>(null)

  const handleSelectScenario = (sc: (typeof ATTACK_SCENARIOS)[0]) => {
    setSelectedScenario(sc.id)
    if (sc.simulatedOutput) {
      setIsOutputMode(true)
      setOutputText(sc.simulatedOutput)
      setPromptText(sc.prompt)
    } else {
      setIsOutputMode(false)
      setPromptText(sc.prompt)
      setOutputText("")
    }
    setAnalysisResult(null)
    setOutputResult(null)
  }

  const handleRunAnalysis = async () => {
    setAnalyzing(true)
    const t0 = performance.now()

    if (isOutputMode) {
      const res = await analyzeOutput(outputText)
      setOutputResult(res)
      setAnalysisResult(null)
    } else {
      const res = await analyzePrompt(promptText)
      setAnalysisResult(res)
      setOutputResult(null)
    }

    const t1 = performance.now()
    setLatencyMs(Math.round(t1 - t0))
    setAnalyzing(false)
  }

  const handleReset = () => {
    setPromptText("")
    setOutputText("")
    setSelectedScenario("")
    setAnalysisResult(null)
    setOutputResult(null)
    setLatencyMs(null)
  }

  return (
    <div className="saas-card p-5 space-y-4">
      {/* Top Header com Toggle de Modo */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="font-heading text-sm font-bold text-foreground uppercase tracking-wider">
            {t.guard.sandboxTitle}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t.guard.sandboxSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Segmented Control */}
          <div className="flex items-center rounded border border-border bg-muted/40 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => {
                setIsOutputMode(false)
                setOutputResult(null)
              }}
              className={cn(
                "px-3 py-1 font-bold transition-all rounded",
                !isOutputMode
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {lang === "en" ? "Input (Prompt)" : "Entrada (Prompt)"}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsOutputMode(true)
                setAnalysisResult(null)
              }}
              className={cn(
                "px-3 py-1 font-bold transition-all rounded",
                isOutputMode
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {lang === "en" ? "Output (LLM)" : "Saída (LLM)"}
            </button>
          </div>

          <button
            onClick={handleReset}
            className="p-1.5 rounded border border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary transition-colors cursor-pointer"
            title={lang === "en" ? "Reset" : "Resetar"}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Preset Scenarios Selector */}
      <div className="space-y-2">
        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {t.guard.presetScenarios}
        </label>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {ATTACK_SCENARIOS.map((sc) => {
            const title = lang === "en" && sc.titleEn ? sc.titleEn : sc.title
            const desc = lang === "en" && sc.descEn ? sc.descEn : sc.desc
            const owasp = lang === "en" && sc.owaspEn ? sc.owaspEn : sc.owasp

            return (
              <button
                key={sc.id}
                onClick={() => handleSelectScenario(sc)}
                className={cn(
                  "p-3 rounded border text-left transition-all flex flex-col justify-between cursor-pointer",
                  selectedScenario === sc.id
                    ? "border-primary bg-primary/[0.07] shadow-sm"
                    : "border-border bg-card/60 hover:border-primary hover:bg-primary/[0.02]"
                )}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-xs text-foreground truncate">
                      {title}
                    </span>
                    <span
                      className={cn(
                        "text-[10px] font-mono font-bold",
                        sc.severity === "CRITICAL"
                          ? "text-rose-500"
                          : sc.severity === "HIGH"
                          ? "text-amber-500"
                          : sc.severity === "MEDIUM"
                          ? "text-sky-400"
                          : "text-emerald-500"
                      )}
                    >
                      {sc.severity}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                    {desc}
                  </p>
                </div>
                <span className={cn(
                  "mt-2 text-[10px] font-mono font-medium truncate",
                  selectedScenario === sc.id ? "text-primary font-bold" : "text-muted-foreground/80"
                )}>
                  {owasp}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Input Area */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between text-xs">
          <label className="font-bold text-foreground">
            {isOutputMode
              ? (lang === "en" ? "Model Output Text (L3)" : "Texto de Saída do Modelo (L3)")
              : (lang === "en" ? "User Prompt Input (L1/L2)" : "Prompt de Entrada (L1/L2)")}
          </label>
          <span className="text-[11px] font-mono text-muted-foreground">
            {isOutputMode ? outputText.length : promptText.length} {lang === "en" ? "characters" : "caracteres"}
          </span>
        </div>

        {isOutputMode ? (
          <textarea
            value={outputText}
            onChange={(e) => setOutputText(e.target.value)}
            rows={3}
            placeholder={lang === "en" ? "Enter model response to inspect for sensitive data leakage..." : "Insira a resposta gerada pelo modelo para verificar vazamento de dados..."}
            className="w-full rounded border border-border bg-muted/30 p-3 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed resize-none transition-colors"
          />
        ) : (
          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            rows={3}
            placeholder={t.guard.customPromptPlaceholder}
            className="w-full rounded border border-border bg-muted/30 p-3 text-xs font-mono text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed resize-none transition-colors"
          />
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-[11px] text-muted-foreground">
            {lang === "en" ? (
              <>Engine: <strong className="text-foreground">L1 Regex</strong> + <strong className="text-foreground">L2 Semantic AI</strong> + <strong className="text-foreground">L3 Output</strong></>
            ) : (
              <>Motor: <strong className="text-foreground">L1 Regex</strong> + <strong className="text-foreground">L2 IA Semântica</strong> + <strong className="text-foreground">L3 Saída</strong></>
            )}
          </p>

          <button
            onClick={handleRunAnalysis}
            disabled={analyzing || (!promptText.trim() && !outputText.trim())}
            className="btn-electric px-5 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-2 disabled:opacity-40 rounded-lg cursor-pointer"
          >
            {analyzing ? (
              <>
                <Sparkles className="h-3.5 w-3.5 animate-spin" />
                {t.guard.analyzing}
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                {t.guard.analyzeBtn}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Analysis Result Box */}
      {(analysisResult || outputResult) && (
        <div className="p-4 rounded-xl border border-primary/40 bg-primary/[0.02] space-y-3 pt-4 animate-in fade-in duration-200">
          {/* Top Result Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
            <div className="flex items-center gap-3">
              {(analysisResult?.decision === "Bloqueado" || outputResult?.decision === "Bloqueado") ? (
                <ShieldAlert className="h-5 w-5 text-rose-400" />
              ) : (analysisResult?.decision === "Em análise" || outputResult?.decision === "Em análise") ? (
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              ) : (
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
              )}

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">
                    {lang === "en" ? "Decision:" : "Decisão:"}{" "}
                    {(analysisResult?.decision === "Bloqueado" || outputResult?.decision === "Bloqueado")
                      ? t.guard.decisionBlocked
                      : (analysisResult?.decision === "Em análise" || outputResult?.decision === "Em análise")
                      ? t.guard.decisionReview
                      : t.guard.decisionAllowed}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border",
                      (analysisResult?.primary_severity === "CRITICAL")
                        ? "border-rose-500/30 text-rose-500 bg-rose-500/10"
                        : (analysisResult?.primary_severity === "HIGH")
                        ? "border-amber-500/30 text-amber-500 bg-amber-500/10"
                        : (analysisResult?.primary_severity === "MEDIUM")
                        ? "border-sky-500/30 text-sky-400 bg-sky-500/10"
                        : "border-emerald-500/30 text-emerald-500 bg-emerald-500/10"
                    )}
                  >
                    {analysisResult?.primary_severity || "CRITICAL"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {analysisResult?.explanation || outputResult?.explanation}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                  {t.guard.riskScore}
                </span>
                <span
                  className={cn(
                    "font-mono text-lg font-extrabold",
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
                <div className="border-l border-border pl-3 text-right">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block flex items-center gap-1 justify-end">
                    <Clock className="h-3 w-3 text-primary" /> {t.guard.latency}
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
            <div className="grid gap-2.5 sm:grid-cols-3 pt-1 text-xs">
              {/* L1 Regex */}
              <div className="p-3 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground text-[11px]">
                    {lang === "en" ? "Layer 1 (Regex)" : "Camada 1 (Regex)"}
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground font-semibold">
                    {analysisResult.layer1_triggered
                      ? (lang === "en" ? "Triggered" : "Disparado")
                      : (lang === "en" ? "Clean" : "Limpo")}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Score: {analysisResult.regex_score} pts
                </p>
              </div>

              {/* L2 AI Semantic */}
              <div className="p-3 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground text-[11px]">
                    {lang === "en" ? "Layer 2 (Gemini AI)" : "Camada 2 (IA Gemini)"}
                  </span>
                  <span className="text-[10px] font-mono text-primary font-bold">
                    {analysisResult.ai_classification
                      ? (lang === "en" ? "Classified" : "Classificado")
                      : (lang === "en" ? "L1 Direct" : "L1 Direto")}
                  </span>
                </div>
                {analysisResult.ai_classification ? (
                  <div className="space-y-0.5 text-[11px]">
                    <p className="text-foreground font-semibold">
                      {analysisResult.ai_classification.tipo} ({(analysisResult.ai_classification.confianca * 100).toFixed(0)}%)
                    </p>
                    <p className="text-muted-foreground text-[10px] line-clamp-2">
                      {analysisResult.ai_classification.razao}
                    </p>
                  </div>
                ) : (
                  <p className="text-[10px] text-muted-foreground">
                    {lang === "en" ? "Instant block by L1 heuristics" : "Bloqueio instantâneo por regras L1"}
                  </p>
                )}
              </div>

              {/* Vector / Action */}
              <div className="p-3 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground text-[11px]">
                    {lang === "en" ? "Vector & Action" : "Vetor & Ação"}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-primary">
                    ASPM
                  </span>
                </div>
                <p className="text-[11px] text-foreground font-bold">
                  {analysisResult.primary_category_label}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {analysisResult.decision === "Bloqueado"
                    ? (lang === "en" ? "Dropped before LLM" : "Descartado antes do LLM")
                    : (lang === "en" ? "Forwarded to model" : "Liberado para o modelo")}
                </p>
              </div>
            </div>
          )}

          {outputResult && (
            <div className="p-3 rounded-lg bg-card border border-border hover:border-primary/50 transition-colors text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground text-[11px]">
                  {lang === "en" ? "Output Inspection (L3)" : "Inspeção de Saída (L3)"}
                </span>
                <span className="font-mono text-[10px] font-bold text-primary">
                  Score: {outputResult.score}/100
                </span>
              </div>
              {outputResult.leaked_types && outputResult.leaked_types.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-muted-foreground text-[11px]">
                    {lang === "en" ? "Detected:" : "Detectados:"}
                  </span>
                  {outputResult.leaked_types.map((leak: string, idx: number) => (
                    <span
                      key={idx}
                      className="text-rose-400 border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.2 rounded text-[10px] font-mono font-bold"
                    >
                      {leak}
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
