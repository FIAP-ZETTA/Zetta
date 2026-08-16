"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  FolderGit2,
  Link2,
  KeyRound,
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
  ExternalLink,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { scanRepo, saveScanResult, ZettaScanError } from "@/lib/zettascan-api"

// Estágios exibidos durante a varredura real (são apenas visuais —
// o progresso real é controlado por um timer que avança lentamente
// enquanto aguardamos a resposta da API, que pode levar até 5 min)
const stages = [
  "Clonando repositório...",
  "Analisando dependências (OSV.dev)...",
  "Varrendo código-fonte (Semgrep)...",
  "Detectando vulnerabilidades...",
  "Priorizando com IA (Gemini)...",
]

export function ScanForm() {
  const router = useRouter()
  const [token, setToken] = useState("")
  const [repo, setRepo] = useState("")
  const [scanning, setScanning] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState(0)
  const [resultSummary, setResultSummary] = useState<{
    total: number; criticas: number; altas: number; tempo: number
  } | null>(null)

  // Abort controller para cancelar o fetch se o componente desmontar
  const abortRef = useRef<AbortController | null>(null)
  // Interval para o progresso animado
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  function startProgressAnimation() {
    // Progresso avança devagar até ~90% enquanto a API processa.
    // O salto para 100% acontece quando a API responder.
    setProgress(2)
    intervalRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 88) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          return 88
        }
        const increment = Math.random() * 1.5 + 0.5
        const next = Math.min(p + increment, 88)
        setStage(Math.min(Math.floor((next / 90) * stages.length), stages.length - 1))
        return next
      })
    }, 1800)
  }

  function stopProgressAnimation() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  async function startScan() {
    const repoUrl = repo.trim()
    const tok = token.trim()

    if (!repoUrl || !tok) {
      setError("Preencha a URL do repositório e o token antes de iniciar.")
      return
    }

    setScanning(true)
    setDone(false)
    setError(null)
    setProgress(0)
    setStage(0)
    setResultSummary(null)

    abortRef.current = new AbortController()
    startProgressAnimation()

    try {
      const result = await scanRepo(repoUrl, tok, abortRef.current.signal)
      stopProgressAnimation()
      saveScanResult(result)
      setProgress(100)
      setStage(stages.length - 1)
      setDone(true)
      setResultSummary({
        total: result.total_vulnerabilidades,
        criticas: result.criticas,
        altas: result.altas,
        tempo: result.tempo_segundos,
      })
    } catch (err: any) {
      stopProgressAnimation()
      if (err?.name === "AbortError") return // componente desmontado

      let msg = "Erro ao conectar ao ZettaScan."
      if (err instanceof ZettaScanError) {
        msg = err.message
      } else if (err?.message) {
        msg = err.message
      }
      setError(msg)
    } finally {
      setScanning(false)
    }
  }

  function cancelScan() {
    abortRef.current?.abort()
    stopProgressAnimation()
    setScanning(false)
    setProgress(0)
    setStage(0)
    setError(null)
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/30">
          <FolderGit2 className="h-5 w-5 text-primary" aria-hidden="true" />
        </div>
        <div>
          <h2 className="font-heading text-base font-semibold text-foreground">
            Conectar repositório
          </h2>
          <p className="text-xs text-muted-foreground">
            Conecte o GitHub para iniciar uma varredura de segurança real
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-5">
        {/* Token */}
        <div className="space-y-2">
          <Label htmlFor="token" className="flex items-center gap-2 text-sm">
            <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
            Token do GitHub
          </Label>
          <Input
            id="token"
            type="password"
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            disabled={scanning}
            className="font-mono"
          />
          <p className="text-[11px] text-muted-foreground">
            Use um token com permissão <code className="rounded bg-muted px-1 py-0.5">repo:read</code> (somente leitura)
          </p>
        </div>

        {/* Repo URL */}
        <div className="space-y-2">
          <Label htmlFor="repo" className="flex items-center gap-2 text-sm">
            <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
            URL do Repositório
          </Label>
          <Input
            id="repo"
            type="url"
            placeholder="https://github.com/org/projeto"
            value={repo}
            onChange={(e) => setRepo(e.target.value)}
            disabled={scanning}
          />
        </div>

        {/* Error banner */}
        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="shrink-0 opacity-70 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Action button */}
        <div className="flex gap-2">
          <Button
            onClick={startScan}
            disabled={scanning}
            className="flex-1 gap-2 bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
          >
            {scanning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Varredura em andamento...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Iniciar Scan
              </>
            )}
          </Button>
          {scanning && (
            <Button
              variant="outline"
              onClick={cancelScan}
              className="shrink-0 gap-1.5"
            >
              <X className="h-4 w-4" /> Cancelar
            </Button>
          )}
        </div>

        {/* Progress block */}
        {(scanning || done) && (
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between text-sm">
              <span
                className={cn(
                  "flex items-center gap-2",
                  done ? "text-primary" : "text-foreground"
                )}
              >
                {done ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Varredura concluída
                  </>
                ) : (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                    {stages[stage]}
                  </>
                )}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {Math.round(progress)}%
              </span>
            </div>

            <Progress value={progress} className="h-2" />

            {scanning && (
              <p className="text-[11px] text-muted-foreground">
                A varredura pode levar de 1 a 5 minutos dependendo do tamanho do repositório.
              </p>
            )}

            {done && resultSummary && (
              <div className="space-y-2">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-background/60 p-2">
                    <p className="font-heading text-lg font-bold text-foreground">
                      {resultSummary.total}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Total
                    </p>
                  </div>
                  <div className="rounded-md bg-background/60 p-2">
                    <p className="font-heading text-lg font-bold text-destructive">
                      {resultSummary.criticas}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Críticas
                    </p>
                  </div>
                  <div className="rounded-md bg-background/60 p-2">
                    <p className="font-heading text-lg font-bold text-chart-4">
                      {resultSummary.altas}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Altas
                    </p>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Tempo de análise: <span className="font-medium">{resultSummary.tempo}s</span>
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full gap-2 text-primary"
                  onClick={() => router.push("/zettascan")}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ver vulnerabilidades em ZettaScan
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  )
}
