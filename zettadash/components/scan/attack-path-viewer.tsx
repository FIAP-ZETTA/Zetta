"use client"

import { useState, useEffect } from "react"
import { ArrowRight, X, Zap, CheckCircle2, ChevronRight } from "lucide-react"
import { type AttackPath } from "@/lib/zettascan-api"
import { cn } from "@/lib/utils"

interface AttackPathViewerProps {
  paths: AttackPath[]
  isOpen: boolean
  onClose: () => void
  onSelectVuln?: (file: string, line: string | number) => void
}

export function AttackPathViewer({
  paths,
  isOpen,
  onClose,
  onSelectVuln,
}: AttackPathViewerProps) {
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [selectedStepIdx, setSelectedStepIdx] = useState(0)

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const activePath = paths[selectedIdx] || paths[0]
  if (!activePath) return null

  const currentStep = activePath.steps[selectedStepIdx] || activePath.steps[0]
  const currentNode = activePath.nodes[selectedStepIdx] || activePath.nodes[0]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative flex flex-col w-full max-w-3xl bg-card border border-border shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* 1. Header Minimalista */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/10">
          <div>
            <h2 className="font-heading text-sm font-bold text-foreground">
              Caminho de Ataque Correlacionado
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Simulação de exploração encadeada entre código, segredos e infraestrutura
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors cursor-pointer"
            title="Fechar (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 2. Seletor de Cenários de Ataque (se houver mais de 1) */}
          {paths.length > 1 && (
            <div className="flex items-center gap-2 p-1 bg-muted/40 rounded-xl border border-border">
              {paths.map((p, i) => {
                const isActive = i === selectedIdx
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedIdx(i)
                      setSelectedStepIdx(0)
                    }}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all text-center flex items-center justify-center gap-2 cursor-pointer",
                      isActive
                        ? "bg-card text-foreground shadow-sm border border-border"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <span>Cenário {i + 1}: {p.titulo.split("(")[0].trim()}</span>
                    <span className="text-[10px] font-mono text-primary font-bold">
                      {p.probabilidade}% risco
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* 3. Stepper Linear Limpo (Linha de Progressão do Ataque) */}
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Etapas da Exploração
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {activePath.nodes.map((node, idx) => {
                const isSelected = selectedStepIdx === idx
                return (
                  <button
                    key={node.id}
                    onClick={() => setSelectedStepIdx(idx)}
                    className={cn(
                      "p-3 rounded-xl text-left transition-all border cursor-pointer space-y-1 relative",
                      isSelected
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border bg-muted/20 hover:bg-muted/40 text-muted-foreground"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cn(
                        "text-[10px] font-mono font-bold",
                        isSelected ? "text-primary" : "text-muted-foreground"
                      )}>
                        Passo {idx + 1}
                      </span>
                      {node.isChokepoint && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          Chokepoint
                        </span>
                      )}
                    </div>
                    <p className={cn(
                      "text-xs font-bold truncate",
                      isSelected ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {node.label}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 4. Detalhes da Etapa Selecionada (Claro e Direto) */}
          <div className="p-5 rounded-xl border border-border bg-card space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-primary font-bold">
                  Passo {selectedStepIdx + 1} • {currentStep.stage}
                </span>
                <h3 className="text-sm font-bold text-foreground mt-0.5">
                  {currentNode.label}
                </h3>
              </div>

              <span className="text-[10px] font-mono bg-muted text-muted-foreground px-2.5 py-1 rounded border border-border self-start sm:self-auto">
                Camada: {currentStep.source}
              </span>
            </div>

            {/* Explicação da ação */}
            <p className="text-xs text-muted-foreground leading-relaxed">
              {currentStep.action}
            </p>

            {/* Se esta etapa for o Chokepoint ou tiver arquivo associado */}
            {currentNode.isChokepoint && (
              <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs space-y-1">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                  <Zap className="h-3.5 w-3.5" />
                  <span>Ponto Crítico de Mitigação (Chokepoint)</span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {activePath.chokepoint.motivo}
                </p>
              </div>
            )}

            {/* Barra de Ação de Correção */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                <span>Arquivo afetado:</span>
                <strong className="text-foreground bg-muted px-2 py-0.5 rounded border border-border">
                  {activePath.chokepoint.arquivo}:{activePath.chokepoint.linha}
                </strong>
              </div>

              {onSelectVuln && (
                <button
                  onClick={() => {
                    onSelectVuln(activePath.chokepoint.arquivo, activePath.chokepoint.linha)
                    onClose()
                  }}
                  className="btn-electric px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 rounded-lg cursor-pointer shadow-sm"
                >
                  <span>Corrigir no Código</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
