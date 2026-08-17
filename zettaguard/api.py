"""
api.py
------
API FastAPI do ZettaGuard — proxy/middleware de proteção LLM.

Endpoints:
  POST /analyze          → analisa um prompt de entrada
  POST /analyze-output   → analisa a saída de um LLM
  POST /proxy            → pipeline completo (entrada → LLM → saída)
  GET  /events           → histórico de eventos de segurança
  GET  /stats            → estatísticas agregadas
  GET  /health           → health check

Para rodar:
    uvicorn api:app --reload --port 8002

Documentação interativa:
    http://localhost:8002/docs
"""

import logging
import os
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

# pyrefly: ignore [missing-import]
from fastapi import FastAPI, HTTPException, Query
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
from fastapi.responses import JSONResponse
# pyrefly: ignore [missing-import]
from pydantic import BaseModel, Field

from detector import analyze_input, analyze_output
from event_store import event_store
from patterns import CATEGORY_LABELS, SCORE_THRESHOLDS

load_dotenv()

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# ── Aplicação ──────────────────────────────────────────────────────────────────
app = FastAPI(
    title="ZettaGuard API",
    description=(
        "Camada de proteção LLM do Zetta Guard. "
        "Detecta e bloqueia prompt injection, jailbreak e data exfiltration em tempo real."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ───────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # TODO: restringir ao domínio do ZettaDash em produção
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

# ── Schemas ────────────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    """Corpo do POST /analyze."""
    prompt: str = Field(..., min_length=1, max_length=10000, description="Prompt a ser analisado")
    context: Optional[str] = Field(None, description="Contexto adicional (sistema ou documentos)")
    log_event: bool = Field(True, description="Se deve registrar o evento no histórico")


class AnalyzeOutputRequest(BaseModel):
    """Corpo do POST /analyze-output."""
    response: str = Field(..., min_length=1, max_length=50000, description="Resposta do LLM a analisar")
    original_prompt: Optional[str] = Field(None, description="Prompt original que gerou a resposta")
    log_event: bool = Field(True, description="Se deve registrar o evento no histórico")


class ProxyRequest(BaseModel):
    """Corpo do POST /proxy — pipeline completo."""
    prompt: str = Field(..., min_length=1, max_length=10000, description="Prompt do usuário")
    system_prompt: Optional[str] = Field(None, description="System prompt a ser protegido")
    model: str = Field("gemini-2.0-flash", description="Modelo LLM a usar")
    temperature: float = Field(0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(2048, ge=1, le=8192)


class AnalyzeResponse(BaseModel):
    """Resposta do /analyze."""
    score: int
    decision: str
    primary_category: str
    primary_category_label: str
    primary_severity: str
    matched_patterns: List[str]
    matched_descriptions: List[str]
    regex_score: int
    ai_score: int
    ai_classification: Optional[Dict[str, Any]]
    layer1_triggered: bool
    layer2_triggered: bool
    explanation: str


class ProxyResponse(BaseModel):
    """Resposta do /proxy."""
    allowed: bool
    input_analysis: Dict[str, Any]
    output_analysis: Optional[Dict[str, Any]]
    llm_response: Optional[str]
    blocked_reason: Optional[str]


class ErrorResponse(BaseModel):
    status: str = "error"
    codigo: int
    mensagem: str


# ── Handler global de erros ────────────────────────────────────────────────────

@app.exception_handler(Exception)
async def handler_erro_generico(request, exc: Exception):
    logger.error("Erro não tratado em %s: %s", request.url, exc)
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            codigo=500,
            mensagem="Erro interno do servidor.",
        ).model_dump(),
    )


# ── Endpoints ──────────────────────────────────────────────────────────────────

@app.post(
    "/analyze",
    response_model=AnalyzeResponse,
    summary="Analisa um prompt de entrada",
    description=(
        "Executa as 3 camadas de detecção (regex + IA + score) sobre o prompt. "
        "Retorna o score de risco, categoria do ataque detectado e a decisão."
    ),
)
async def analyze(body: AnalyzeRequest):
    """Analisa um prompt de entrada com as 3 camadas do ZettaGuard."""
    logger.info("[/analyze] Analisando prompt de %d chars", len(body.prompt))

    # Concatena contexto se fornecido
    full_text = body.prompt
    if body.context:
        full_text = f"{body.context}\n\n{body.prompt}"

    result = await analyze_input(full_text)

    # Registra o evento
    if body.log_event:
        event_store.add(
            direction="input",
            category=result.primary_category,
            severity=result.primary_severity,
            score=result.score,
            decision=result.decision,
            prompt=body.prompt,
            matched_patterns=result.matched_patterns,
            ai_classification=result.ai_classification,
        )

    return result.to_dict()


@app.post(
    "/analyze-output",
    summary="Analisa a saída de um LLM",
    description=(
        "Verifica se a resposta do modelo contém dados sensíveis (PII, "
        "credenciais, system prompt, etc.)."
    ),
)
async def analyze_output_endpoint(body: AnalyzeOutputRequest):
    """Verifica a resposta do LLM por data leakage."""
    logger.info("[/analyze-output] Analisando resposta de %d chars", len(body.response))

    result = analyze_output(body.response)

    if body.log_event and result.score > 0:
        event_store.add(
            direction="output",
            category="data_leakage",
            severity="HIGH" if result.score >= 80 else "MEDIUM",
            score=result.score,
            decision=result.decision,
            prompt=body.original_prompt or "(resposta sem prompt original)",
            matched_patterns=result.matched_patterns,
        )

    return result.to_dict()


@app.post(
    "/proxy",
    response_model=ProxyResponse,
    summary="Pipeline completo: entrada → LLM → saída",
    description=(
        "Intercepta a chamada ao LLM, analisa a entrada, chama o modelo se permitido, "
        "e analisa a saída antes de retornar ao cliente."
    ),
)
async def proxy(body: ProxyRequest):
    """Pipeline completo de proteção LLM."""
    logger.info("[/proxy] Proxy request para modelo %s", body.model)

    # ── Análise de entrada ──────────────────────────────────────────────────────
    full_input = body.prompt
    if body.system_prompt:
        full_input = f"[SYSTEM]: {body.system_prompt}\n\n[USER]: {body.prompt}"

    input_result = await analyze_input(full_input)

    event_store.add(
        direction="input",
        category=input_result.primary_category,
        severity=input_result.primary_severity,
        score=input_result.score,
        decision=input_result.decision,
        prompt=body.prompt,
        matched_patterns=input_result.matched_patterns,
        ai_classification=input_result.ai_classification,
    )

    # Se bloqueado, não chama o LLM
    if input_result.decision == "Bloqueado":
        return ProxyResponse(
            allowed=False,
            input_analysis=input_result.to_dict(),
            output_analysis=None,
            llm_response=None,
            blocked_reason=input_result.explanation,
        )

    # ── Chama o LLM ────────────────────────────────────────────────────────────
    llm_response_text = await _call_llm(
        prompt=body.prompt,
        system_prompt=body.system_prompt,
        model=body.model,
        temperature=body.temperature,
        max_tokens=body.max_tokens,
    )

    if llm_response_text is None:
        raise HTTPException(
            status_code=502,
            detail="Falha ao chamar o modelo LLM. Verifique as credenciais e tente novamente.",
        )

    # ── Análise de saída ────────────────────────────────────────────────────────
    output_result = analyze_output(llm_response_text)

    if output_result.score > 0:
        event_store.add(
            direction="output",
            category="data_leakage",
            severity="HIGH" if output_result.score >= 80 else "MEDIUM",
            score=output_result.score,
            decision=output_result.decision,
            prompt=body.prompt,
            matched_patterns=output_result.matched_patterns,
        )

    # Se a saída vaza dados, bloqueia
    if output_result.decision == "Bloqueado":
        return ProxyResponse(
            allowed=False,
            input_analysis=input_result.to_dict(),
            output_analysis=output_result.to_dict(),
            llm_response=None,
            blocked_reason=output_result.explanation,
        )

    return ProxyResponse(
        allowed=True,
        input_analysis=input_result.to_dict(),
        output_analysis=output_result.to_dict(),
        llm_response=llm_response_text,
        blocked_reason=None,
    )


@app.get(
    "/events",
    summary="Histórico de eventos de segurança",
    description="Retorna os eventos registrados, com filtros opcionais.",
)
async def get_events(
    limit: int = Query(50, ge=1, le=200),
    category: Optional[str] = Query(None),
    decision: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
):
    """Retorna o histórico de eventos de segurança para o ZettaDash."""
    return {
        "events": event_store.get_events(
            limit=limit,
            category=category,
            decision=decision,
            severity=severity,
        ),
        "total": len(event_store.get_events(limit=1000)),
    }


@app.get(
    "/stats",
    summary="Estatísticas agregadas",
    description="Retorna contadores e métricas de segurança para o ZettaDash.",
)
async def get_stats():
    """Retorna estatísticas agregadas dos eventos de segurança."""
    stats = event_store.get_stats()
    # Adiciona labels legíveis por categoria
    stats["category_labels"] = {
        k: CATEGORY_LABELS.get(k, k)
        for k in stats.get("by_category", {}).keys()
    }
    stats["thresholds"] = SCORE_THRESHOLDS
    return stats


@app.get("/health", summary="Health check")
async def health():
    """Health check do ZettaGuard."""
    api_key_ok = bool(os.getenv("GEMINI_API_KEY"))
    return {
        "status": "ok",
        "servico": "ZettaGuard",
        "versao": "1.0.0",
        "gemini_configurado": api_key_ok,
        "camadas_ativas": {
            "layer1_regex": True,
            "layer2_ai": api_key_ok,
            "layer3_output": True,
        },
        "total_patterns": 21,  # padrões de entrada (INJECTION + JAILBREAK + EXFILTRATION)
        "total_output_patterns": 6,
    }


# ── LLM Caller ─────────────────────────────────────────────────────────────────

async def _call_llm(
    prompt: str,
    system_prompt: Optional[str],
    model: str,
    temperature: float,
    max_tokens: int,
) -> Optional[str]:
    """
    Chama o LLM (Gemini) com o prompt fornecido.
    Retorna o texto da resposta ou None em caso de erro.
    """
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        logger.error("[proxy] GEMINI_API_KEY não configurada")
        return None

    try:
        import google.generativeai as genai  # type: ignore
        genai.configure(api_key=api_key)

        full_prompt = prompt
        if system_prompt:
            full_prompt = f"System: {system_prompt}\n\nUser: {prompt}"

        llm = genai.GenerativeModel(model)
        response = llm.generate_content(
            full_prompt,
            generation_config={
                "temperature": temperature,
                "max_output_tokens": max_tokens,
            },
        )
        return response.text

    except Exception as e:
        logger.error("[proxy] Erro ao chamar LLM: %s", e)
        return None
