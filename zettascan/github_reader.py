"""
github_reader.py
----------------
Responsável por clonar o repositório do cliente
usando um token read-only.

Fluxo:
1. Recebe a URL do repo e o token
2. Valida a URL contra whitelist de hosts permitidos
3. Baixa os arquivos para um diretório temporário ISOLADO por execução
4. Remove symlinks externos ao sandbox (mitigação de leitura de /etc/passwd etc.)
5. Retorna o caminho da pasta
6. Após o scan, remove a pasta local

Correções de segurança aplicadas (auditoria 2026-07-14):
- [G-1] Token mascarado em mensagens de erro/log
- [G-2] tempfile.mkdtemp() substitui path fixo "repos_temp/"
- [G-3] timeout=120s no subprocess.run do git clone
- [G-4] Whitelist de hosts + rejeição de SSRF/schemes perigosos
- [G-6] Normalização de URL para https:// antes de inserir token

Correções de segurança aplicadas (auditoria 2026-07-14, 2ª passada):
- [1-A] Remoção de symlinks externos ao sandbox pós-clone — impede que o
         Semgrep leia arquivos sensíveis do servidor via symlinks maliciosos

Nota sobre git hooks [1-B — documentação]:
    git clone NÃO executa hooks do repositório remoto. Os hooks em
    .git/hooks/ são inicializados do template local do git (ex:
    /usr/share/git-core/templates/), nunca do remote. Portanto, um
    repositório malicioso NÃO pode executar código via hooks durante o clone.
    Submódulos (.gitmodules) também são ignorados pois usamos --depth 1
    sem --recurse-submodules.
"""

import os
import re
import stat
import shutil
import logging
import subprocess
import tempfile
from pathlib import Path
# pyrefly: ignore [missing-import]
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ── Whitelist de hosts GitHub permitidos ──────────────────────────────────────
# Pendência P-4 / P-6: adicionar gitlab.com, bitbucket.org ou hosts Enterprise
# mediante decisão de produto.
_HOSTS_PERMITIDOS: set[str] = {"github.com"}

# Regex para URL GitHub no formato https://github.com/owner/repo (com ou sem .git)
_RE_URL_GITHUB = re.compile(
    r"^https://(?P<host>github\.com)/(?P<owner>[A-Za-z0-9_.\-]+)/(?P<repo>[A-Za-z0-9_.\-]+?)(\.git)?$",
    re.IGNORECASE,
)

# Timeout de clone em segundos (pendência P-3: limite de tamanho não implementado)
_CLONE_TIMEOUT_S = 120


def _validar_url(repo_url: str) -> re.Match:
    """
    Valida a URL do repositório contra a whitelist de hosts.
    Rejeita: file://, http://, IPs, hosts não listados, argument injection.
    """
    m = _RE_URL_GITHUB.match(repo_url)
    if not m:
        raise ValueError(
            "URL inválida. Formato esperado: https://github.com/owner/repo"
        )
    host = m.group("host").lower()
    if host not in _HOSTS_PERMITIDOS:
        raise ValueError(
            f"Host '{host}' não permitido. Hosts aceitos: {sorted(_HOSTS_PERMITIDOS)}"
        )
    return m


def _remover_symlinks_externos(destino: Path) -> None:
    """
    [1-A] Remove todos os symlinks do repositório clonado que apontam para
    fora do diretório sandbox. Isso impede que o Semgrep siga links para
    arquivos sensíveis do servidor (ex: /etc/passwd, C:\\Windows\\System32).

    Symlinks que apontam para dentro do próprio sandbox são mantidos, pois
    são legítimos (ex: links relativos entre arquivos do projeto).
    """
    destino_resolvido = str(destino.resolve())
    removidos = 0

    for raiz, dirs, arquivos in os.walk(destino, followlinks=False):
        for nome in arquivos + dirs:
            p = Path(raiz) / nome
            if not p.is_symlink():
                continue
            try:
                alvo = p.resolve()
                alvo_str = str(alvo)
                # Symlink que aponta para dentro do sandbox: OK
                if alvo_str.startswith(destino_resolvido):
                    continue
                # Symlink externo: remove
                p.unlink()
                removidos += 1
                # Log sem expor o target real (poderia revelar estrutura do servidor)
                logger.warning(
                    "[ZettaScan] Symlink externo removido do repositório: %s",
                    p.relative_to(destino),
                )
            except Exception as exc:
                # Em caso de dúvida (link quebrado, permissão negada): remove
                logger.warning(
                    "[ZettaScan] Symlink suspeito removido (erro ao resolver): %s — %s",
                    p.name, exc,
                )
                try:
                    p.unlink()
                    removidos += 1
                except Exception:
                    pass  # Se não conseguir remover, o Semgrep vai falhar na leitura

    if removidos:
        logger.info(
            "[ZettaScan] %d symlink(s) externo(s) removido(s) do repositório.", removidos
        )


