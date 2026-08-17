"""
scanner.py
----------
O ORQUESTRADOR — é aqui que tudo se junta.

Esse arquivo chama todos os outros módulos na ordem certa:
1. github_reader  → clona o repositório (validação de URL inclusa)
2. semgrep_wrapper → analisa o código (síncrono, roda em thread separada)
3. osv_client     → verifica as dependências (async, batch)
4. iac_scanner    → analisa arquivos de infraestrutura (Dockerfile, CI/CD, IaC)
5. ai_prioritizer → prioriza e enriquece com Gemini
6. apaga o código clonado (privacidade — sempre ocorre, mesmo em erro)
7. retorna o relatório final

É esse arquivo que a api.py chama quando o ZettaDash pedir um novo scan.

Correções de auditoria 2026-07-14:
- [SC-1] executar_scan é agora async; Semgrep roda em asyncio.to_thread para
          não bloquear o event loop do FastAPI/Uvicorn durante todo o scan
- [SC-2] Logging estruturado em vez de prints com dados sensíveis
- [SC-3] Comentário "Claude" corrigido para "Gemini"

Adições 2026-08-17:
- [SC-4] Integração do iac_scanner.py (Camada 4: Infraestrutura/IaC)
- [SC-5] Campo `origem` propagado em todos os achados (SAST / SCA / IaC)
- [SC-6] Campos `iac_total`, `iac_findings` adicionados ao retorno
"""

import asyncio
import logging
import time
import uuid
from typing import Dict, List

from github_reader import clonar_repositorio, apagar_repositorio
from semgrep_wrapper import rodar_semgrep
from osv_client import verificar_dependencias
from iac_scanner import analisar_iac
from ai_prioritizer import priorizar_com_ia
from attack_path import gerar_attack_paths
from quality_gate import avaliar_quality_gate

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
        "vulnerabilidades": [ ... lista completa priorizada com campo 'origem' ... ],
        "iac_total": 3,
        "iac_findings": [ ... lista de achados IaC antes da priorização IA ... ],
    }
    """
    inicio = time.monotonic()
    caminho_repo: str | None = None
    # [6-A] ID único por execução de scan para correlacionar logs em reqs simultâneas
    scan_id = uuid.uuid4().hex[:8]

    try:
        logger.info("[ZettaScan:%s] Iniciando scan para: %s", scan_id, repo_url)
        caminho_repo = await asyncio.to_thread(clonar_repositorio, repo_url, github_token)

        logger.info("[ZettaScan:%s] [2/5] Análise de código com Semgrep (SAST)...", scan_id)
        vulns_semgrep: List[Dict] = await asyncio.to_thread(rodar_semgrep, caminho_repo)

        # [SC-5] Garante que achados SAST tenham origem = "codigo"
        for v in vulns_semgrep:
            v.setdefault("tipo", "codigo")

        logger.info("[ZettaScan:%s] [3/5] Verificando dependências com OSV.dev (SCA)...", scan_id)
        vulns_osv: List[Dict] = await asyncio.to_thread(verificar_dependencias, caminho_repo)

        # [SC-5] Garante que achados SCA tenham origem = "dependencia"
        for v in vulns_osv:
            v.setdefault("tipo", "dependencia")

        logger.info("[ZettaScan:%s] [4/5] Analisando infraestrutura (IaC)...", scan_id)
        vulns_iac: List[Dict] = await asyncio.to_thread(analisar_iac, caminho_repo)

        # [SC-5] Garante que achados IaC tenham origem = "iac"
        for v in vulns_iac:
            v.setdefault("tipo", "iac")

        logger.info("[ZettaScan:%s] [5/5] Priorizando com Gemini...", scan_id)
        vulnerabilidades: List[Dict] = await asyncio.to_thread(
            priorizar_com_ia, vulns_semgrep, vulns_osv + vulns_iac
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

        # [APA-1] Geração de caminhos de ataque correlacionados
        attack_paths = gerar_attack_paths(vulnerabilidades, vulns_iac)

        # [QG-1] Avaliação de Quality Gate CI/CD
        base_result = {
            "vulnerabilidades": vulnerabilidades,
            "iac_findings": vulns_iac,
            "criticas": contagem["CRITICAL"],
            "altas": contagem["HIGH"],
            "medias": contagem["MEDIUM"],
            "baixas": contagem["LOW"],
        }
        qg_result = avaliar_quality_gate(base_result)

        logger.info(
            "[ZettaScan:%s] Concluído em %.2fs | Total: %d | CRITICAL: %d | HIGH: %d | MEDIUM: %d | LOW: %d | IaC: %d | AttackPaths: %d | QualityGate: %s",
            scan_id, tempo,
            len(vulnerabilidades),
            contagem["CRITICAL"], contagem["HIGH"], contagem["MEDIUM"], contagem["LOW"],
            len(vulns_iac), len(attack_paths), qg_result["status"],
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
            # [SC-6] Campos IaC adicionados para SBOM / export
            "iac_total": len(vulns_iac),
            "iac_findings": vulns_iac,
            # [SC-7] Attack Paths e Quality Gate
            "attack_paths": attack_paths,
            "quality_gate": qg_result,
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
