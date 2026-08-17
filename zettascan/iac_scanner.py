"""
iac_scanner.py
--------------
Módulo de análise de Infrastructure as Code (IaC) do ZettaScan.

Analisa arquivos de configuração de infraestrutura em busca de problemas de segurança:
  - Dockerfile: imagens inseguras, usuário root, portas perigosas, env vars expostas
  - docker-compose.yml: volumes perigosos, variáveis sensíveis não mascaradas
  - .github/workflows/*.yml: secrets sem mascaramento, permissões excessivas
  - *.tf (Terraform): buckets públicos, portas abertas para 0.0.0.0/0

Retorna achados no mesmo formato do semgrep_wrapper.py para integração uniforme.
"""

import logging
import re
from pathlib import Path
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

# ── Regras de análise de Dockerfile ─────────────────────────────────────────

_REGRAS_DOCKERFILE: List[Dict] = [
    {
        "id": "iac.docker.insecure-base-image",
        "nome": "Imagem Base Insegura / Desatualizada",
        "mensagem": (
            "Imagem base com tag genérica 'latest' ou versão antiga. "
            "Use imagens com versão fixa e verifique CVEs conhecidos (ex: FROM node:20-alpine)."
        ),
        "severidade": "HIGH",
        "pattern": re.compile(
            r"^\s*FROM\s+(?!scratch)(?:\S+:latest|\S+:(?:18|16|14|12|10|8)\.|ubuntu:(?:16|18|20)\.04|debian:(?:8|9)\b|python:2\.|node:(?:14|12|10)\b)",
            re.IGNORECASE,
        ),
    },
    {
        "id": "iac.docker.running-as-root",
        "nome": "Container Executando como Root",
        "mensagem": (
            "Nenhuma instrução USER encontrada antes de CMD/ENTRYPOINT. "
            "Containers rodando como root ampliam o impacto de um comprometimento. "
            "Adicione: USER nonroot"
        ),
        "severidade": "HIGH",
        "pattern": re.compile(
            r"^\s*(?:CMD|ENTRYPOINT)\s",
            re.IGNORECASE,
        ),
        "flag_ausencia": True,  # Sinaliza problema quando USER não aparece antes deste ponto
        "trigger_ausencia": re.compile(r"^\s*USER\s+(?!root\b)\S+", re.IGNORECASE),
    },
    {
        "id": "iac.docker.hardcoded-secret",
        "nome": "Segredo Hardcoded em ENV do Dockerfile",
        "mensagem": (
            "Variável de ambiente com valor sensível exposto diretamente no Dockerfile. "
            "Use Docker secrets ou variáveis de build-time sem valor padrão: "
            "ARG DB_PASSWORD (sem =valor)"
        ),
        "severidade": "CRITICAL",
        "pattern": re.compile(
            r"^\s*ENV\s+(?:PASSWORD|SECRET|TOKEN|KEY|API_KEY|DB_PASS|PRIVATE)[^\n]*=\s*\S+",
            re.IGNORECASE,
        ),
    },
    {
        "id": "iac.docker.add-instead-of-copy",
        "nome": "Uso de ADD ao invés de COPY",
        "mensagem": (
            "ADD pode extrair arquivos remotos ou tarballs, introduzindo risco de SSRF ou "
            "injeção de arquivos não esperados. Prefira COPY para transferência simples de arquivos."
        ),
        "severidade": "MEDIUM",
        "pattern": re.compile(r"^\s*ADD\s+https?://", re.IGNORECASE),
    },
    {
        "id": "iac.docker.privileged-port",
        "nome": "Porta Privilegiada Exposta (< 1024)",
        "mensagem": (
            "Portas abaixo de 1024 requerem privilégios de root para binding. "
            "Considere usar portas > 1024 internamente e mapear via -p no runtime."
        ),
        "severidade": "MEDIUM",
        "pattern": re.compile(
            r"^\s*EXPOSE\s+(?:[0-9]{1,3}|10[0-1][0-9]|102[0-3])\b",
        ),
    },
    {
        "id": "iac.docker.apt-get-no-version",
        "nome": "Instalação de Pacote Sem Versão Fixada",
        "mensagem": (
            "apt-get install sem versão fixa pode instalar versões com vulnerabilidades novas "
            "em builds futuros. Fixe versões: apt-get install -y libssl1.1=1.1.1f-1ubuntu2"
        ),
        "severidade": "LOW",
        "pattern": re.compile(
            r"apt-get\s+install\s+(?!--no-install-recommends\s*-y\s+\S+=|\s*-y\s+\S+=).*\s+\S+(?<!=\S)",
            re.IGNORECASE,
        ),
    },
]

