"use client"

import { useEffect, useState, useCallback } from "react"
import {
  Plus,
  ShieldCheck,
  GitBranch,
  X,
  Trash2,
  ArrowRight,
  RefreshCw,
  Layers,
  ExternalLink,
  ShieldAlert,
} from "lucide-react"
import { ScanForm } from "@/components/settings/scan-form"
import {
  getSavedRepositories,
  deleteSavedRepository,
  setActiveRepoUrl,
  getActiveRepoUrl,
  scanRepo,
  saveScanResult,
  type ScanResponse,
} from "@/lib/zettascan-api"
import { useLanguage } from "@/lib/language-provider"
import Link from "next/link"
import { useRouter } from "next/navigation"

export function ConnectionsManager() {
  const router = useRouter()
  const { t } = useLanguage()
  const [showForm, setShowForm] = useState(false)
  const [repos, setRepos] = useState<ScanResponse[]>([])
  const [activeRepo, setActiveRepo] = useState<string | null>(null)
  const [rescanningUrl, setRescanningUrl] = useState<string | null>(null)

  const loadRepos = useCallback(() => {
    const list = getSavedRepositories()
    setRepos(list)
    setActiveRepo(getActiveRepoUrl())
  }, [])

  useEffect(() => {
    loadRepos()
    const handler = () => loadRepos()
    window.addEventListener("zettascan:repo_change", handler)
    return () => window.removeEventListener("zettascan:repo_change", handler)
  }, [loadRepos])

  function handleDelete(url: string) {
    if (confirm(t.connections.confirmDelete.replace("{url}", url))) {
      deleteSavedRepository(url)
      loadRepos()
    }
  }

  async function handleRescan(r: ScanResponse) {
    setRescanningUrl(r.repositorio)
    try {
      const updated = await scanRepo(r.repositorio, "")
      saveScanResult(updated)
      loadRepos()
    } catch (e: any) {
      alert(`Falha ao re-escanear ${r.repositorio}: ${e?.message ?? e}`)
    } finally {
      setRescanningUrl(null)
    }
  }

  function handleSelectAndNavigate(url: string, path: string) {
    setActiveRepoUrl(url)
    router.push(path)
  }

  function handleScanDone() {
    loadRepos()
    setShowForm(false)
  }

  const totalFindings = repos.reduce((acc, r) => acc + (r.total_vulnerabilidades || 0), 0)
  const totalCriticas = repos.reduce((acc, r) => acc + (r.criticas || 0), 0)

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-foreground">
            {t.connections.title}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {t.connections.subtitle}
          </p>
        </div>
        <button
          id="btn-connect-repo"
          onClick={() => setShowForm(s => !s)}
          className="btn-electric px-4 py-2 text-xs font-bold uppercase tracking-wider shrink-0"
        >
          {showForm ? (
            <><X className="h-3.5 w-3.5" /> {t.connections.closeForm}</>
          ) : (
            <><Plus className="h-3.5 w-3.5" /> {t.connections.connectNew}</>
          )}
        </button>
      </div>

      {/* Cards de Resumo Multi-Repositório */}
      {repos.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="saas-card p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="font-bold uppercase tracking-wider text-[10px]">{t.connections.monitoredRepos}</span>
              <Layers className="h-4 w-4 text-primary" />
            </div>
            <p className="font-heading text-3xl font-extrabold text-foreground">{repos.length}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{t.connections.activeMonitoring}</p>
          </div>

          <div className="saas-card p-4 border-l-[3px] border-l-rose-500">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="font-bold uppercase tracking-wider text-[10px]">{t.connections.globalCriticals}</span>
              <ShieldAlert className="h-4 w-4 text-rose-500" />
            </div>
            <p className="font-heading text-3xl font-extrabold text-rose-500">{totalCriticas}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{t.connections.inAllProjects}</p>
          </div>

          <div className="saas-card p-4 border-l-[3px] border-l-primary">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="font-bold uppercase tracking-wider text-[10px]">{t.connections.totalFindings}</span>
              <GitBranch className="h-4 w-4 text-primary" />
            </div>
            <p className="font-heading text-3xl font-extrabold text-primary">{totalFindings}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{t.connections.mappedVulns}</p>
          </div>
        </div>
      )}

      {/* Security notice */}
      <div className="saas-card p-5 border-primary/30 bg-primary/[0.02]">
        <div className="flex gap-3.5">
          <ShieldCheck className="h-5 w-5 shrink-0 text-primary mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">{t.connections.privacyTitle}</h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {t.connections.privacyDesc}
            </p>
          </div>
        </div>
      </div>

      {/* Connect form toggle */}
      {showForm && <ScanForm onScanComplete={handleScanDone} />}

      {/* Lista de Repositórios Conectados */}
      <div className="saas-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="font-heading text-xs font-bold uppercase tracking-wider text-foreground">
            {t.connections.connectedListTitle.replace("{count}", String(repos.length))}
          </h3>
          {repos.length > 1 && (
            <button
              onClick={() => { setActiveRepoUrl(null); router.push("/zettadash") }}
              className="text-xs text-primary hover:underline font-bold inline-flex items-center gap-1"
            >
              {t.connections.viewConsolidatedInDash} <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>

        {repos.length === 0 ? (
          <div className="px-5 py-14 text-center space-y-3">
            <GitBranch className="h-10 w-10 text-muted-foreground/30 mx-auto" />
            <p className="text-sm font-semibold text-foreground">{t.connections.noRepoConnectedTitle}</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {t.connections.noRepoConnectedSub}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {repos.map((r) => {
              const repoDisplay = r.repositorio.split("/").slice(-2).join("/")
              const isRescanning = rescanningUrl === r.repositorio

              return (
                <div
                  key={r.repositorio}
                  className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors hover:bg-muted/20"
                >
                  {/* Informações do Repo */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-primary/10 border border-primary/30 text-primary mt-0.5">
                      <GitBranch className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-sm font-bold text-foreground truncate">
                          {repoDisplay}
                        </span>
                        <a
                          href={r.repositorio}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title={t.connections.openInGithub}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                      <p className="text-[11px] font-mono text-muted-foreground truncate max-w-md mt-0.5">
                        {r.repositorio}
                      </p>
                      {r.scanned_at && (
                        <p className="text-[10px] text-muted-foreground/70 mt-1">
                          {t.connections.lastScanTime.replace("{time}", new Date(r.scanned_at).toLocaleString()).replace("{sec}", String(r.tempo_segundos))}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Badges de Severidade & Ações */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Contadores */}
                    <div className="flex items-center gap-1.5 text-xs font-mono">
                      <span className="bg-muted px-2.5 py-1 text-foreground border border-border">
                        {t.connections.findingsBadge.replace("{count}", String(r.total_vulnerabilidades))}
                      </span>
                      {r.criticas > 0 && (
                        <span className="bg-rose-500/15 px-2.5 py-1 text-rose-500 border border-rose-500/30 font-bold">
                          {t.connections.criticalBadge.replace("{count}", String(r.criticas))}
                        </span>
                      )}
                      {r.altas > 0 && (
                        <span className="bg-amber-500/15 px-2.5 py-1 text-amber-500 border border-amber-500/30 font-bold">
                          {t.connections.highBadge.replace("{count}", String(r.altas))}
                        </span>
                      )}
                    </div>

                    {/* Botão Ver no ZettaScan */}
                    <button
                      onClick={() => handleSelectAndNavigate(r.repositorio, "/zettascan")}
                      className="btn-electric px-3 py-1.5 text-xs font-bold shrink-0"
                    >
                      ZettaScan <ArrowRight className="h-3 w-3" />
                    </button>

                    {/* Botão Ver no ZettaDash */}
                    <button
                      onClick={() => handleSelectAndNavigate(r.repositorio, "/zettadash")}
                      className="border border-border hover:border-primary/40 bg-card px-3 py-1.5 text-xs font-bold text-foreground shrink-0 transition-colors"
                    >
                      Dashboard
                    </button>

                    {/* Botão Re-escanear */}
                    <button
                      onClick={() => handleRescan(r)}
                      disabled={isRescanning}
                      className="flex items-center gap-1.5 border border-border bg-card hover:bg-muted hover:border-primary/40 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 shrink-0"
                      title={t.connections.rescan}
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isRescanning ? "animate-spin text-primary" : ""}`} />
                      <span className="hidden sm:inline">{isRescanning ? t.connections.rescanning : t.connections.rescan}</span>
                    </button>

                    {/* Botão Excluir */}
                    <button
                      onClick={() => handleDelete(r.repositorio)}
                      className="p-1.5 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors shrink-0"
                      title={t.connections.deleteConnection}
                      aria-label={t.connections.deleteConnection}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
