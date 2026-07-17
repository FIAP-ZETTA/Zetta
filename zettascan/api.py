"""
api.py
------
A API do ZettaScan — é o que o ZettaDash e o backend principal vão chamar.

Expõe dois endpoints:
  POST /scan   → recebe a URL do repo e o token, retorna o relatório
  GET  /health → health check

Para rodar a API:
    uvicorn api:app --reload --port 8001

Para testar no navegador:
    http://localhost:8001/docs
    (O FastAPI gera uma interface Swagger automática!)

Correções de auditoria 2026-07-14:
- [AP-1] Removido fallback silencioso para GITHUB_TOKEN do .env —
          o token DEVE sempre vir da requisição do cliente
- [AP-2] allow_credentials=False (combinação allow_origins=* + credentials
          é inválida na spec CORS e rejeitada por browsers modernos)
- [AP-3] Validação de URL via regex + field_validator Pydantic (não apenas startswith)
- [AP-4] response_model=ScanResponse adicionado — FastAPI valida o retorno

Pendências de produto documentadas:
- [P-1] allow_origins: configurar com o domínio real do ZettaDash em produção
- [P-2] Rate limiting: implementar ou documentar ausência (ver comentário abaixo)
"""

import logging
import re
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

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# ── Aplicação FastAPI ─────────────────────────────────────────────────────────
app = FastAPI(
    title="ZettaScan API",
    description="Motor de análise de segurança do Zetta Guard",
    version="1.0.0",
)

# ── CORS ─────────────────────────────────────────────────────────────────────
# [AP-2] allow_credentials=True + allow_origins=["*"] é inválido na spec CORS.
#
# [P-1] PENDÊNCIA DE PRODUTO: substituir allow_origins abaixo pelo domínio
#       real do ZettaDash antes de ir para produção.
#       Ex.: allow_origins=["https://zettaguard.fiap.com.br"]
#
# Durante desenvolvimento acadêmico mantemos ["*"] com credentials=False,
# que é tecnicamente válido mas inseguro em produção.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # TODO [P-1]: trocar pelo domínio do ZettaDash
    allow_credentials=False,      # [AP-2] False é o correto com allow_origins=["*"]
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

# ── Schemas Pydantic ──────────────────────────────────────────────────────────

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
    repo_url: str = Field(..., description="URL do repositório GitHub")
    token: str = Field(..., description="Token GitHub read-only gerado pelo cliente")

    # [AP-3] Validação de URL via regex — mais seguro que startswith
    @field_validator("repo_url")
    @classmethod
    def validar_url(cls, v: str) -> str:
        if not _RE_GITHUB_URL.match(v):
            raise ValueError(
                "URL inválida. Use o formato: https://github.com/owner/repo"
            )
        return v

    # [AP-3] Validação de formato do token
    @field_validator("token")
    @classmethod
    def validar_token(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Token não pode ser vazio.")
        if not _RE_GITHUB_TOKEN.match(v):
            raise ValueError(
                "Formato de token inválido. Use um token GitHub válido (ghp_, ghs_, etc.)"
            )
        return v


class VulnerabilidadeResponse(BaseModel):
    """Item individual de vulnerabilidade no relatório.

    [3-C] AVISO PARA O TIME ZETTADASH:
    O campo 'arquivo' contém o nome do arquivo exatamente como reportado pelo
    Semgrep. Um repositório malicioso pode criar arquivos com nomes como
    '<script>alert(1)</script>.py'. O ZettaDash DEVE sempre usar textContent
    (ou equivalente) ao renderizar esse campo — nunca innerHTML.
    """
    titulo: str
    explicacao: str
    impacto: str
    correcao: str
    # [7-A] Padrão explicitamente validado — garante que a soma das severidades
    # sempre baterá com total_vulnerabilidades no ScanResponse.
    severidade: str = Field(default="LOW", pattern=r"^(CRITICAL|HIGH|MEDIUM|LOW)$")
    arquivo: str = ""
    linha: Any = 0
    tipo: str = "codigo"


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


class ErrorResponse(BaseModel):
    """Formato padronizado de erros — consumível pelo ZettaDash."""
    status: str = "error"
    codigo: int
    mensagem: str
    detalhe: Optional[str] = None


# ── Handler global de erros ───────────────────────────────────────────────────

@app.exception_handler(Exception)
async def handler_erro_generico(request: Request, exc: Exception):
    logger.error("Erro não tratado em %s: %s", request.url, exc)
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            codigo=500,
            mensagem="Erro interno do servidor.",
            detalhe=None,  # não expõe detalhes internos ao cliente
        ).model_dump(),
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

# [P-2] PENDÊNCIA DE PRODUTO: rate limiting não implementado.
#       Recomenda-se slowapi (1-2 scans/min por IP) antes de produção.
#       Um scan pode durar 2-5 min e consumir recursos significativos.
#       Sem rate limiting o endpoint está vulnerável a DoS acidental/intencional.
@app.post(
    "/scan",
    response_model=ScanResponse,      # [AP-4] FastAPI valida a resposta
    responses={
        400: {"model": ErrorResponse, "description": "Parâmetros inválidos"},
        422: {"model": ErrorResponse, "description": "URL ou token malformados"},
        500: {"model": ErrorResponse, "description": "Falha interna durante o scan"},
    },
)
async def iniciar_scan(request: ScanRequest):
    """
    Inicia um scan de segurança em um repositório.

    Recebe:
        repo_url: URL do repositório GitHub (https://github.com/owner/repo)
        token: token de acesso read-only gerado pelo cliente

    Retorna:
        Relatório completo com vulnerabilidades priorizadas pelo Gemini.

    Tempo estimado: 1–5 minutos dependendo do tamanho do repositório.
    """
    # [AP-1] Usa APENAS o token da requisição — nunca usa GITHUB_TOKEN do .env
    # (o .env é para test_scan.py, não para a API de produção)
    logger.info("[API] Scan solicitado para: %s", request.repo_url)

    resultado = await executar_scan(request.repo_url, request.token)

    if resultado.get("status") == "error":
        mensagem = resultado.get("mensagem", "Erro desconhecido durante o scan.")

        # Determina código HTTP mais apropriado baseado no tipo de erro
        if "inválid" in mensagem.lower() or "não permitido" in mensagem.lower():
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


@app.get("/health")
async def health():
    """Health check — retorna 200 se a API está no ar."""
    return {"status": "ok", "servico": "ZettaScan"}