# ── Regras de análise de docker-compose ─────────────────────────────────────

_REGRAS_COMPOSE: List[Dict] = [
    {
        "id": "iac.compose.privileged-mode",
        "nome": "Serviço Executando em Modo Privilegiado",
        "mensagem": (
            "privileged: true concede ao container acesso quase irrestrito ao host. "
            "Evite em produção — use capabilities específicas: cap_add: [NET_BIND_SERVICE]"
        ),
        "severidade": "CRITICAL",
        "pattern": re.compile(r"^\s+privileged:\s*true", re.IGNORECASE),
    },
    {
        "id": "iac.compose.exposed-env-secret",
        "nome": "Segredo Exposto em Variável de Ambiente",
        "mensagem": (
            "Credenciais hardcoded em environment: do docker-compose.yml são versionadas no Git. "
            "Use um arquivo .env (no .gitignore) ou Docker Secrets para valores sensíveis."
        ),
        "severidade": "CRITICAL",
        "pattern": re.compile(
            r"^\s+-?\s*(?:PASSWORD|SECRET|TOKEN|API_KEY|PRIVATE_KEY|DB_PASS)\w*\s*[:=]\s*\S+",
            re.IGNORECASE,
        ),
    },
    {
        "id": "iac.compose.host-volume-mount",
        "nome": "Montagem de Volume do Host (/etc, /var, /proc)",
        "mensagem": (
            "Montar diretórios sensíveis do host (/etc, /proc, /var, /sys) "
            "pode expor o sistema operacional inteiro ao container. "
            "Valide a necessidade e use volumes nomeados."
        ),
        "severidade": "HIGH",
        "pattern": re.compile(
            r"^\s+-\s*['\"]?/(?:etc|proc|var|sys|root|boot|dev)\b",
            re.IGNORECASE,
        ),
    },
    {
        "id": "iac.compose.no-read-only",
        "nome": "Sistema de Arquivos do Container Sem Modo Read-Only",
        "mensagem": (
            "Sem read_only: true, um atacante que comprometer o container pode "
            "modificar binários internos. Adicione: read_only: true nos serviços críticos."
        ),
        "severidade": "LOW",
        "pattern": re.compile(r"^\s+image:\s+\S+"),
        "flag_ausencia": True,
        "trigger_ausencia": re.compile(r"read_only:\s*true", re.IGNORECASE),
    },
]

# ── Regras de análise de GitHub Actions ─────────────────────────────────────

