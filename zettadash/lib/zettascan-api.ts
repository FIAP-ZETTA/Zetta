/**
 * zettascan-api.ts
 * ----------------
 * Cliente TypeScript para a API do ZettaScan.
 * Alinhado com os schemas Pydantic definidos em api.py.
 */

const BASE_URL =
  process.env.NEXT_PUBLIC_ZETTASCAN_URL?.replace(/\/$/, "") ??
  "http://localhost:8000"

// ── Tipos (espelham os schemas Pydantic da api.py) ────────────────────────────

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
  /** Adicionado no cliente — não vem da API */
  scanned_at?: string
}

export interface ErrorResponse {
  status: "error"
  codigo: number
  mensagem: string
  detalhe?: string | null
}

// ── Funções de fetch ──────────────────────────────────────────────────────────

/**
 * Dispara um scan no repositório informado.
 * Pode demorar 1–5 minutos dependendo do tamanho do repo.
 */
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
      // FastAPI retorna { detail: ErrorResponse } em erros com HTTPException
      const body = await res.json()
      err = body?.detail ?? body
    } catch {
      err = { status: "error", codigo: res.status, mensagem: res.statusText }
    }
    throw new ZettaScanError(err.mensagem ?? "Erro desconhecido", res.status, err)
  }

  const data: ScanResponse = await res.json()
  data.scanned_at = new Date().toISOString()
  return data
}

/**
 * Health check — retorna true se o ZettaScan está no ar.
 */
export async function healthCheck(): Promise<{
  online: boolean
  latency?: number
  detail?: string
}> {
  const start = Date.now()
  try {
    const res = await fetch(`${BASE_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    })
    const latency = Date.now() - start
    if (!res.ok) return { online: false, latency, detail: `HTTP ${res.status}` }
    return { online: true, latency }
  } catch (e: any) {
    return { online: false, detail: e?.message ?? "Unreachable" }
  }
}

// ── LocalStorage helpers ──────────────────────────────────────────────────────

const LS_KEY = "zettascan:last_result"

export function saveScanResult(result: ScanResponse): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(result))
  } catch {
    /* quota exceeded — silently ignore */
  }
}

export function loadScanResult(): ScanResponse | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ScanResponse
  } catch {
    return null
  }
}

export function clearScanResult(): void {
  try {
    localStorage.removeItem(LS_KEY)
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
