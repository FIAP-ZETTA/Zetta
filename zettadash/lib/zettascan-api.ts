/**
 * zettascan-api.ts
 * ----------------
 * Cliente TypeScript para a API do ZettaScan com suporte multi-repositório.
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_ZETTASCAN_URL?.replace(/\/$/, "") ??
  "http://localhost:8000"

// ── Tipos ────────────────────────────────────────────────────────────────────

export type ScanSeveridade = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"

export interface Vulnerabilidade {
  titulo: string
  explicacao: string
  impacto: string
  correcao: string
  severidade: ScanSeveridade
  arquivo: string
  linha: number | string
  tipo: string
  repositorio?: string
}

export interface ScanResponse {
  status: string
  repositorio: string
  tempo_segundos: number
  total_vulnerabilidades: number
  criticas: number
  altas: number
  medias: number
  baixas: number
  vulnerabilidades: Vulnerabilidade[]
  scanned_at?: string
  token_preview?: string
}

export interface ErrorResponse {
  status: "error"
  codigo: number
  mensagem: string
  detalhe?: string | null
}

// ── Funções de fetch ──────────────────────────────────────────────────────────

export async function scanRepo(
  repoUrl: string,
  token: string,
  abortSignal?: AbortSignal
): Promise<ScanResponse> {
  const res = await fetch(`${BASE_URL}/scan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ repo_url: repoUrl, token }),
    signal: abortSignal,
  })

  if (!res.ok) {
    let err: ErrorResponse
    try {
      const body = await res.json()
      err = body?.detail ?? body
    } catch {
      err = { status: "error", codigo: res.status, mensagem: res.statusText }
    }
    throw new ZettaScanError(err.mensagem ?? "Erro desconhecido", res.status, err)
  }

  const data: ScanResponse = await res.json()
  data.scanned_at = new Date().toISOString()
  if (token) {
    data.token_preview = token.slice(0, 4) + "..." + token.slice(-4)
  }
  // Tag vulnerabilities with the repo name
  data.vulnerabilidades = data.vulnerabilidades.map(v => ({
    ...v,
    repositorio: v.repositorio || data.repositorio
  }))
  return data
}

export async function healthCheck(): Promise<{
  online: boolean
  status: "online" | "offline"
  latency?: number
  detail?: string
  semgrep?: string
  gemini?: string
}> {
  const start = Date.now()
  try {
    const res = await fetch(`${BASE_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    })
    const latency = Date.now() - start
    if (!res.ok) return { online: false, status: "offline", latency, detail: `HTTP ${res.status}` }
    const data = await res.json().catch(() => ({}))
    return {
      online: true,
      status: "online",
      latency,
      semgrep: data?.semgrep ?? "ok",
      gemini: data?.gemini ?? "ok",
      detail: data?.version ?? "v1.0",
    }
  } catch (e: any) {
    return { online: false, status: "offline", detail: e?.message ?? "Unreachable" }
  }
}

export const checkBackendHealth = healthCheck
export type BackendHealth = Awaited<ReturnType<typeof healthCheck>>

// ── Multi-Repository Storage Helpers ──────────────────────────────────────────

const LS_KEY = "zettascan:last_result"
const LS_REPOS_KEY = "zettascan:repositories"
const LS_ACTIVE_KEY = "zettascan:active_repo"

export function getSavedRepositories(): ScanResponse[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(LS_REPOS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as ScanResponse[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }

    // Auto-migração: se não tem array mas tem last_result, migra para a lista
    const single = loadScanResult()
    if (single) {
      const list = [single]
      localStorage.setItem(LS_REPOS_KEY, JSON.stringify(list))
      return list
    }
    return []
  } catch {
    return []
  }
}

export function saveScanResult(result: ScanResponse): void {
  if (typeof window === "undefined") return
  try {
    // 1. Salva como último resultado
    localStorage.setItem(LS_KEY, JSON.stringify(result))

    // 2. Salva ou atualiza na lista de repositórios
    const repos = getSavedRepositories()
    const index = repos.findIndex(r => r.repositorio.toLowerCase() === result.repositorio.toLowerCase())

    if (index >= 0) {
      repos[index] = result
    } else {
      repos.unshift(result)
    }

    localStorage.setItem(LS_REPOS_KEY, JSON.stringify(repos))
    localStorage.setItem(LS_ACTIVE_KEY, result.repositorio)
    window.dispatchEvent(new Event("zettascan:repo_change"))
  } catch {
    /* ignore */
  }
}