_REGRAS_GITHUB_ACTIONS: List[Dict] = [
    {
        "id": "iac.cicd.secret-in-run",
        "nome": "Segredo Potencialmente Logado em Comando de Shell",
        "mensagem": (
            "Variáveis de ambiente sensíveis interpoladas diretamente em comandos run: "
            "podem vazar em logs do GitHub Actions se o runner for comprometido. "
            "Use mascaramento: echo '::add-mask::${{ secrets.TOKEN }}'"
        ),
        "severidade": "HIGH",
        "pattern": re.compile(
            r"echo\s+\$\{\{?\s*secrets\.",
            re.IGNORECASE,
        ),
    },
    {
        "id": "iac.cicd.write-all-permissions",
        "nome": "Permissões Excessivas no Workflow (write-all)",
        "mensagem": (
            "permissions: write-all concede permissão de escrita em todos os escopos do repositório. "
            "Aplique o princípio de menor privilégio: defina permissões mínimas por job."
        ),
        "severidade": "HIGH",
        "pattern": re.compile(r"permissions:\s*write-all", re.IGNORECASE),
    },
    {
        "id": "iac.cicd.untrusted-action-ref",
        "nome": "Referência de Action Sem SHA Fixo (Risco de Supply Chain)",
        "mensagem": (
            "Usar actions/@v3 ou @main sem SHA fixo permite que uma action comprometida "
            "execute código arbitrário em todos os pipelines. "
            "Use: uses: actions/checkout@abc123def (SHA do commit)"
        ),
        "severidade": "MEDIUM",
        "pattern": re.compile(
            r"uses:\s+[^@]+@(?:main|master|v\d+(?:\.\d+)?(?:\.\d+)?)\s*$",
            re.IGNORECASE,
        ),
    },
    {
        "id": "iac.cicd.pull-request-target-risk",
        "nome": "Workflow Acionado por pull_request_target",
        "mensagem": (
            "pull_request_target executa com permissões do repositório base, "
            "podendo ser explorado para exfiltrar secrets em PRs de forks. "
            "Evite combinar com checkout do código do PR sem revisão."
        ),
        "severidade": "HIGH",
        "pattern": re.compile(r"on:\s*\n\s+pull_request_target", re.IGNORECASE),
    },
]

# ── Regras de análise de Terraform ──────────────────────────────────────────

_REGRAS_TERRAFORM: List[Dict] = [
    {
        "id": "iac.terraform.public-s3-bucket",
        "nome": "Bucket S3 Público",
        "mensagem": (
            "acl = \"public-read\" ou \"public-read-write\" expõe o bucket para a internet. "
            "Use ACLs privadas e políticas de bucket com aws_s3_bucket_policy."
        ),
        "severidade": "CRITICAL",
        "pattern": re.compile(r'acl\s*=\s*"public-read(?:-write)?"', re.IGNORECASE),
    },
    {
        "id": "iac.terraform.unrestricted-sg-ingress",
        "nome": "Security Group com Ingress Irrestrito (0.0.0.0/0)",
        "mensagem": (
            "cidr_blocks = [\"0.0.0.0/0\"] em ingress expõe o recurso para toda a internet. "
            "Restrinja ao CIDR mínimo necessário ou use security groups como fonte."
        ),
        "severidade": "HIGH",
        "pattern": re.compile(
            r'cidr_blocks\s*=\s*\[(?:\s*"0\.0\.0\.0/0"\s*|[^]]*"0\.0\.0\.0/0"[^]]*)\]',
            re.IGNORECASE,
        ),
    },
    {
        "id": "iac.terraform.hardcoded-credentials",
        "nome": "Credenciais Hardcoded no Terraform",
        "mensagem": (
            "access_key ou secret_key hardcoded no arquivo .tf ficam expostos no estado "
            "e no controle de versão. Use variáveis de ambiente AWS_ ou IAM roles."
        ),
        "severidade": "CRITICAL",
        "pattern": re.compile(
            r'(?:access_key|secret_key|password)\s*=\s*"[^"]{8,}"',
            re.IGNORECASE,
        ),
    },
]


# ── Mapeamento de arquivos para regras ───────────────────────────────────────

def _detectar_tipo_arquivo(caminho: Path) -> Optional[str]:
    """Detecta o tipo de arquivo IaC pelo nome ou extensão."""
    nome = caminho.name.lower()
    partes = [p.lower() for p in caminho.parts]

    if nome == "dockerfile" or nome.startswith("dockerfile."):
        return "dockerfile"
    if nome in ("docker-compose.yml", "docker-compose.yaml",
                "compose.yml", "compose.yaml"):
        return "compose"
    if nome.endswith((".yml", ".yaml")) and ".github" in partes and "workflows" in partes:
        return "github_actions"
    if nome.endswith(".tf"):
        return "terraform"
    return None


