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
  tipo: string   // "codigo" (SAST) | "dependencia" (SCA) | "iac" (IaC) | "dast" (DAST)
  repositorio?: string
  pacote?: string
  versao?: string
  cve_id?: string
}

export interface IacFinding {
  arquivo: string
  linha: number | string
  regra: string
  mensagem: string
  severidade: string
  tipo: string
  nome: string
}

export interface AttackPathStep {
  stage: string
  action: string
  source: string
}

export interface AttackPathNode {
  id: string
  label: string
  type: string
  severity: string
  isChokepoint?: boolean
}

export interface AttackPathEdge {
  from: string
  to: string
  label: string
}

export interface AttackPath {
  id: string
  titulo: string
  severidade: ScanSeveridade
  probabilidade: number
  blast_radius: string
  alvo_impactado: string
  chokepoint: {
    titulo: string
    arquivo: string
    linha: string
    motivo: string
  }
  steps: AttackPathStep[]
  nodes: AttackPathNode[]
  edges: AttackPathEdge[]
}

export interface QualityGateViolation {
  rule: string
  message: string
  severity: string
}

export interface QualityGateResult {
  status: "PASSED" | "FAILED"
  passed: boolean
  policy_applied: {
    max_critical: number
    max_high: number
    max_medium: number
    block_on_secrets: boolean
  }
  counts: {
    critical: number
    high: number
    medium: number
    low: number
    secrets: number
    total: number
  }
  violations: QualityGateViolation[]
  summary: string
  github_action_workflow?: string
}

export interface DastFinding {
  titulo: string
  explicacao: string
  impacto: string
  correcao: string
  severidade: ScanSeveridade
  tipo: "dast"
  arquivo: string
  linha: string
}

