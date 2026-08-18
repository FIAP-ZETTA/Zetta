"""
scanner.py
----------
O ORQUESTRADOR — É aqui que tudo se junta.

Esse arquivo chama todos os outros módulos na ordem certa:
1. github_reader  -> clona o repositório (validação de URL inclusa) OU analisa diretório local
2. semgrep_wrapper -> analisa o código (síncrono, roda em thread separada)
3. osv_client     -> verifica as dependências (async, batch)
4. iac_scanner    -> analisa arquivos de infraestrutura (Dockerfile, CI/CD, IaC)
5. ai_prioritizer -> prioriza e enriquece com Gemini
6. apaga o código clonado (privacidade — sempre ocorre, apenas se foi clonado remotamente)
7. retorna o relatório final

É esse arquivo que a api.py chama quando o ZettaDash pedir um novo scan.
"""

import os
import asyncio
import logging
import time
import uuid
from typing import Dict, List, Optional

from github_reader import clonar_repositorio, apagar_repositorio
from semgrep_wrapper import rodar_semgrep
from osv_client import verificar_dependencias
from iac_scanner import analisar_iac
from ai_prioritizer import priorizar_com_ia
from attack_path import gerar_attack_paths
from quality_gate import avaliar_quality_gate

logger = logging.getLogger(__name__)


async def executar_scan(repo_url: str = ".", github_token: str = "") -> Dict:
    """
    Executa o scan completo de um repositório ou diretório local de forma assíncrona.

    Parâmetros:
        repo_url: URL do repositório ("https://github.com/...") ou caminho de diretório local (".")
        github_token: token do GitHub (opcional se for repositório público ou diretório local)
    """
    inicio = time.monotonic()
    caminho_repo: Optional[str] = None
    deve_apagar = False
    scan_id = uuid.uuid4().hex[:8]

    try:
        logger.info("[ZettaScan:%s] Iniciando scan para: %s", scan_id, repo_url)

        # Se for um diretório local existente ou não for uma URL remota
        if os.path.isdir(repo_url) or not (repo_url.startswith("http://") or repo_url.startswith("https://") or repo_url.startswith("git@")):
            caminho_repo = os.path.abspath(repo_url)
            deve_apagar = False
            logger.info("[ZettaScan:%s] Usando diretório local: %s", scan_id, caminho_repo)
        else:
            caminho_repo = await asyncio.to_thread(clonar_repositorio, repo_url, github_token)
            deve_apagar = True

        logger.info("[ZettaScan:%s] [2/5] Análise de código com Semgrep (SAST)...", scan_id)
        vulns_semgrep: List[Dict] = await asyncio.to_thread(rodar_semgrep, caminho_repo)

        # Garante que achados SAST tenham origem = "codigo"
        for v in vulns_semgrep:
            v.setdefault("tipo", "codigo")

        logger.info("[ZettaScan:%s] [3/5] Verificando dependências com OSV.dev (SCA)...", scan_id)
        vulns_osv: List[Dict] = await asyncio.to_thread(verificar_dependencias, caminho_repo)

        # Garante que achados SCA tenham origem = "dependencia"
        for v in vulns_osv:
            v.setdefault("tipo", "dependencia")

        logger.info("[ZettaScan:%s] [4/5] Analisando infraestrutura (IaC)...", scan_id)
        vulns_iac: List[Dict] = await asyncio.to_thread(analisar_iac, caminho_repo)

        # Garante que achados IaC tenham origem = "iac"
        for v in vulns_iac:
            v.setdefault("tipo", "iac")

        logger.info("[ZettaScan:%s] [5/5] Priorizando com Gemini...", scan_id)
        vulnerabilidades: List[Dict] = await asyncio.to_thread(
            priorizar_com_ia, vulns_semgrep, vulns_osv + vulns_iac
        )

        # Conta as vulnerabilidades por severidade
        contagem = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
        for v in vulnerabilidades:
            sev = v.get("severidade", "LOW").upper()
            if sev in contagem:
                contagem[sev] += 1
            else:
                contagem["LOW"] += 1
                logger.warning(
                    "[ZettaScan:%s] Severidade inválida '%s' normalizada para LOW.",
                    scan_id, sev,
                )

        tempo = round(time.monotonic() - inicio, 2)

        # Geração de caminhos de ataque correlacionados
        attack_paths = gerar_attack_paths(vulnerabilidades, vulns_iac)

        # Avaliação de Quality Gate CI/CD
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
            "iac_total": len(vulns_iac),
            "iac_findings": vulns_iac,
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
        # Apenas apaga se o repositório tiver sido clonado remotamente
        if deve_apagar and caminho_repo:
            logger.info("[ZettaScan:%s] Removendo código temporário...", scan_id)
            await asyncio.to_thread(apagar_repositorio, caminho_repo)


def executar_scan_sync(repo_url: str = ".", github_token: str = "") -> Dict:
    """
    Versão síncrona de executar_scan para uso em scripts, CLI e CI/CD.
    """
    return asyncio.run(executar_scan(repo_url, github_token))
