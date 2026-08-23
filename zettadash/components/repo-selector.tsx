"use client"

import { useEffect, useState, useRef } from "react"
import { GitBranch, ChevronDown, Check, Plus, Layers } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useLanguage } from "@/lib/language-provider"
import {
  getSavedRepositories,
  getActiveRepoUrl,
  setActiveRepoUrl,
  type ScanResponse,
} from "@/lib/zettascan-api"

interface RepoSelectorProps {
  onSelect?: (repoUrl: string | null) => void
  className?: string
}

export function RepoSelector({ onSelect, className }: RepoSelectorProps) {
  const { t } = useLanguage()
  const [repos, setRepos] = useState<ScanResponse[]>([])
  const [activeRepo, setActiveRepo] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  function refresh() {
    const list = getSavedRepositories()
    setRepos(list)
    setActiveRepo(getActiveRepoUrl())
  }

  useEffect(() => {
    refresh()
    const handler = () => refresh()
    window.addEventListener("zettascan:repo_change", handler)
    return () => window.removeEventListener("zettascan:repo_change", handler)
  }, [])

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function handleSelect(repoUrl: string | null) {
    setActiveRepoUrl(repoUrl)
    setActiveRepo(repoUrl)
    setOpen(false)
    if (onSelect) onSelect(repoUrl)
  }

  if (repos.length === 0) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground hidden sm:inline-block">
          {t.repoSelector.label}
        </span>
        <Link
          href="/configuracoes"
          className="flex items-center gap-2 bg-muted/30 border border-border hover:border-primary/50 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-all shadow-sm rounded-lg"
        >
          <GitBranch className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
          <span>Nenhum repositório conectado</span>
          <Plus className="h-3.5 w-3.5 text-primary ml-1 shrink-0" />
        </Link>
      </div>
    )
  }

  const selectedRepoObj = repos.find(
    r => r.repositorio.toLowerCase() === activeRepo?.toLowerCase()
  )

  return (
    <div className={cn("relative inline-block text-left", className)} ref={dropdownRef}>
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground hidden sm:inline-block">
          {t.repoSelector.label}
        </span>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2.5 bg-card border border-border hover:border-primary/50 px-3 py-1.5 text-xs text-foreground transition-all shadow-sm"
        >
          {activeRepo && selectedRepoObj ? (
            <div className="flex items-center gap-2 min-w-0">
              <GitBranch className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="font-mono font-bold truncate max-w-[220px]">
                {selectedRepoObj.repositorio.split("/").slice(-2).join("/")}
              </span>
              {selectedRepoObj.criticas > 0 && (
                <span className="bg-rose-500/15 text-rose-500 border border-rose-500/30 px-1.5 py-0.2 text-[10px] font-bold">
                  {selectedRepoObj.criticas} C
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Layers className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="font-bold text-foreground">
                {t.repoSelector.allRepos} ({repos.length})
              </span>
            </div>
          )}
          <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", open && "rotate-180")} />
        </button>
      </div>

      {/* Dropdown Menu */}
      {open && (
        <div className="absolute left-0 mt-1 z-50 w-72 sm:w-80 bg-card border border-border shadow-2xl animate-fade-up divide-y divide-border">
          {/* Opção 1: Consolidado (Todos) */}
          <div className="p-1.5">
            <button
              onClick={() => handleSelect(null)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors",
                !activeRepo ? "bg-primary/10 text-foreground font-bold border-l-2 border-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Layers className="h-4 w-4 text-primary shrink-0" />
                <div>
                  <p className="font-bold text-foreground leading-tight">{t.repoSelector.consolidated}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {t.repoSelector.consolidatedSub.replace("{count}", String(repos.length))}
                  </p>
                </div>
              </div>
              {!activeRepo && <Check className="h-4 w-4 text-primary shrink-0" />}
            </button>
          </div>

          {/* Opções individuais por repositório */}
          <div className="p-1.5 max-h-56 overflow-y-auto space-y-0.5">
            <p className="px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70">
              {t.repoSelector.connectedRepos}
            </p>
            {repos.map(r => {
              const isSelected = activeRepo?.toLowerCase() === r.repositorio.toLowerCase()
              const repoDisplay = r.repositorio.split("/").slice(-2).join("/")
              return (
                <button
                  key={r.repositorio}
                  onClick={() => handleSelect(r.repositorio)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-left text-xs transition-colors",
                    isSelected ? "bg-primary/10 text-foreground font-bold border-l-2 border-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <GitBranch className="h-3.5 w-3.5 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="font-mono text-foreground text-xs truncate leading-tight">{repoDisplay}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {r.total_vulnerabilidades} {t.repoSelector.findings} · <span className="text-rose-500 font-bold">
                          {t.repoSelector.criticalCount.replace("{count}", String(r.criticas))}
                        </span>
                      </p>
                    </div>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                </button>
              )
            })}
          </div>

          {/* Rodapé: Adicionar novo */}
          <div className="p-1.5 bg-muted/30">
            <Link
              href="/configuracoes"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/10 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              {t.repoSelector.connectNew}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
