"""
semgrep_wrapper.py
------------------
Executa o Semgrep e normaliza os resultados.
Conta com motor SAST nativo para execução resiliente em ambientes Windows ou quando o CLI não estiver disponível.

Mapeamento de severidades:
    Semgrep / SAST → ZettaScan
    ─────────────────────────────
    ERROR / CRITICAL → CRITICAL
    WARNING / HIGH   → HIGH
    INFO / MEDIUM    → MEDIUM
    (outros)         → LOW
"""

import os
import re
import sys
import shutil
import subprocess
import json
import logging
from pathlib import Path
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)

# ── Mapeamento de severidades ────────────────────────────────────────────────
_MAPA_SEVERIDADE: Dict[str, str] = {
    "ERROR":    "CRITICAL",
    "CRITICAL": "CRITICAL",
    "WARNING":  "HIGH",
    "HIGH":     "HIGH",
    "INFO":     "MEDIUM",
    "MEDIUM":   "MEDIUM",
    "LOW":      "LOW",
}
_SEVERIDADE_DEFAULT = "LOW"

# Regex para sanitização de log injection — remove controles e escapes ANSI
_RE_CONTROLES = re.compile(r'[\x00-\x1f\x7f]|\x1b\[[0-9;]*[mGKHF]')

# ── Regras SAST Nativas (Fallback Resiliente para Windows / Semgrep indisponível) ─
_REGRAS_SAST = [
    {
        "id": "owasp.top10.a03.sql-injection",
        "nome": "SQL Injection",
        "mensagem": "Possível injeção de SQL detectada através de concatenação ou formatação de string em consulta de banco de dados.",
        "severidade": "ERROR",
        "pattern": re.compile(r'(?:SELECT|INSERT|UPDATE|DELETE|FROM|WHERE)\b[^\n"\']*(?:\+|%|\.format|f[\'"]|\$\{)[^\n]*', re.IGNORECASE),
        "extensoes": {".py", ".js", ".ts", ".jsx", ".tsx", ".php", ".java", ".go"},
    },
    {
        "id": "owasp.top10.a07.hardcoded-secret",
        "nome": "Hardcoded Secret / Token",
        "mensagem": "Chave de API, segredo criptográfico ou token sensível exposto diretamente no código-fonte.",
        "severidade": "ERROR",
        "pattern": re.compile(r'(?:api[_-]?key|secret|password|passwd|token|jwt_secret)\s*[:=]\s*["\'][A-Za-z0-9_\-\.]{8,}["\']', re.IGNORECASE),
        "extensoes": {".py", ".js", ".ts", ".jsx", ".tsx", ".json", ".env", ".yaml", ".yml", ".go", ".java"},
    },
    {
        "id": "owasp.top10.a03.command-injection",
        "nome": "Command Injection / RCE",
        "mensagem": "Execução de comando de sistema operacional potencialmente inseguro com entrada não sanitizada.",
        "severidade": "ERROR",
        "pattern": re.compile(r'(?:os\.system|subprocess\.(?:Popen|run|call)\(.*shell\s*=\s*True|child_process\.exec\b|exec\b\s*\(|eval\b\s*\()', re.IGNORECASE),
        "extensoes": {".py", ".js", ".ts", ".jsx", ".tsx", ".php"},
    },
    {
        "id": "owasp.top10.a03.xss",
        "nome": "Cross-Site Scripting (XSS)",
        "mensagem": "Renderização direta de HTML/DOM sem sanitização adequada contra ataques XSS.",
        "severidade": "WARNING",
        "pattern": re.compile(r'(?:dangerouslySetInnerHTML\s*=\s*\{|innerHTML\s*=|document\.write\s*\(|res\.send\([^\)]*<[a-z]+)', re.IGNORECASE),
        "extensoes": {".js", ".ts", ".jsx", ".tsx", ".html", ".php"},
    },
    {
        "id": "owasp.top10.a02.weak-cryptography",
        "nome": "Criptografia Fraca (MD5/SHA1)",
        "mensagem": "Uso de algoritmo de hash obsoleto ou criptografia vulnerável para proteção de dados sensíveis.",
        "severidade": "INFO",
        "pattern": re.compile(r'(?:hashlib\.(?:md5|sha1)|crypto\.createHash\(["\'](?:md5|sha1)["\'])', re.IGNORECASE),
        "extensoes": {".py", ".js", ".ts", ".jsx", ".tsx", ".java"},
    },
    {
        "id": "owasp.top10.a01.broken-access-control",
        "nome": "Insecure Direct Object Reference / Path Traversal",
        "mensagem": "Manipulação de caminho de arquivos ou recursos sem validação de permissões de acesso.",
        "severidade": "WARNING",
        "pattern": re.compile(r'(?:fs\.readFileSync|open\(|send_file\()\s*req\.(?:query|params|body)', re.IGNORECASE),
        "extensoes": {".py", ".js", ".ts", ".jsx", ".tsx"},
    },
]


