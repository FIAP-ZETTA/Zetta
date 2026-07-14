"""
scanner.py
----------
O ORQUESTRADOR — é aqui que tudo se junta.

Esse arquivo chama todos os outros módulos na ordem certa:
1. github_reader  → clona o repositório (validação de URL inclusa)
2. semgrep_wrapper → analisa o código (síncrono, roda em thread separada)
3. osv_client     → verifica as dependências (async, batch)
4. ai_prioritizer → prioriza e enriquece com Gemini
5. apaga o código clonado (privacidade — sempre ocorre, mesmo em erro)
6. retorna o relatório final

É esse arquivo que a api.py chama quando o ZettaDash pedir um novo scan.

Correções de auditoria 2026-07-14:
- [SC-1] executar_scan é agora async; Semgrep roda em asyncio.to_thread para
          não bloquear o event loop do FastAPI/Uvicorn durante todo o scan
- [SC-2] Logging estruturado em vez de prints com dados sensíveis
- [SC-3] Comentário "Claude" corrigido para "Gemini"
"""

import asyncio
import logging
import time
import uuid
from typing import Dict, List

from github_reader import clonar_repositorio, apagar_repositorio
from semgrep_wrapper import rodar_semgrep
from osv_client import verificar_dependencias
from ai_prioritizer import priorizar_com_ia

logger = logging.getLogger(__name__)


async def executar_scan(repo_url: str, github_token: str) -> Dict:
    """
    Executa o scan completo de um repositório de forma assíncrona.

    [SC-1] A função é async para que o FastAPI possa atender outras requisições
    enquanto o scan ocorre. O Semgrep (processo síncrono e pesado) é executado
    via asyncio.to_thread para não bloquear o event loop.

    Parâmetros:
        repo_url: URL do repositório, ex: "https://github.com/usuario/projeto"
        github_token: token read-only fornecido pelo cliente

    Retorna dicionário com:
    {
        "status": "success" ou "error",
        "repositorio": "https://github.com/...",
        "tempo_segundos": 42.1,
        "total_vulnerabilidades": 15,
        "criticas": 2,
        "altas": 5,
        "medias": 6,
        "baixas": 2,
        "vulnerabilidades": [ ... lista completa priorizada ... ]
    }
    """
    inicio = time.monotonic()
    caminho_repo: str | None = None
    # [6-A] ID único por execução de scan para correlacionar logs em reqs simultâneas
    scan_id = uuid.uuid4().hex[:8]

    try:
        logger.info("[ZettaScan:%s] Iniciando scan para: %s", scan_id, repo_url)
        caminho_repo = await asyncio.to_thread(clonar_repositorio, repo_url, github_token)

        logger.info("[ZettaScan:%s] [2/4] Análise de código com Semgrep...", scan_id)
        vulns_semgrep: List[Dict] = await asyncio.to_thread(rodar_semgrep, caminho_repo)

        logger.info("[ZettaScan:%s] [3/4] Verificando dependências com OSV.dev...", scan_id)
        vulns_osv: List[Dict] = await asyncio.to_thread(verificar_dependencias, caminho_repo)

        logger.info("[ZettaScan:%s] [4/4] Priorizando com Gemini...", scan_id)
        vulnerabilidades: List[Dict] = await asyncio.to_thread(
            priorizar_com_ia, vulns_semgrep, vulns_osv
        )

        # ── Conta as vulnerabilidades por severidade ──────────────────────────
        contagem = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
        for v in vulnerabilidades:
            sev = v.get("severidade", "LOW").upper()
            if sev in contagem:
                contagem[sev] += 1
            else:
                # [7-A] Severidade inválida normalizada para LOW — garante que
                # criticas + altas + medias + baixas == total_vulnerabilidades
                contagem["LOW"] += 1
                logger.warning(
                    "[ZettaScan:%s] Severidade inválida '%s' normalizada para LOW.",
                    scan_id, sev,
                )

        tempo = round(time.monotonic() - inicio, 2)

        logger.info(
            "[ZettaScan:%s] Concluído em %.2fs | Total: %d | CRITICAL: %d | HIGH: %d | MEDIUM: %d | LOW: %d",
            scan_id, tempo,
            len(vulnerabilidades),
            contagem["CRITICAL"], contagem["HIGH"], contagem["MEDIUM"], contagem["LOW"],
        )

        return {
            "status": "success",
            "repositorio": repo_url,
            "tempo_segundos": tempo,
            "total_vulnerabilidades": len(vulnerabilidades),
            "criticas": contagem["CRITICAL"],
            "altas": contagem["HIGH"],
            "medias": contagem["MEDIUM"],
            "baixas": contagem["LOW"],
            "vulnerabilidades": vulnerabilidades,
        }

    except Exception as exc:
        logger.error("[ZettaScan:%s] ERRO durante o scan: %s", scan_id, exc)
        return {
            "status": "error",
            "mensagem": str(exc),
            "repositorio": repo_url,
        }

    finally:
        # ── SEMPRE apaga o código clonado, mesmo se der erro ───────────────
        if caminho_repo:
            logger.info("[ZettaScan:%s] Removendo código temporário...", scan_id)
            await asyncio.to_thread(apagar_repositorio, caminho_repo)
