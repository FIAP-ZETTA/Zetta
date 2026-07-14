"""
osv_client.py
-------------
Responsável por verificar as dependências do projeto
contra o banco de dados público OSV.dev do Google.

OSV = Open Source Vulnerabilities
É um banco gratuito com todos os CVEs (vulnerabilidades conhecidas)
de pacotes open source (npm, pip, maven, etc).

Exemplo: se o projeto usa Django 3.0.0, esse módulo descobre
que essa versão tem CVEs críticos e retorna essa info.

Fluxo:
1. Lê o arquivo de dependências do repo (requirements.txt, package.json, etc.)
2. Envia TODAS as dependências de uma vez via endpoint querybatch (uma única request)
3. Retorna a lista de CVEs encontrados

Correções de auditoria 2026-07-14:
- [O-1] Refatorado para usar /v1/querybatch — uma requisição para todas as deps
- [O-2] Aviso para dependências sem versão fixada
- [O-3] Parsing de requirements.txt mais robusto (trata extras, VCS URLs, flags)
- [O-4] Cache em memória por (nome, versão, ecossistema) durante a execução
- [O-5] Parsing de score CVSS corrigido — o campo "score" é um vetor CVSS,
         não um float; extrai o valor numérico corretamente
"""

import json
import logging
import re
import httpx
from pathlib import Path
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# Endpoints da API pública do OSV.dev — sem chave, completamente gratuita
OSV_API_BATCH = "https://api.osv.dev/v1/querybatch"

# Timeout para a requisição em batch
_OSV_TIMEOUT_S = 30

# Cache em memória para evitar consultas duplicadas dentro da mesma execução
# Chave: (nome, versao, ecosistema) → Valor: List[Dict] de vulnerabilidades
_cache_osv: Dict[Tuple[str, str, str], List[Dict]] = {}


# ── Parsing de severidade CVSS ───────────────────────────────────────────────

# Regex para extrair o score numérico de um vetor CVSS
# Exemplos de input: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"
# O score numérico NÃO está no vetor — está no campo separado "score" do OSV
# quando o tipo é "CVSS_V3_SCORE". Para "CVSS_V3" o campo score pode ser numérico.
_RE_SCORE_NUMERICO = re.compile(r"^\d+(\.\d+)?$")


def _cvss_score_para_severidade(score_raw: str) -> Optional[str]:
    """
    Converte um score CVSS (string) para o nível de severidade do ZettaScan.

    O campo 'score' do OSV.dev no tipo CVSS_V3 pode ser:
      - Um número: "9.8"
      - Um vetor CVSS: "CVSS:3.1/AV:N/..." (neste caso não é possível extrair o score
        sem calcular o vetor; retorna None para usar fallback)

    Retorna: "CRITICAL", "HIGH", "MEDIUM", "LOW" ou None se não parseável.
    """
    s = str(score_raw).strip()

    # [O-5] Só processa se for um número — vetores CVSS não são scores numéricos
    if not _RE_SCORE_NUMERICO.match(s):
        logger.debug("[ZettaScan] score CVSS não numérico, ignorando: %s", s)
        return None

    try:
        valor = float(s)
    except ValueError:
        return None

    if valor >= 9.0:
        return "CRITICAL"
    elif valor >= 7.0:
        return "HIGH"
    elif valor >= 4.0:
        return "MEDIUM"
    else:
        return "LOW"


def _extrair_severidade_osv(vuln: Dict) -> str:
    """
    Extrai e normaliza a severidade de um objeto de vulnerabilidade do OSV.

    Ordem de preferência:
    1. database_specific.severity (já é texto como "HIGH")
    2. severity[].type == "CVSS_V3_SCORE" ou "CVSS_V3" → converte score numérico
    3. Fallback: "MEDIUM" (conservador)
    """
    # 1) Campo direto de texto (mais confiável)
    sev_direta = vuln.get("database_specific", {}).get("severity", "")
    if sev_direta and sev_direta.upper() in ("CRITICAL", "HIGH", "MEDIUM", "LOW"):
        return sev_direta.upper()

    # 2) Vetor de severidades CVSS
    for s in vuln.get("severity", []):
        tipo = s.get("type", "")
        score_raw = s.get("score", "")
        if tipo in ("CVSS_V3", "CVSS_V3_SCORE") and score_raw:
            sev = _cvss_score_para_severidade(score_raw)
            if sev:
                return sev

    # 3) Fallback conservador
    return "MEDIUM"


