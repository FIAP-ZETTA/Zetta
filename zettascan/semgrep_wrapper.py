"""
semgrep_wrapper.py
------------------
Executa o Semgrep e normaliza os resultados.

Mapeamento de severidades (documentado e testável):
    Semgrep → ZettaScan
    ─────────────────────────────
    ERROR   → CRITICAL
    WARNING → HIGH
    INFO    → MEDIUM
    (outros)→ LOW

Correções de auditoria 2026-07-14 (1ª passada):
- [S-1] Busca semgrep via shutil.which (PATH) com fallback para .venv local
- [S-2] Mapeamento explícito de severidades Semgrep → padrão do projeto
- [S-3] Substituído print() de debug por logging.debug
- [S-4] timeout=300s no subprocess.run (wrapper do processo inteiro)

Correções de auditoria 2026-07-14 (2ª passada):
- [3-A] Campo "arquivo" sanitizado contra log injection (caracteres de controle)
- [5-A] Suporte a rulesets locais em rulesets/ — use `python baixar_rulesets.py`
         para fixar versões e garantir reprodutibilidade. Se a pasta não existir,
         usa os rulesets remotos como fallback (comportamento original).
"""

import re
import shutil
import subprocess
import json
import logging
from pathlib import Path
from typing import List, Dict

logger = logging.getLogger(__name__)

# ── Mapeamento de severidades ────────────────────────────────────────────────
_MAPA_SEVERIDADE: Dict[str, str] = {
    "ERROR":   "CRITICAL",
    "WARNING": "HIGH",
    "INFO":    "MEDIUM",
}
_SEVERIDADE_DEFAULT = "LOW"

# ── Rulesets ─────────────────────────────────────────────────────────────────
# [5-A] Diretório de rulesets locais (para reproducibilidade)
# Execute `python baixar_rulesets.py` para gerar esses arquivos.
_DIR_RULESETS = Path(__file__).parent / "rulesets"
_RULESETS_LOCAIS = {
    "p/owasp-top-ten": _DIR_RULESETS / "owasp-top-ten.yaml",
    "p/secrets":       _DIR_RULESETS / "secrets.yaml",
}

# Regex para sanitização de log injection — remove controles e escapes ANSI
_RE_CONTROLES = re.compile(r'[\x00-\x1f\x7f]|\x1b\[[0-9;]*[mGKHF]')


def _mapear_severidade(semgrep_sev: str) -> str:
    """
    Converte a severidade do Semgrep para o padrão interno do ZettaScan.
    Retorna: "CRITICAL", "HIGH", "MEDIUM", "LOW"
    """
    return _MAPA_SEVERIDADE.get(semgrep_sev.upper(), _SEVERIDADE_DEFAULT)


def _sanitizar_campo(valor: str) -> str:
    """
    [3-A] Sanitiza uma string contra log injection.
    Remove caracteres de controle (\\n, \\r, \\t, escapes ANSI etc.) que
    poderiam injetar linhas falsas ou corrompidas no log do servidor.
    Um repositório malicioso pode criar arquivos com nomes como:
        "src/login.py\\n2026-07-14 INFO [FAKE] Token: abc123"
    """
    return _RE_CONTROLES.sub('_', valor)


def _encontrar_semgrep() -> str:
    """
    Localiza o executável do semgrep.
    Ordem de busca:
      1. PATH do sistema (instalação global ou venv ativado)
      2. .venv local do projeto (Windows / Linux/Mac)
    """
    caminho = shutil.which("semgrep")
    if caminho:
        return caminho
    for c in [r".\.venv\Scripts\semgrep", "./.venv/bin/semgrep"]:
        if shutil.which(c):
            return c
    raise FileNotFoundError(
        "Semgrep não encontrado. Instale com:\n"
        "  pip install semgrep\n"
        "ou ative o virtualenv do projeto."
    )


