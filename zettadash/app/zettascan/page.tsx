"use client"

import { useEffect, useState } from "react"
import { Search, ScanLine, Clock, GitBranch, RefreshCw } from "lucide-react"
import { VulnerabilityCard, type Vulnerability } from "@/components/scan/vulnerability-card"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { loadScanResult, type ScanResponse } from "@/lib/zettascan-api"

// ── Dados mock de fallback ────────────────────────────────────────────────────
const mockVulnerabilities: Vulnerability[] = [
  {
    id: "1",
    file: "src/api/auth.ts",
    line: 42,
    type: "SQL Injection",
    severity: "Crítica",
    description: "Concatenação direta de input do usuário em query SQL.",
    explicacao: "A query é montada com string interpolation, permitindo que um atacante quebre a estrutura SQL e execute comandos arbitrários no banco de dados.",
    impacto: "Exposição total do banco de dados, incluindo dados de usuários, senhas e informações confidenciais.",
    correcao: "Use prepared statements com parâmetros parametrizados: db.query('SELECT * FROM users WHERE email = $1', [email])",
    diff: [
      { type: "context", old: 40, new: 40, text: "export async function getUser(email: string) {" },
      { type: "remove", old: 41, text: "  const query = `SELECT * FROM users WHERE email = '${email}'`" },
      { type: "remove", old: 42, text: "  return db.raw(query)" },
      { type: "add", new: 41, text: "  const query = 'SELECT * FROM users WHERE email = $1'" },
      { type: "add", new: 42, text: "  return db.query(query, [email])" },
      { type: "context", old: 43, new: 43, text: "}" },
    ],
  },
  {
    id: "2",
    file: "src/components/Comment.tsx",
    line: 18,
    type: "Cross-Site Scripting (XSS)",
    severity: "Alta",
    description: "Renderização de HTML não sanitizado via dangerouslySetInnerHTML.",
    explicacao: "O conteúdo do campo 'body' é injetado diretamente no DOM sem sanitização, permitindo execução de scripts maliciosos.",
    impacto: "Roubo de sessão, redirecionamento malicioso e exfiltração de dados do usuário.",
    diff: [
      { type: "context", old: 16, new: 16, text: "function Comment({ body }: Props) {" },
      { type: "remove", old: 17, text: "  return <div dangerouslySetInnerHTML={{ __html: body }} />" },
      { type: "add", new: 17, text: "  const clean = DOMPurify.sanitize(body)" },
      { type: "add", new: 18, text: "  return <div dangerouslySetInnerHTML={{ __html: clean }} />" },
      { type: "context", old: 18, new: 19, text: "}" },
    ],
  },
  {
    id: "3",
    file: "src/config/secrets.ts",
    line: 7,
    type: "Segredo Exposto",
    severity: "Crítica",
    description: "Chave de API hardcoded no código-fonte.",
    explicacao: "Credenciais hardcodadas ficam expostas no histórico do git e em qualquer clone do repositório.",
    impacto: "Comprometimento total da conta/serviço associado à chave. Sem rotação, o dano é permanente.",
    correcao: "const API_KEY = process.env.API_KEY\n// Adicione API_KEY ao .env e ao .gitignore",
    diff: [
      { type: "remove", old: 7, text: 'const API_KEY = "sk_live_9a8b7c6d5e4f3g2h1i"' },
      { type: "add", new: 7, text: "const API_KEY = process.env.API_KEY" },
    ],
  },
  {
    id: "4",
    file: "src/utils/jwt.ts",
    line: 23,
    type: "Algoritmo Inseguro",
    severity: "Média",
    description: "Uso de algoritmo HS256 sem verificação de assinatura.",
    explicacao: "jwt.decode() não verifica a assinatura do token, permitindo que qualquer JWT forjado seja aceito como válido.",
    impacto: "Escalonamento de privilégios — qualquer usuário pode forjar tokens com permissões arbitrárias.",
    diff: [
      { type: "context", old: 21, new: 21, text: "export function verify(token: string) {" },
      { type: "remove", old: 22, text: "  return jwt.decode(token)" },
      { type: "add", new: 22, text: "  return jwt.verify(token, SECRET, {" },
      { type: "add", new: 23, text: '    algorithms: ["RS256"],' },
      { type: "add", new: 24, text: "  })" },
      { type: "context", old: 23, new: 25, text: "}" },
    ],
  },
]

type FilterSev = "Todas" | "Crítica" | "Alta" | "Média" | "Baixa"

const severityMap: Record<string, Vulnerability["severity"]> = {
  CRITICAL: "Crítica",
  HIGH: "Alta",
  MEDIUM: "Média",
  LOW: "Baixa",
}

function apiToVuln(v: ScanResponse["vulnerabilidades"][0], idx: number): Vulnerability {
  return {
    id: String(idx),
    file: v.arquivo || "desconhecido",
    line: typeof v.linha === "number" ? v.linha : 0,
    type: v.titulo,
    severity: severityMap[v.severidade?.toUpperCase()] ?? "Baixa",
    description: v.explicacao,
    explicacao: v.explicacao,
    impacto: v.impacto,
    correcao: v.correcao,
  }
}

const filterTabs: FilterSev[] = ["Todas", "Crítica", "Alta", "Média", "Baixa"]