# ── Parsing de dependências ──────────────────────────────────────────────────

# Regex para requirement simples: nome[extras]==versao (reqs sem VCS, sem flags)
_RE_REQ = re.compile(
    r"^(?P<nome>[A-Za-z0-9_.\-]+)"  # nome do pacote
    r"(\[.*?\])?"                    # extras opcionais [jpeg]
    r"\s*(?P<op>[=!<>~]+)\s*"        # operador de versão
    r"(?P<versao>[^\s,;]+)",         # versão
    re.IGNORECASE,
)


def _ler_requirements_txt(caminho: Path) -> List[Dict]:
    """
    Faz o parsing de um requirements.txt.

    [O-3] Trata:
    - Comentários (#) e linhas vazias → ignora
    - Flags (-r, -c, -e, --index-url, etc.) → ignora
    - URLs VCS (git+https://) → ignora (sem versão fixada)
    - Extras ([jpeg], [security]) → strips antes de extrair nome
    - Pacotes sem versão fixada → registra aviso [O-2]
    - Múltiplos especificadores (requests>=2.0,<3.0) → usa o primeiro valor

    Retorna lista de dicts {"nome", "versao", "ecosistema"}.
    """
    deps: List[Dict] = []
    logger.info("[ZettaScan] Lendo requirements.txt...")

    for linha_raw in caminho.read_text(encoding="utf-8", errors="ignore").splitlines():
        linha = linha_raw.strip()

        # Ignora comentários, vazias e flags de pip
        if not linha or linha.startswith("#") or linha.startswith("-"):
            continue

        # Ignora VCS / URLs diretas
        if linha.startswith(("git+", "http://", "https://", "svn+", "hg+")):
            logger.debug("[ZettaScan] requirements.txt: linha de VCS ignorada: %s", linha)
            continue

        m = _RE_REQ.match(linha)
        if m:
            nome = m.group("nome").strip()
            op = m.group("op")
            versao = m.group("versao").strip().split(",")[0]  # pega só o primeiro pin

            # [O-2] Avisa sobre deps sem pin exato
            if op != "==":
                logger.warning(
                    "[ZettaScan] Dependência '%s' sem versão fixada (%s%s). "
                    "OSV será consultado com a versão mínima declarada.",
                    nome, op, versao,
                )

            deps.append({"nome": nome, "versao": versao, "ecosistema": "PyPI"})
        else:
            # Linha sem operador de versão → sem pin
            nome_sem_extras = re.split(r"[\[;@]", linha)[0].strip()
            if nome_sem_extras:
                logger.warning(
                    "[ZettaScan] Dependência '%s' sem versão declarada — ignorada na consulta OSV.",
                    nome_sem_extras,
                )

    return deps