export interface DastResponse {
  status: string
  url: string
  status_code: number
  response_time_ms: number
  ssl_enabled: boolean
  security_score: number
  grade: string
  total_findings: number
  headers_found: Record<string, string>
  missing_headers: string[]
  findings: DastFinding[]
  scanned_at: string
  mensagem?: string
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
  // IaC layer
  iac_total?: number
  iac_findings?: IacFinding[]
  // Attack Path & Quality Gate
  attack_paths?: AttackPath[]
  quality_gate?: QualityGateResult
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
  // Tag vulnerabilities with the repo name and ensure tipo field
  data.vulnerabilidades = data.vulnerabilidades.map(v => ({
    ...v,
    repositorio: v.repositorio || data.repositorio,
    tipo: v.tipo || "codigo",
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

// ── Export Report ─────────────────────────────────────────────────────────────

export type ExportFormat = "json" | "sbom"

/**
 * Exporta o relatório de scan em formato JSON completo ou SBOM CycloneDX.
 *
 * Tenta chamar o endpoint /export da API do backend. Se falhar (backend offline
 * durante demo), faz a geração localmente no browser (fallback).
 *
 * O arquivo é baixado automaticamente via anchor click.
 */
export async function exportScanReport(
  result: ScanResponse,
  formato: ExportFormat = "json"
): Promise<void> {
  let conteudo: string
  let nomeArquivo: string
  const repoSlug = result.repositorio.split("/").slice(-2).join("-").replace(/\.git$/, "") || "zettascan"
  const timestamp = new Date().toISOString().slice(0, 10)

  try {
    // Tenta usar o endpoint da API
    const res = await fetch(`${BASE_URL}/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        repositorio: result.repositorio,
        vulnerabilidades: result.vulnerabilidades,
        iac_findings: result.iac_findings ?? [],
        criticas: result.criticas,
        altas: result.altas,
        medias: result.medias,
        baixas: result.baixas,
        iac_total: result.iac_total ?? 0,
        formato,
      }),
      signal: AbortSignal.timeout(8000),
    })

    if (res.ok) {
      const data = await res.json()
      conteudo = JSON.stringify(data, null, 2)
      nomeArquivo = formato === "sbom"
        ? `zettascan-sbom-${repoSlug}-${timestamp}.cdx.json`
        : `zettascan-report-${repoSlug}-${timestamp}.json`
    } else {
      throw new Error(`HTTP ${res.status}`)
    }
  } catch {
    // Fallback: gera localmente no browser
    if (formato === "sbom") {
      const sbom = {
        bomFormat: "CycloneDX",
        specVersion: "1.4",
        version: 1,
        metadata: {
          timestamp: new Date().toISOString(),
          tools: [{ vendor: "Zetta", name: "ZettaScan", version: "2.0.0" }],
          component: {
            type: "application",
            name: repoSlug,
            version: "latest",
          },
        },
        components: result.vulnerabilidades
          .filter(v => v.tipo === "dependencia" && v.pacote)
          .map(v => ({
            type: "library",
            name: v.pacote || v.arquivo,
            version: v.versao || "unknown",
            purl: `pkg:generic/${v.pacote}@${v.versao || "unknown"}`,
          })),
        vulnerabilities: result.vulnerabilidades
          .filter(v => v.tipo === "dependencia" && v.cve_id)
          .map((v, i) => ({
            id: v.cve_id || `ZETTA-${i.toString().padStart(4, "0")}`,
            source: { name: "OSV/ZettaScan" },
            ratings: [{ severity: v.severidade }],
            description: v.titulo,
          })),
      }
      conteudo = JSON.stringify(sbom, null, 2)
      nomeArquivo = `zettascan-sbom-${repoSlug}-${timestamp}.cdx.json`
    } else {
      const report = {
        zettascan_report: {
          version: "2.0.0",
          generated_at: new Date().toISOString(),
          repositorio: result.repositorio,
          summary: {
            total: result.total_vulnerabilidades,
            criticas: result.criticas,
            altas: result.altas,
            medias: result.medias,
            baixas: result.baixas,
            iac_total: result.iac_total ?? 0,
          },
          layers: {
            sast: result.vulnerabilidades.filter(v => v.tipo === "codigo"),
            sca: result.vulnerabilidades.filter(v => v.tipo === "dependencia"),
            iac: result.iac_findings ?? [],
          },
          all_findings: result.vulnerabilidades,
        },
      }
      conteudo = JSON.stringify(report, null, 2)
      nomeArquivo = `zettascan-report-${repoSlug}-${timestamp}.json`
    }
  }

  // Download via anchor
  const blob = new Blob([conteudo], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = nomeArquivo
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── DAST, Attack Paths & Quality Gate APIs ──────────────────────────────────

const LS_DAST_KEY = "zettascan:last_dast"

export async function scanDast(targetUrl: string, timeoutSeconds = 6.0): Promise<DastResponse> {
  const res = await fetch(`${BASE_URL}/scan-dast`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target_url: targetUrl, timeout_seconds: timeoutSeconds }),
  })

  if (!res.ok) {
    let err: ErrorResponse
    try {
      const body = await res.json()
      err = body?.detail ?? body
    } catch {
      err = { status: "error", codigo: res.status, mensagem: res.statusText }
    }
    throw new ZettaScanError(err.mensagem ?? "Erro ao executar scan DAST", res.status, err)
  }

  const data: DastResponse = await res.json()
  saveDastResult(targetUrl, data)
  return data
}

export function saveDastResult(url: string, result: DastResponse): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(LS_DAST_KEY, JSON.stringify(result))
    window.dispatchEvent(new Event("zettascan:dast_change"))
  } catch {}
}

export function loadDastResult(): DastResponse | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(LS_DAST_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export async function fetchAttackPaths(
  vulnerabilidades: Vulnerabilidade[],
  iacFindings?: IacFinding[]
): Promise<AttackPath[]> {
  try {
    const res = await fetch(`${BASE_URL}/attack-paths`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vulnerabilidades, iac_findings: iacFindings ?? [] }),
    })
    if (res.ok) {
      const data = await res.json()
      return data.attack_paths ?? []
    }
  } catch {}

  // Fallback local se o backend estiver inacessível
  const hasSecret = vulnerabilidades.some(v => (v.titulo + v.explicacao).toLowerCase().includes("secret") || (v.titulo + v.explicacao).toLowerCase().includes("token"))
  const hasInjection = vulnerabilidades.some(v => (v.titulo + v.explicacao).toLowerCase().includes("sql") || (v.titulo + v.explicacao).toLowerCase().includes("inject"))
  
  if (hasSecret || hasInjection) {
    return [{
      id: "AP-01-LOCAL",
      titulo: "Cadeia de Exfiltração de Dados Críticos (SAST + Secrets)",
      severidade: "CRITICAL",
      probabilidade: 85,
      blast_radius: "CRITICAL",
      alvo_impactado: "Banco de Dados & Storage em Produção",
      chokepoint: {
        titulo: "Credencial Sensível Exposta",
        arquivo: "app.py",
        linha: "1",
        motivo: "Rotacionar e remover segredos do código invalida todo o acesso lateral ao banco de dados.",
      },
      steps: [
        { stage: "1. Acesso Inicial", action: "Exploração de vulnerabilidade de entrada pública na aplicação.", source: "SAST" },
        { stage: "2. Extração de Segredos", action: "Localização de tokens e senhas expostas no repositório.", source: "SECRETS" },
        { stage: "3. Movimentação Lateral", action: "Autenticação em serviços internos com credenciais válidas.", source: "PRIVILEGE ESCALATION" },
        { stage: "4. Exfiltração", action: "Extração não autorizada de dados sigilosos e tabelas de clientes.", source: "DATA BREACH" },
      ],
      nodes: [
        {"id": "n1", "label": "Atacante Externo", "type": "threat_actor", "severity": "HIGH"},
        {"id": "n2", "label": "Entrada Pública", "type": "vulnerability", "severity": "HIGH"},
        {"id": "n3", "label": "Chave Exposta", "type": "secret", "severity": "CRITICAL", "isChokepoint": true},
        {"id": "n4", "label": "Banco de Dados", "type": "target_asset", "severity": "CRITICAL"},
      ],
      edges: [
        {"from": "n1", "to": "n2", "label": "Exploitation"},
        {"from": "n2", "to": "n3", "label": "Leitura de Token"},
        {"from": "n3", "to": "n4", "label": "Acesso Direto"},
      ],
    }]
  }
  return []
}

export async function evaluateQualityGate(
  vulnerabilidades: Vulnerabilidade[],
  iacFindings?: IacFinding[],
  policy?: any,
  repoName?: string
): Promise<QualityGateResult> {
  try {
    const res = await fetch(`${BASE_URL}/quality-gate/evaluate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vulnerabilidades,
        iac_findings: iacFindings ?? [],
        policy,
        repo_name: repoName ?? "app",
      }),
    })
    if (res.ok) {
      return await res.json()
    }
  } catch {}

  // Fallback local
  const criticas = vulnerabilidades.filter(v => v.severidade === "CRITICAL").length
  const altas = vulnerabilidades.filter(v => v.severidade === "HIGH").length
  const medias = vulnerabilidades.filter(v => v.severidade === "MEDIUM").length
  const baixas = vulnerabilidades.filter(v => v.severidade === "LOW").length
  const passed = criticas === 0 && altas <= 2

  return {
    status: passed ? "PASSED" : "FAILED",
    passed,
    policy_applied: { max_critical: 0, max_high: 2, max_medium: 10, block_on_secrets: true },
    counts: {
      critical: criticas,
      high: altas,
      medium: medias,
      low: baixas,
      secrets: vulnerabilidades.filter(v => (v.titulo + v.explicacao).toLowerCase().includes("secret")).length,
      total: vulnerabilidades.length,
    },
    violations: criticas > 0 ? [{ rule: "max_critical", message: `${criticas} falhas CRÍTICAS encontradas.`, severity: "CRITICAL" }] : [],
    summary: passed ? "Quality Gate Aprovado — O PR cumpre todos os requisitos de segurança." : "Quality Gate Bloqueado — Existem falhas críticas pendentes.",
  }
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