const filterStyles: Record<FilterSev, string> = {
  Todas: "bg-primary/15 text-primary ring-primary/30",
  Crítica: "bg-destructive/15 text-destructive ring-destructive/30",
  Alta: "bg-chart-4/15 text-chart-4 ring-chart-4/30",
  Média: "bg-chart-2/15 text-chart-2 ring-chart-2/30",
  Baixa: "bg-primary/15 text-primary ring-primary/30",
}

export default function ZettaScanPage() {
  const [vulns, setVulns] = useState<Vulnerability[]>([])
  const [scanMeta, setScanMeta] = useState<Pick<ScanResponse, "repositorio" | "tempo_segundos" | "scanned_at" | "total_vulnerabilidades" | "criticas" | "altas" | "medias" | "baixas"> | null>(null)
  const [isReal, setIsReal] = useState(false)
  const [filter, setFilter] = useState<FilterSev>("Todas")
  const [search, setSearch] = useState("")

  useEffect(() => {
    const saved = loadScanResult()
    if (saved) {
      setVulns(saved.vulnerabilidades.map(apiToVuln))
      setScanMeta(saved)
      setIsReal(true)
    } else {
      setVulns(mockVulnerabilities)
    }
  }, [])

  const counts = {
    Crítica: vulns.filter(v => v.severity === "Crítica").length,
    Alta: vulns.filter(v => v.severity === "Alta").length,
    Média: vulns.filter(v => v.severity === "Média").length,
    Baixa: vulns.filter(v => v.severity === "Baixa").length,
  }

  const filtered = vulns.filter(v => {
    const matchSev = filter === "Todas" || v.severity === filter
    const matchSearch = search === "" ||
      v.file.toLowerCase().includes(search.toLowerCase()) ||
      v.type.toLowerCase().includes(search.toLowerCase())
    return matchSev && matchSearch
  })

  const severityCounts = [
    { label: "Crítica" as const, count: counts.Crítica, cls: "text-destructive", ring: "ring-destructive/30 bg-destructive/10" },
    { label: "Alta" as const, count: counts.Alta, cls: "text-chart-4", ring: "ring-chart-4/30 bg-chart-4/10" },
    { label: "Média" as const, count: counts.Média, cls: "text-chart-2", ring: "ring-chart-2/30 bg-chart-2/10" },
    { label: "Baixa" as const, count: counts.Baixa, cls: "text-primary", ring: "ring-primary/30 bg-primary/10" },
  ]

  return (
    <div className="space-y-6">
      {/* Scan metadata banner */}
      {isReal && scanMeta ? (
        <Card className="flex flex-wrap items-center gap-4 border-l-4 border-l-primary bg-primary/5 p-4 text-sm">
          <ScanLine className="h-4 w-4 shrink-0 text-primary" />
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <GitBranch className="h-3.5 w-3.5" />
            <span className="font-mono text-foreground truncate max-w-xs">
              {scanMeta.repositorio}
            </span>
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {scanMeta.tempo_segundos}s de análise
          </span>
          {scanMeta.scanned_at && (
            <span className="text-muted-foreground ml-auto text-xs">
              {new Date(scanMeta.scanned_at).toLocaleString("pt-BR")}
            </span>
          )}
        </Card>
      ) : (
        <Card className="flex items-center gap-3 border-l-4 border-l-chart-4 bg-chart-4/5 p-4 text-sm">
          <RefreshCw className="h-4 w-4 shrink-0 text-chart-4" />
          <p className="text-muted-foreground">
            Exibindo dados de demonstração.{" "}
            <a href="/configuracoes" className="font-medium text-chart-4 underline underline-offset-2">
              Conecte um repositório
            </a>{" "}
            para ver resultados reais.
          </p>
        </Card>
      )}

      {/* Severity counters */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {severityCounts.map((s) => (
          <button
            key={s.label}
            onClick={() => setFilter(f => f === s.label ? "Todas" : s.label)}
            className={cn(
              "flex items-center justify-between rounded-xl p-4 ring-1 text-left transition-all",
              s.ring,
              filter === s.label && "ring-2 scale-[1.02]"
            )}
          >
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</p>
              <p className={cn("mt-1 font-heading text-3xl font-bold", s.cls)}>{s.count}</p>
            </div>
            <span className={cn("h-10 w-1.5 rounded-full", s.cls.replace("text-", "bg-"))} />
          </button>
        ))}
      </div>

      {/* Filter tabs + Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 flex-wrap">
          {filterTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium ring-1 transition-all",
                filter === tab
                  ? filterStyles[tab]
                  : "bg-muted/50 text-muted-foreground ring-border hover:bg-muted"
              )}
            >
              {tab}
              {tab !== "Todas" && (
                <span className="ml-1 opacity-60">
                  ({counts[tab as keyof typeof counts]})
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground">
          <Search className="h-3.5 w-3.5 shrink-0" />
          <input
            placeholder="Buscar arquivo ou tipo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-48 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none text-xs"
          />
        </div>
      </div>

      {/* Vulnerability list */}
      {filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground text-sm">Nenhuma vulnerabilidade encontrada com os filtros atuais.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((v) => (
            <VulnerabilityCard key={v.id} vuln={v} />
          ))}
        </div>
      )}
    </div>
  )
}