def _analisar_arquivo_iac(caminho_arquivo: Path, tipo: str) -> List[Dict]:
    """Analisa um único arquivo IaC e retorna os achados no formato ZettaScan."""
    regras_map = {
        "dockerfile": _REGRAS_DOCKERFILE,
        "compose": _REGRAS_COMPOSE,
        "github_actions": _REGRAS_GITHUB_ACTIONS,
        "terraform": _REGRAS_TERRAFORM,
    }
    regras = regras_map.get(tipo, [])
    if not regras:
        return []

    achados: List[Dict] = []

    try:
        conteudo = caminho_arquivo.read_text(encoding="utf-8", errors="ignore")
        linhas = conteudo.splitlines()
    except Exception as e:
        logger.warning("[IaC] Não foi possível ler %s: %s", caminho_arquivo, e)
        return []

    # Para regras de "flag_ausencia", verificamos se o trigger existe no arquivo todo
    triggers_presentes = set()
    for regra in regras:
        if regra.get("flag_ausencia") and regra.get("trigger_ausencia"):
            if regra["trigger_ausencia"].search(conteudo):
                triggers_presentes.add(regra["id"])

    for idx, linha in enumerate(linhas, start=1):
        for regra in regras:
            # Regras de flag_ausencia são tratadas por arquivo, não por linha
            if regra.get("flag_ausencia"):
                continue

            if regra["pattern"].search(linha):
                achados.append({
                    "arquivo": str(caminho_arquivo.name),
                    "linha": idx,
                    "regra": regra["id"],
                    "mensagem": regra["mensagem"],
                    "severidade": regra["severidade"],
                    "tipo": "iac",
                    "nome": regra["nome"],
                })

    # Processa regras de flag_ausencia no nível de arquivo
    for regra in regras:
        if regra.get("flag_ausencia"):
            # Se o pattern principal existe mas o trigger_ausencia NÃO existe → problema
            if regra["pattern"].search(conteudo) and regra["id"] not in triggers_presentes:
                achados.append({
                    "arquivo": str(caminho_arquivo.name),
                    "linha": 1,
                    "regra": regra["id"],
                    "mensagem": regra["mensagem"],
                    "severidade": regra["severidade"],
                    "tipo": "iac",
                    "nome": regra["nome"],
                })

    return achados


# ── Função principal ─────────────────────────────────────────────────────────

def analisar_iac(caminho_repo: str) -> List[Dict]:
    """
    Função principal do módulo IaC Scanner.

    Percorre o repositório buscando arquivos de infraestrutura e os analisa
    com as regras definidas acima.

    Retorna lista de achados no formato compatível com o ZettaScan.
    """
    repo = Path(caminho_repo)
    ignorar_dirs = {".git", "node_modules", "venv", ".venv", "dist", "build", "__pycache__"}

    achados: List[Dict] = []
    arquivos_analisados = 0

    for raiz, dirs, arquivos in repo.walk() if hasattr(repo, "walk") else _walk_compat(repo):
        dirs[:] = [d for d in dirs if d not in ignorar_dirs]

        for nome_arquivo in arquivos:
            caminho_completo = Path(raiz) / nome_arquivo
            tipo = _detectar_tipo_arquivo(caminho_completo)
            if not tipo:
                continue

            arquivos_analisados += 1
            novos_achados = _analisar_arquivo_iac(caminho_completo, tipo)

            # Normaliza o caminho relativo ao repo
            for achado in novos_achados:
                try:
                    rel = str(caminho_completo.relative_to(repo)).replace("\\", "/")
                    achado["arquivo"] = rel
                except ValueError:
                    pass

            achados.extend(novos_achados)

    logger.info(
        "[IaC] Analisados %d arquivo(s) IaC — %d achado(s) encontrado(s).",
        arquivos_analisados,
        len(achados),
    )
    return achados


def _walk_compat(path: Path):
    """Compatibilidade com Python < 3.12 que não tem Path.walk()."""
    import os
    for raiz, dirs, arquivos in os.walk(str(path)):
        yield Path(raiz), dirs, arquivos