def remover_somente_leitura(func, path, exc_info):
    """
    Necessário no Windows para conseguir apagar
    arquivos .git que ficam como somente leitura.
    """
    os.chmod(path, stat.S_IWRITE)
    func(path)


def clonar_repositorio(repo_url: str, token: str) -> str:
    """
    Clona o repositório usando o token read-only.

    Parâmetros:
        repo_url: URL do repositório (deve ser https://github.com/owner/repo)
        token: token do GitHub (nunca logado nem exposto em erros)

    Retorna:
        caminho absoluto do diretório temporário com o repositório clonado

    Levanta:
        ValueError: URL inválida ou host não permitido
        RuntimeError: falha no git clone (mensagem sem o token)
        TimeoutError: clone demorou mais de _CLONE_TIMEOUT_S segundos
    """
    m = _validar_url(repo_url)
    nome_repo = m.group("repo").removesuffix(".git")

    # [G-2] Diretório temporário ISOLADO por execução
    destino = Path(tempfile.mkdtemp(prefix="zettascan_")) / nome_repo
    destino.parent.mkdir(parents=True, exist_ok=True)

    # [G-6] Garante https:// antes de inserir o token
    url_base = repo_url if repo_url.startswith("https://") else "https://" + repo_url.split("://", 1)[-1]
    if not url_base.endswith(".git"):
        url_base += ".git"

    # URL autenticada (se token fornecido) — NUNCA deve aparecer em logs ou mensagens de erro
    if token and token.strip():
        url_autenticada = url_base.replace("https://", f"https://{token.strip()}@", 1)
    else:
        url_autenticada = url_base

    logger.info("[ZettaScan] Clonando repositório: %s ...", nome_repo)

    try:
        resultado = subprocess.run(
            ["git", "clone", "--depth", "1", url_autenticada, str(destino)],
            capture_output=True,
            text=True,
            timeout=_CLONE_TIMEOUT_S,
        )
    except subprocess.TimeoutExpired:
        if destino.exists():
            shutil.rmtree(destino, onerror=remover_somente_leitura)
        raise TimeoutError(
            f"Clone excedeu o limite de {_CLONE_TIMEOUT_S}s. "
            "Verifique o tamanho do repositório."
        )

    if resultado.returncode != 0:
        # [G-1] Mascara o token antes de usar stderr em mensagem de erro
        stderr_seguro = resultado.stderr.replace(token, "***") if token else resultado.stderr
        stderr_seguro = stderr_seguro.replace(url_autenticada, url_base)
        if destino.exists():
            shutil.rmtree(destino, onerror=remover_somente_leitura)
        raise RuntimeError(
            f"Erro ao clonar repositório '{nome_repo}'.\n"
            f"Detalhe (sanitizado): {stderr_seguro}"
        )

    logger.info("[ZettaScan] Repositório clonado em: %s", destino)

    # [1-A] Remove symlinks externos ANTES de passar o path para o Semgrep
    _remover_symlinks_externos(destino)

    return str(destino)


def apagar_repositorio(caminho: str) -> None:
    """
    Remove a cópia local do repositório.
    Sempre chamado em bloco finally — nunca deve lançar exceção para cima.
    """
    if not os.path.exists(caminho):
        return
    try:
        shutil.rmtree(caminho, onerror=remover_somente_leitura)
        logger.info("[ZettaScan] Código temporário removido: %s", caminho)
    except Exception as exc:
        logger.warning(
            "[ZettaScan] AVISO: não foi possível remover %s: %s", caminho, exc
        )