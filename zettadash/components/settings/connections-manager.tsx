"use client"

import { useState } from "react"
import { Plus, ShieldCheck, Trash2, GitBranch, X } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScanForm } from "@/components/settings/scan-form"

type Repo = {
  id: string
  name: string
  lastSync: string
}

const initialRepos: Repo[] = [
  { id: "1", name: "github.com/empresa/core-api", lastSync: "Há 8 minutos" },
  { id: "2", name: "github.com/empresa/web-app", lastSync: "Há 2 horas" },
  { id: "3", name: "github.com/empresa/mobile-client", lastSync: "Ontem, 23:14" },
  { id: "4", name: "github.com/empresa/payments-service", lastSync: "Há 3 dias" },
]

export function ConnectionsManager() {
  const [repos, setRepos] = useState<Repo[]>(initialRepos)
  const [showForm, setShowForm] = useState(false)

  function revoke(id: string) {
    setRepos((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground text-balance">
            Configurações de Conectividade
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie os tokens de acesso aos repositórios de forma segura
          </p>
        </div>
        <Button
          onClick={() => setShowForm((s) => !s)}
          className="shrink-0 gap-2 bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
        >
          {showForm ? (
            <>
              <X className="h-4 w-4" /> Fechar
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" /> Conectar Novo Repositório
            </>
          )}
        </Button>
      </div>

      {/* Security notice */}
      <Card className="border-l-4 border-l-primary bg-primary/5 p-4">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">Segurança e Privacidade</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              O Zetta Guard utiliza permissões de somente leitura. Processamos o código, geramos o
              relatório e descartamos os dados imediatamente. Apenas trechos com vulnerabilidades reais
              são analisados pela IA.
            </p>
          </div>
        </div>
      </Card>

      {/* Connect form (toggle) */}
      {showForm && <ScanForm />}

      {/* Connected repositories */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-heading text-base font-semibold text-foreground">Repositórios conectados</h2>
          <span className="rounded-full bg-muted px-2.5 py-0.5 font-mono text-xs text-muted-foreground">
            {repos.length} {repos.length === 1 ? "conexão" : "conexões"}
          </span>
        </div>

        {repos.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-muted-foreground">Nenhum repositório conectado.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {repos.map((repo) => (
              <li
                key={repo.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <GitBranch className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm text-foreground">{repo.name}</p>
                    <p className="text-xs text-muted-foreground">Última sincronização: {repo.lastSync}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pl-12 sm:pl-0">
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 ring-1 ring-emerald-500/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                    Ativo (Somente Leitura)
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revoke(repo.id)}
                    className="gap-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Revogar Token</span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
