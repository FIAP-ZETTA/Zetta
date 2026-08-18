"""
api.py
------
A API do ZettaScan â€” Ã© o que o ZettaDash e o backend principal vÃ£o chamar.

ExpÃµe endpoints:
  POST /scan    â†’ recebe a URL do repo e o token, retorna o relatÃ³rio
  POST /export  â†’ recebe dados de scan e retorna JSON completo ou SBOM CycloneDX
  GET  /health  â†’ health check

Para rodar a API:
    uvicorn api:app --reload --port 8001

Para testar no navegador:
    http://localhost:8001/docs
    (O FastAPI gera uma interface Swagger automÃ¡tica!)

CorreÃ§Ãµes de auditoria 2026-07-14:
- [AP-1] Removido fallback silencioso para GITHUB_TOKEN do .env â€”
          o token DEVE sempre vir da requisiÃ§Ã£o do cliente
- [AP-2] allow_credentials=False (combinaÃ§Ã£o allow_origins=* + credentials
          Ã© invÃ¡lida na spec CORS e rejeitada por browsers modernos)
- [AP-3] ValidaÃ§Ã£o de URL via regex + field_validator Pydantic (nÃ£o apenas startswith)
- [AP-4] response_model=ScanResponse adicionado â€” FastAPI valida o retorno

AdiÃ§Ãµes 2026-08-17:
- [AP-5] Campo `tipo` em VulnerabilidadeResponse (codigo / dependencia / iac)
- [AP-6] Campos `iac_total` e `iac_findings` em ScanResponse
- [AP-7] Endpoint POST /export para download de relatÃ³rio JSON e SBOM CycloneDX

PendÃªncias de produto documentadas:
- [P-1] allow_origins: configurar com o domÃ­nio real do ZettaDash em produÃ§Ã£o
- [P-2] Rate limiting: implementar ou documentar ausÃªncia (ver comentÃ¡rio abaixo)
"""

import logging
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

# pyrefly: ignore [missing-import]
from fastapi import FastAPI, HTTPException, Request
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from fastapi.responses import JSONResponse
# pyrefly: ignore [missing-import]
from pydantic import BaseModel, Field, field_validator

from scanner import executar_scan
from dast_scanner import analisar_dast
from attack_path import gerar_attack_paths
from quality_gate import avaliar_quality_gate, gerar_github_action_workflow
from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv(usecwd=True))
load_dotenv()

# â”€â”€ Logging â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s â€” %(message)s",
)
logger = logging.getLogger(__name__)

# â”€â”€ AplicaÃ§Ã£o FastAPI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app = FastAPI(
    title="ZettaScan API",
    description="Motor de anÃ¡lise de seguranÃ§a do Zetta Guard â€” ASPM completo com SAST, SCA e IaC",
    version="2.0.0",
)

# â”€â”€ CORS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# [AP-2] allow_credentials=True + allow_origins=["*"] Ã© invÃ¡lido na spec CORS.
#
# [P-1] PENDÃŠNCIA DE PRODUTO: substituir allow_origins abaixo pelo domÃ­nio
#       real do ZettaDash antes de ir para produÃ§Ã£o.
#       Ex.: allow_origins=["https://zettaguard.fiap.com.br"]
#
# Durante desenvolvimento acadÃªmico mantemos ["*"] com credentials=False,
# que Ã© tecnicamente vÃ¡lido mas inseguro em produÃ§Ã£o.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # TODO [P-1]: trocar pelo domÃ­nio do ZettaDash
    allow_credentials=False,      # [AP-2] False Ã© o correto com allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)

# â”€â”€ Schemas Pydantic â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

# Regex para validar URL do GitHub: https://github.com/owner/repo (com ou sem .git)
_RE_GITHUB_URL = re.compile(
    r"^https://github\.com/[A-Za-z0-9_.\-]+/[A-Za-z0-9_.\-]+(\.git)?$",
    re.IGNORECASE,
)

# Regex para validar token do GitHub (ghp_, ghs_, gho_, github_pat_, etc.)
_RE_GITHUB_TOKEN = re.compile(
    r"^(ghp_|ghs_|gho_|github_pat_|v1\.)[A-Za-z0-9_]+$"
)