def _resolver_configs() -> List[str]:
    """
    [5-A] Retorna a lista de argumentos --config para o Semgrep.
    Usa rulesets locais (fixados) se disponíveis; caso contrário, usa os remotos.
    Os rulesets locais são baixados via `python baixar_rulesets.py`.
    """
    configs: List[str] = []
    usando_locais = True

    for nome_remoto, path_local in _RULESETS_LOCAIS.items():
        if path_local.exists():
            configs.extend(["--config", str(path_local)])
        else:
            configs.extend(["--config", nome_remoto])
            usando_locais = False

    if usando_locais and configs:
        logger.info("[ZettaScan] Usando rulesets locais fixados em: %s", _DIR_RULESETS)
    else:
        logger.warning(
            "[ZettaScan] Rulesets remotos em uso (não fixados). "
            "Execute `python baixar_rulesets.py` para garantir reprodutibilidade."
        )

    return configs


def rodar_semgrep(caminho_repo: str) -> List[Dict]:
    """
    Executa o Semgrep sobre o repositório clonado e retorna os achados
    normalizados com severidades mapeadas para o padrão do projeto.

    Parâmetros:
        caminho_repo: caminho absoluto do diretório clonado

    Retorna:
        Lista de dicionários com campos:
            arquivo, linha, regra, mensagem, severidade, trecho_codigo, tipo
    """
    logger.info("[ZettaScan] Iniciando análise Semgrep em: %s", caminho_repo)

    semgrep_exe = _encontrar_semgrep()
    configs = _resolver_configs()

    try:
        resultado = subprocess.run(
            [
                semgrep_exe,
                *configs,
                "--json",
                "--no-git-ignore",
                "--timeout", "60",
                caminho_repo,
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
            timeout=300,
        )
    except subprocess.TimeoutExpired:
        logger.error("[ZettaScan] Semgrep excedeu o timeout de 300s.")
        return []
    except FileNotFoundError as exc:
        raise FileNotFoundError(str(exc)) from exc

    logger.debug("[ZettaScan] Semgrep stdout (primeiros 2000 chars):\n%s", resultado.stdout[:2000])
    logger.debug("[ZettaScan] Semgrep stderr (primeiros 2000 chars):\n%s", resultado.stderr[:2000])
    logger.debug("[ZettaScan] Semgrep exit code: %d", resultado.returncode)

    if resultado.returncode not in (0, 1):
        logger.warning(
            "[ZettaScan] Semgrep retornou código inesperado: %d. "
            "Continuando com resultado parcial.",
            resultado.returncode,
        )

    if not resultado.stdout.strip():
        logger.info("[ZettaScan] Semgrep não produziu saída JSON. Retornando lista vazia.")
        return []

    try:
        dados = json.loads(resultado.stdout)
    except json.JSONDecodeError as exc:
        logger.error("[ZettaScan] Erro ao parsear JSON do Semgrep: %s", exc)
        return []

    resultados_brutos = dados.get("results", [])
    vulnerabilidades: List[Dict] = []

    for item in resultados_brutos:
        sev_bruta = item.get("extra", {}).get("severity", "INFO")

        # [3-A] Campo arquivo sanitizado — impede log injection via nome de arquivo
        arquivo_raw = item.get("path", "").replace(caminho_repo, "").lstrip("\\/")
        arquivo_seguro = _sanitizar_campo(arquivo_raw)

        vulnerabilidades.append(
            {
                "arquivo": arquivo_seguro,
                "linha": item.get("start", {}).get("line", 0),
                "regra": item.get("check_id", ""),
                "mensagem": item.get("extra", {}).get("message", ""),
                "severidade": _mapear_severidade(sev_bruta),
                "severidade_original_semgrep": sev_bruta,
                "trecho_codigo": item.get("extra", {}).get("lines", ""),
                "tipo": "codigo",
            }
        )

    logger.info("[ZettaScan] Semgrep encontrou %d problema(s).", len(vulnerabilidades))
    return vulnerabilidades