def _ler_package_json(caminho: Path) -> List[Dict]:
    """
    Faz o parsing de um package.json (Node.js).
    Remove prefixos de range (^, ~, >=, etc.) para obter a versão mínima.
    """
    deps: List[Dict] = []
    logger.info("[ZettaScan] Lendo package.json...")

    try:
        dados = json.loads(caminho.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        logger.warning("[ZettaScan] package.json inválido — ignorando.")
        return []

    todas: Dict[str, str] = {}
    todas.update(dados.get("dependencies", {}))
    todas.update(dados.get("devDependencies", {}))

    for nome, versao_raw in todas.items():
        versao_limpa = versao_raw.lstrip("^~>=< ").strip()
        if not versao_limpa or versao_limpa in ("*", "latest"):
            # [O-2] Deps sem versão concreta
            logger.warning(
                "[ZettaScan] Pacote npm '%s' sem versão fixada ('%s') — ignorado na consulta OSV.",
                nome, versao_raw,
            )
            continue
        deps.append({"nome": nome, "versao": versao_limpa, "ecosistema": "npm"})

    return deps


def ler_dependencias(caminho_repo: str) -> List[Dict]:
    """
    Lê os arquivos de dependências do repositório.
    Suporta: requirements.txt (Python) e package.json (Node.js).

    Retorna lista de dicionários:
    [{"nome": "django", "versao": "3.0.0", "ecosistema": "PyPI"}, ...]
    """
    dependencias: List[Dict] = []
    repo = Path(caminho_repo)

    req_txt = repo / "requirements.txt"
    if req_txt.exists():
        dependencias.extend(_ler_requirements_txt(req_txt))

    pkg_json = repo / "package.json"
    if pkg_json.exists():
        dependencias.extend(_ler_package_json(pkg_json))

    logger.info("[ZettaScan] %d dependências encontradas para verificar.", len(dependencias))
    return dependencias


# ── Consulta OSV em batch ────────────────────────────────────────────────────

def _formatar_vuln(v: Dict, nome: str, versao: str, ecosistema: str) -> Dict:
    """Formata um objeto de vulnerabilidade OSV para o padrão ZettaScan."""
    return {
        "pacote": nome,
        "versao": versao,
        "ecosistema": ecosistema,
        "cve_id": v.get("id", ""),
        "titulo": v.get("summary", "Vulnerabilidade sem título"),
        "severidade": _extrair_severidade_osv(v),
        "tipo": "dependencia",
    }


def consultar_osv_batch(dependencias: List[Dict]) -> List[Dict]:
    """
    [O-1] Consulta o OSV.dev para TODAS as dependências de uma só vez,
    usando o endpoint /v1/querybatch.

    Isso reduz N round-trips para 1 única requisição HTTP.

    A OSV API querybatch retorna as respostas na MESMA ORDEM das queries enviadas.

    Parâmetros:
        dependencias: lista de dicts com "nome", "versao", "ecosistema"

    Retorna:
        Lista de todas as vulnerabilidades encontradas.
    """
    if not dependencias:
        return []

    # [O-4] Filtra dependências já em cache
    deps_novas: List[Dict] = []
    deps_cache: List[Dict] = []

    for dep in dependencias:
        chave = (dep["nome"], dep["versao"], dep["ecosistema"])
        if chave in _cache_osv:
            deps_cache.extend(_cache_osv[chave])
        else:
            deps_novas.append(dep)

    if not deps_novas:
        logger.info("[ZettaScan] Todos os resultados OSV vieram do cache.")
        return deps_cache

    # Monta o payload para querybatch
    queries = [
        {
            "version": dep["versao"],
            "package": {"name": dep["nome"], "ecosystem": dep["ecosistema"]},
        }
        for dep in deps_novas
    ]

    try:
        resposta = httpx.post(
            OSV_API_BATCH,
            json={"queries": queries},
            timeout=_OSV_TIMEOUT_S,
        )
        resposta.raise_for_status()
        dados = resposta.json()
    except httpx.TimeoutException:
        logger.error(
            "[ZettaScan] Timeout ao consultar OSV.dev (%ds). "
            "Seção de CVEs de dependências omitida do relatório.",
            _OSV_TIMEOUT_S,
        )
        return deps_cache  # Degradação graciosa — relatório sem CVEs, mas sem crash
    except Exception as exc:
        logger.error(
            "[ZettaScan] Erro ao consultar OSV.dev: %s. "
            "Seção de CVEs de dependências omitida do relatório.",
            exc,
        )
        return deps_cache

    # Processa respostas na ordem (a OSV garante correspondência 1-a-1 com as queries)
    resultados_novos: List[Dict] = []
    resultados_batch = dados.get("results", [])

    for idx, (dep, resultado_dep) in enumerate(zip(deps_novas, resultados_batch)):
        chave = (dep["nome"], dep["versao"], dep["ecosistema"])
        vulns_dep: List[Dict] = []

        for v in resultado_dep.get("vulns", []):
            vulns_dep.append(_formatar_vuln(v, dep["nome"], dep["versao"], dep["ecosistema"]))

        _cache_osv[chave] = vulns_dep  # [O-4] Armazena no cache
        resultados_novos.extend(vulns_dep)

    todas = deps_cache + resultados_novos
    logger.info("[ZettaScan] OSV encontrou %d CVE(s) nas dependências.", len(todas))
    return todas


def verificar_dependencias(caminho_repo: str) -> List[Dict]:
    """
    Função principal: lê as dependências do repo e verifica todas no OSV.

    Retorna lista de todas as vulnerabilidades encontradas nas dependências.
    Em caso de falha de rede, retorna lista vazia (degradação graciosa).
    """
    dependencias = ler_dependencias(caminho_repo)

    if not dependencias:
        logger.info("[ZettaScan] Nenhum arquivo de dependências encontrado ou nenhuma dep com versão.")
        return []

    return consultar_osv_batch(dependencias)