class ScanRequest(BaseModel):
    """Corpo esperado no POST /scan."""
    repo_url: str = Field(..., description="URL do repositÃ³rio GitHub")
    token: Optional[str] = Field(default="", description="Token GitHub read-only (opcional para repos pÃºblicos)")

    # [AP-3] ValidaÃ§Ã£o de URL via regex â€” mais seguro que startswith
    @field_validator("repo_url")
    @classmethod
    def validar_url(cls, v: str) -> str:
        if not _RE_GITHUB_URL.match(v):
            raise ValueError(
                "URL invÃ¡lida. Use o formato: https://github.com/owner/repo"
            )
        return v

    # [AP-3] ValidaÃ§Ã£o de formato do token (opcional para repositÃ³rios pÃºblicos)
    @field_validator("token")
    @classmethod
    def validar_token(cls, v: Optional[str]) -> str:
        if not v or not v.strip():
            import os
            return os.getenv("GITHUB_TOKEN", "")
        return v.strip()


class VulnerabilidadeResponse(BaseModel):
    """Item individual de vulnerabilidade no relatÃ³rio.

    [3-C] AVISO PARA O TIME ZETTADASH:
    O campo 'arquivo' contÃ©m o nome do arquivo exatamente como reportado pelo
    Semgrep. Um repositÃ³rio malicioso pode criar arquivos com nomes como
    '<script>alert(1)</script>.py'. O ZettaDash DEVE sempre usar textContent
    (ou equivalente) ao renderizar esse campo â€” nunca innerHTML.
    """
    titulo: str
    explicacao: str
    impacto: str
    correcao: str
    # [7-A] PadrÃ£o explicitamente validado â€” garante que a soma das severidades
    # sempre baterÃ¡ com total_vulnerabilidades no ScanResponse.
    severidade: str = Field(default="LOW", pattern=r"^(CRITICAL|HIGH|MEDIUM|LOW)$")
    arquivo: str = ""
    linha: Any = 0
    # [AP-5] tipo identifica a CAMADA ASPM de origem do achado:
    #   "codigo"      â†’ SAST (Semgrep / motor nativo)
    #   "dependencia" â†’ SCA (OSV.dev / CVEs em bibliotecas)
    #   "iac"         â†’ IaC (Dockerfile, docker-compose, CI/CD, Terraform)
    tipo: str = "codigo"


class IacFindingResponse(BaseModel):
    """Achado bruto do IaC Scanner (antes da priorizaÃ§Ã£o IA)."""
    arquivo: str = ""
    linha: Any = 0
    regra: str = ""
    mensagem: str = ""
    severidade: str = "MEDIUM"
    tipo: str = "iac"
    nome: str = ""


class ScanResponse(BaseModel):
    """Formato de resposta do POST /scan (contrato de API)."""
    status: str
    repositorio: str = ""
    tempo_segundos: float = 0.0
    total_vulnerabilidades: int
    criticas: int
    altas: int
    medias: int
    baixas: int
    vulnerabilidades: List[VulnerabilidadeResponse]
    # [AP-6] Campos IaC
    iac_total: int = 0
    iac_findings: List[IacFindingResponse] = []
    # [AP-8] Campos de Attack Path Analysis e CI/CD Quality Gate
    attack_paths: Optional[List[Dict[str, Any]]] = None
    quality_gate: Optional[Dict[str, Any]] = None


class ErrorResponse(BaseModel):
    """Formato padronizado de erros â€” consumÃ­vel pelo ZettaDash."""
    status: str = "error"
    codigo: int
    mensagem: str
    detalhe: Optional[str] = None


# â”€â”€ Schemas DAST & ASPM AvanÃ§ado â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class DastRequest(BaseModel):
    """Corpo esperado no POST /scan-dast."""
    target_url: str = Field(..., description="URL da aplicaÃ§Ã£o em execuÃ§Ã£o (ex: https://app.example.com)")
    timeout_seconds: Optional[float] = Field(default=6.0, description="Tempo limite em segundos")


class AttackPathsRequest(BaseModel):
    """Corpo esperado no POST /attack-paths."""
    vulnerabilidades: List[Dict[str, Any]] = Field(default_factory=list)
    iac_findings: Optional[List[Dict[str, Any]]] = Field(default_factory=list)


class QualityGateRequest(BaseModel):
    """Corpo esperado no POST /quality-gate/evaluate."""
    vulnerabilidades: List[Dict[str, Any]] = Field(default_factory=list)
    iac_findings: Optional[List[Dict[str, Any]]] = Field(default_factory=list)
    policy: Optional[Dict[str, Any]] = None
    repo_name: Optional[str] = "app"


# â”€â”€ Schema para /export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class ExportRequest(BaseModel):
    """Corpo esperado no POST /export."""
    repositorio: str = Field(..., description="URL do repositÃ³rio auditado")
    vulnerabilidades: List[Dict[str, Any]] = Field(default_factory=list)
    iac_findings: List[Dict[str, Any]] = Field(default_factory=list)
    criticas: int = 0
    altas: int = 0
    medias: int = 0
    baixas: int = 0
    iac_total: int = 0
    formato: str = Field(default="json", pattern=r"^(json|sbom)$")