def _mapear_severidade(semgrep_sev: str) -> str:
    """Converte a severidade para o padrão interno do ZettaScan."""
    return _MAPA_SEVERIDADE.get(semgrep_sev.upper(), _SEVERIDADE_DEFAULT)


def _sanitizar_campo(valor: str) -> str:
    """Remove caracteres de controle para prevenir log injection."""
    return _RE_CONTROLES.sub('_', valor)


def _encontrar_semgrep() -> Optional[str]:
    """Tenta localizar o executável do semgrep no sistema."""
    caminho = shutil.which("semgrep")
    if caminho:
        return caminho

    # Busca em .venv ou caminhos conhecidos do Python
    pastas_busca = [
        r".\.venv\Scripts\semgrep.exe",
        "./.venv/bin/semgrep",
        Path(sys.executable).parent / "Scripts" / "semgrep.exe",
        Path(sys.executable).parent / "Scripts" / "semgrep",
    ]
    for c in pastas_busca:
        c_str = str(c)
        if os.path.exists(c_str) or shutil.which(c_str):
            return c_str
    return None


def _analisador_sast_nativo(caminho_repo: str) -> List[Dict]:
    """
    Motor SAST nativo do ZettaScan:
    Varre os arquivos de código buscando padrões de vulnerabilidade conhecidos.
    Garante funcionamento 100% autônomo em Windows e qualquer outro SO.
    """
    logger.info("[ZettaScan] Executando análise SAST nativa em: %s", caminho_repo)
    vulnerabilidades: List[Dict] = []
    repo_path = Path(caminho_repo)
    
    # Pastas ignoradas
    ignorar_dirs = {".git", "node_modules", "venv", ".venv", "dist", "build", "__pycache__"}

    for raiz, dirs, arquivos in os.walk(caminho_repo):
        # Filtra diretórios
        dirs[:] = [d for d in dirs if d not in ignorar_dirs]

        for arquivo in arquivos:
            ext = Path(arquivo).suffix.lower()
            regras_aplicaveis = [r for r in _REGRAS_SAST if ext in r["extensoes"]]
            if not regras_aplicaveis:
                continue

            caminho_completo = Path(raiz) / arquivo
            try:
                with open(caminho_completo, "r", encoding="utf-8", errors="ignore") as f:
                    linhas = f.readlines()
            except Exception as e:
                logger.debug("Não foi possível ler %s: %s", caminho_completo, e)
                continue

            for idx_linha, linha in enumerate(linhas, start=1):
                linha_limpa = linha.strip()
                if not linha_limpa or linha_limpa.startswith(("#", "//", "/*", "*")):
                    continue

                for regra in regras_aplicaveis:
                    if regra["pattern"].search(linha):
                        rel_path = str(caminho_completo.relative_to(repo_path)).replace("\\", "/")
                        vulnerabilidades.append({
                            "arquivo": _sanitizar_campo(rel_path),
                            "linha": idx_linha,
                            "regra": regra["id"],
                            "mensagem": regra["mensagem"],
                            "severidade": _mapear_severidade(regra["severidade"]),
                            "severidade_original_semgrep": regra["severidade"],
                            "trecho_codigo": linha_limpa[:200],
                            "tipo": "codigo",
                        })

    logger.info("[ZettaScan] Análise SAST nativa concluiu com %d vulnerabilidade(s).", len(vulnerabilidades))
    return vulnerabilidades