export function loadScanResult(): ScanResponse | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ScanResponse
  } catch {
    return null
  }
}

export function deleteSavedRepository(repoUrl: string): void {
  if (typeof window === "undefined") return
  try {
    let repos = getSavedRepositories()
    repos = repos.filter(r => r.repositorio.toLowerCase() !== repoUrl.toLowerCase())
    localStorage.setItem(LS_REPOS_KEY, JSON.stringify(repos))

    const active = getActiveRepoUrl()
    if (active && active.toLowerCase() === repoUrl.toLowerCase()) {
      localStorage.removeItem(LS_ACTIVE_KEY)
    }

    if (repos.length > 0) {
      localStorage.setItem(LS_KEY, JSON.stringify(repos[0]))
    } else {
      localStorage.removeItem(LS_KEY)
    }
    window.dispatchEvent(new Event("zettascan:repo_change"))
  } catch {
    /* ignore */
  }
}

export function getActiveRepoUrl(): string | null {
  if (typeof window === "undefined") return null
  try {
    return localStorage.getItem(LS_ACTIVE_KEY)
  } catch {
    return null
  }
}

export function setActiveRepoUrl(repoUrl: string | null): void {
  if (typeof window === "undefined") return
  try {
    if (repoUrl) {
      localStorage.setItem(LS_ACTIVE_KEY, repoUrl)
    } else {
      localStorage.removeItem(LS_ACTIVE_KEY)
    }
    window.dispatchEvent(new Event("zettascan:repo_change"))
  } catch {
    /* ignore */
  }
}

/**
 * Retorna os dados consolidados de todos os repositórios ou de um repositório específico selecionado.
 */
export function loadConsolidatedScanResult(selectedRepoUrl?: string | null): ScanResponse | null {
  const repos = getSavedRepositories()
  if (repos.length === 0) return null

  // Se um repositório específico foi selecionado
  if (selectedRepoUrl) {
    const target = repos.find(r => r.repositorio.toLowerCase() === selectedRepoUrl.toLowerCase())
    if (target) return target
  }

  // Se nenhum repositório específico foi selecionado e temos apenas 1 repositório
  if (repos.length === 1) {
    return repos[0]
  }

  // Visão consolidada (todos os repositórios juntos)
  const allVulns: Vulnerabilidade[] = []
  let totalCriticas = 0
  let totalAltas = 0
  let totalMedias = 0
  let totalBaixas = 0
  let maxTime = 0

  for (const r of repos) {
    totalCriticas += r.criticas || 0
    totalAltas += r.altas || 0
    totalMedias += r.medias || 0
    totalBaixas += r.baixas || 0
    maxTime = Math.max(maxTime, r.tempo_segundos || 0)

    for (const v of r.vulnerabilidades) {
      allVulns.push({
        ...v,
        repositorio: v.repositorio || r.repositorio
      })
    }
  }

  return {
    status: "ok",
    repositorio: `Consolidado (${repos.length} Repositórios)`,
    tempo_segundos: maxTime,
    total_vulnerabilidades: allVulns.length,
    criticas: totalCriticas,
    altas: totalAltas,
    medias: totalMedias,
    baixas: totalBaixas,
    vulnerabilidades: allVulns,
    scanned_at: repos[0]?.scanned_at,
  }
}

export function clearScanResult(): void {
  if (typeof window === "undefined") return
  try {
    localStorage.removeItem(LS_KEY)
    localStorage.removeItem(LS_REPOS_KEY)
    localStorage.removeItem(LS_ACTIVE_KEY)
    window.dispatchEvent(new Event("zettascan:repo_change"))
  } catch { /* ignore */ }
}

// ── Error class ───────────────────────────────────────────────────────────────

export class ZettaScanError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly body: ErrorResponse
  ) {
    super(message)
    this.name = "ZettaScanError"
  }
}