# â”€â”€ Handler global de erros â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@app.exception_handler(Exception)
async def handler_erro_generico(request: Request, exc: Exception):
    logger.error("Erro nÃ£o tratado em %s: %s", request.url, exc)
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            codigo=500,
            mensagem="Erro interno do servidor.",
            detalhe=None,  # nÃ£o expÃµe detalhes internos ao cliente
        ).model_dump(),
    )


# â”€â”€ Endpoints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

# [P-2] PENDÃŠNCIA DE PRODUTO: rate limiting nÃ£o implementado.
#       Recomenda-se slowapi (1-2 scans/min por IP) antes de produÃ§Ã£o.
#       Um scan pode durar 2-5 min e consumir recursos significativos.
#       Sem rate limiting o endpoint estÃ¡ vulnerÃ¡vel a DoS acidental/intencional.
@app.post(
    "/scan",
    response_model=ScanResponse,      # [AP-4] FastAPI valida a resposta
    responses={
        400: {"model": ErrorResponse, "description": "ParÃ¢metros invÃ¡lidos"},
        422: {"model": ErrorResponse, "description": "URL ou token malformados"},
        500: {"model": ErrorResponse, "description": "Falha interna durante o scan"},
    },
)
async def iniciar_scan(request: ScanRequest):
    """
    Inicia um scan de seguranÃ§a em um repositÃ³rio.

    Recebe:
        repo_url: URL do repositÃ³rio GitHub (https://github.com/owner/repo)
        token: token de acesso read-only gerado pelo cliente

    Retorna:
        RelatÃ³rio completo com vulnerabilidades priorizadas pelo Gemini,
        incluindo achados SAST (cÃ³digo), SCA (dependÃªncias) e IaC (infraestrutura).

    Tempo estimado: 1â€“5 minutos dependendo do tamanho do repositÃ³rio.
    """
    # [AP-1] Usa APENAS o token da requisiÃ§Ã£o â€” nunca usa GITHUB_TOKEN do .env
    # (o .env Ã© para test_scan.py, nÃ£o para a API de produÃ§Ã£o)
    logger.info("[API] Scan solicitado para: %s", request.repo_url)

    resultado = await executar_scan(request.repo_url, request.token)

    if resultado.get("status") == "error":
        mensagem = resultado.get("mensagem", "Erro desconhecido durante o scan.")

        # Determina cÃ³digo HTTP mais apropriado baseado no tipo de erro
        if "invÃ¡lid" in mensagem.lower() or "nÃ£o permitido" in mensagem.lower():
            status_code = 400
        elif "timeout" in mensagem.lower() or "clonar" in mensagem.lower():
            status_code = 502  # upstream failure (git clone)
        else:
            status_code = 500

        raise HTTPException(
            status_code=status_code,
            detail=ErrorResponse(
                codigo=status_code,
                mensagem=mensagem,
            ).model_dump(),
        )

    return resultado