def rodar_semgrep(caminho_repo: str) -> List[Dict]:
    """
    Executa a análise estática no repositório.
    Tenta o Semgrep oficial em qualquer plataforma (incluindo Windows).
    Se indisponível ou falhar, usa o motor SAST nativo como fallback.
    """
    logger.info("[ZettaScan] Iniciando varredura estática de código em: %s", caminho_repo)

    semgrep_exe = _encontrar_semgrep()

    if semgrep_exe:
        logger.info("[ZettaScan] Semgrep encontrado em: %s. Executando análise...", semgrep_exe)
        try:
            resultado = subprocess.run(
                [
                    semgrep_exe,
                    "--config", "p/owasp-top-ten",
                    "--config", "p/secrets",
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
            if resultado.stdout.strip():
                try:
                    dados = json.loads(resultado.stdout)
                except json.JSONDecodeError as je:
                    logger.warning("[ZettaScan] Semgrep retornou JSON inválido (%s). Usando fallback SAST.", je)
                    return _analisador_sast_nativo(caminho_repo)

                resultados_brutos = dados.get("results", [])
                vulnerabilidades: List[Dict] = []
                for item in resultados_brutos:
                    sev_bruta = item.get("extra", {}).get("severity", "INFO")
                    arquivo_raw = item.get("path", "").replace(caminho_repo, "").lstrip("\\/")
                    vulnerabilidades.append({
                        "arquivo": _sanitizar_campo(arquivo_raw),
                        "linha": item.get("start", {}).get("line", 0),
                        "regra": item.get("check_id", ""),
                        "mensagem": item.get("extra", {}).get("message", ""),
                        "severidade": _mapear_severidade(sev_bruta),
                        "severidade_original_semgrep": sev_bruta,
                        "trecho_codigo": item.get("extra", {}).get("lines", ""),
                        "tipo": "codigo",
                    })
                logger.info("[ZettaScan] Semgrep encontrou %d problema(s).", len(vulnerabilidades))
                return vulnerabilidades
            else:
                # stdout vazio pode significar sem achados (não é erro)
                stderr_info = resultado.stderr[:300] if resultado.stderr else ""
                logger.info("[ZettaScan] Semgrep sem resultados (rc=%d). stderr: %s", resultado.returncode, stderr_info)
                # Retorna lista vazia se saiu com 0 (sem achados) ou fallback se erro
                if resultado.returncode in (0, 1):  # 0=ok, 1=achados (semgrep rc semântico)
                    return []
                logger.warning("[ZettaScan] Semgrep saiu com rc=%d. Usando fallback SAST.", resultado.returncode)
        except FileNotFoundError:
            logger.warning("[ZettaScan] Semgrep não encontrado no PATH. Usando fallback SAST nativo.")
        except subprocess.TimeoutExpired:
            logger.warning("[ZettaScan] Semgrep excedeu o tempo limite. Usando fallback SAST nativo.")
        except Exception as e:
            logger.warning("[ZettaScan] Semgrep CLI falhou (%s). Recorrendo ao motor SAST nativo...", e)
    else:
        logger.warning("[ZettaScan] Semgrep não encontrado no sistema. Execute: pip install semgrep. Usando motor SAST nativo.")

    # Fallback SAST nativo de alta performance
    return _analisador_sast_nativo(caminho_repo)