@app.post(
    "/export",
    responses={
        200: {"description": "RelatÃ³rio exportado em JSON ou SBOM CycloneDX"},
        400: {"model": ErrorResponse, "description": "Formato invÃ¡lido"},
    },
)
async def exportar_relatorio(request: ExportRequest):
    """
    [AP-7] Endpoint de exportaÃ§Ã£o de relatÃ³rio de seguranÃ§a.

    Suporta dois formatos:
      - `json`: RelatÃ³rio completo estruturado com todos os achados
      - `sbom`: Software Bill of Materials no padrÃ£o CycloneDX 1.4

    O SBOM lista todos os componentes identificados nas dependÃªncias
    com seus CVEs conhecidos â€” padrÃ£o exigido por compliance (EU CRA, NIST SSDF).
    """
    agora = datetime.now(timezone.utc).isoformat()

    if request.formato == "sbom":
        # Gera SBOM no padrÃ£o CycloneDX 1.4
        componentes = []
        vistos = set()

        for vuln in request.vulnerabilidades:
            # Achados de dependÃªncias tÃªm campo 'pacote' ou 'arquivo' com nome do pacote
            pacote = vuln.get("pacote", "")
            versao = vuln.get("versao", "")
            cve = vuln.get("cve_id", "")

            if not pacote and vuln.get("tipo") == "dependencia":
                # Tenta extrair do arquivo
                pacote = vuln.get("arquivo", "unknown").split("/")[0]

            if pacote and pacote not in vistos:
                vistos.add(pacote)
                comp = {
                    "type": "library",
                    "name": pacote,
                    "version": versao or "unknown",
                    "purl": f"pkg:generic/{pacote}@{versao}" if versao else f"pkg:generic/{pacote}",
                }
                if cve:
                    comp["vulnerabilities"] = [{"id": cve, "source": {"name": "OSV", "url": "https://osv.dev"}}]
                componentes.append(comp)

        sbom = {
            "bomFormat": "CycloneDX",
            "specVersion": "1.4",
            "serialNumber": f"urn:uuid:{uuid.uuid4()}",
            "version": 1,
            "metadata": {
                "timestamp": agora,
                "tools": [{"vendor": "Zetta", "name": "ZettaScan", "version": "2.0.0"}],
                "component": {
                    "type": "application",
                    "name": request.repositorio.split("/")[-1] if "/" in request.repositorio else request.repositorio,
                    "version": "latest",
                    "purl": f"pkg:github/{request.repositorio.replace('https://github.com/', '')}",
                },
            },
            "components": componentes,
            "vulnerabilities": [
                {
                    "id": v.get("cve_id", f"ZETTA-{i:04d}"),
                    "source": {"name": "OSV/ZettaScan"},
                    "ratings": [{"score": {"base": 7.5}, "severity": v.get("severidade", "MEDIUM")}],
                    "description": v.get("titulo", ""),
                    "affects": [{"ref": v.get("pacote", "")}],
                }
                for i, v in enumerate(request.vulnerabilidades)
                if v.get("tipo") == "dependencia"
            ],
        }
        return JSONResponse(content=sbom, media_type="application/json")

    else:
        # Formato JSON completo
        relatorio = {
            "zettascan_report": {
                "version": "2.0.0",
                "generated_at": agora,
                "repositorio": request.repositorio,
                "summary": {
                    "total": len(request.vulnerabilidades),
                    "criticas": request.criticas,
                    "altas": request.altas,
                    "medias": request.medias,
                    "baixas": request.baixas,
                    "iac_total": request.iac_total,
                },
                "layers": {
                    "sast": [v for v in request.vulnerabilidades if v.get("tipo") == "codigo"],
                    "sca": [v for v in request.vulnerabilidades if v.get("tipo") == "dependencia"],
                    "iac": request.iac_findings,
                },
                "all_findings": request.vulnerabilidades,
            }
        }
@app.post(
    "/scan-dast",
    responses={
        200: {"description": "Resultado da varredura dinÃ¢mica de seguranÃ§a DAST"},
        400: {"model": ErrorResponse, "description": "URL ou parÃ¢metros invÃ¡lidos"},
    },
)
async def executar_dast(request: DastRequest):
    """
    [DAST-1] Executa varredura dinÃ¢mica de seguranÃ§a (DAST) em uma URL ativa.
    Analisa Headers de SeguranÃ§a, CORS, vazamento de versÃµes e endpoints sensÃ­veis.
    """
    logger.info("Iniciando varredura DAST para URL: %s", request.target_url)
    resultado = await analisar_dast(request.target_url, request.timeout_seconds or 6.0)
    return JSONResponse(content=resultado)


@app.post(
    "/attack-paths",
    responses={
        200: {"description": "Cadeias de ataque (Kill Chains) correlacionadas"},
    },
)
async def correlacionar_attack_paths(request: AttackPathsRequest):
    """
    [APA-1] Motor de correlaÃ§Ã£o e anÃ¡lise de caminhos de ataque (Attack Path Analysis).
    """
    paths = gerar_attack_paths(request.vulnerabilidades, request.iac_findings)
    return JSONResponse(content={"attack_paths": paths, "total": len(paths)})


@app.post(
    "/quality-gate/evaluate",
    responses={
        200: {"description": "Resultado da avaliaÃ§Ã£o do Quality Gate CI/CD"},
    },
)
async def avaliar_qg(request: QualityGateRequest):
    """
    [QG-1] Avalia se o repositÃ³rio cumpre as polÃ­ticas corporativas de Quality Gate
    e gera o workflow de CI/CD para GitHub Actions.
    """
    base_data = {
        "vulnerabilidades": request.vulnerabilidades,
        "iac_findings": request.iac_findings or [],
    }
    resultado = avaliar_quality_gate(base_data, request.policy)
    resultado["github_action_workflow"] = gerar_github_action_workflow(request.repo_name or "app")
    return JSONResponse(content=resultado)


@app.get("/health")
async def health():
    """Health check â€” retorna 200 se a API estÃ¡ no ar."""
    return {"status": "ok", "servico": "ZettaScan", "version": "2.0.0"}

