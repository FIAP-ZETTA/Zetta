"""
baixar_rulesets.py
------------------
[5-A] Baixa e salva os rulesets do Semgrep localmente para garantir
reprodutibilidade dos scans entre dias/semanas.

Por que isso importa:
    Os rulesets `p/owasp-top-ten` e `p/secrets` são mantidos online em
    semgrep.dev e mudam a cada atualização. Sem fixar as versões, dois
    scans do mesmo repositório feitos em dias diferentes podem retornar
    resultados diferentes — tornando os resultados não auditáveis.

Como usar:
    python baixar_rulesets.py

Após rodar, os arquivos ficam em:
    rulesets/owasp-top-ten.yaml
    rulesets/secrets.yaml

O semgrep_wrapper.py usa automaticamente esses arquivos se existirem.
Re-execute este script quando quiser atualizar os rulesets intencionalmente.
"""

import sys
import logging
from pathlib import Path

import httpx  # já é dependência do projeto

logging.basicConfig(level=logging.INFO, format="%(levelname)s — %(message)s")
logger = logging.getLogger(__name__)

DIR_RULESETS = Path(__file__).parent / "rulesets"
DIR_RULESETS.mkdir(exist_ok=True)

# URLs públicas do registry do Semgrep — retornam o YAML completo do ruleset
# /c/p/<nome> é o endpoint canônico de download de rulesets públicos
RULESETS = {
    "p/owasp-top-ten": {
        "url": "https://semgrep.dev/c/p/owasp-top-ten",
        "destino": DIR_RULESETS / "owasp-top-ten.yaml",
    },
    "p/secrets": {
        "url": "https://semgrep.dev/c/p/secrets",
        "destino": DIR_RULESETS / "secrets.yaml",
    },
}


def baixar_ruleset(nome: str, url: str, destino: Path) -> bool:
    """
    Baixa o ruleset via HTTP do registry público do Semgrep e salva localmente.
    O endpoint /c/p/<nome> pode retornar YAML ou JSON dependendo do ruleset —
    ambos são aceitos pelo Semgrep como argumento de --config.
    """
    logger.info("Baixando ruleset: %s ...", nome)
    try:
        with httpx.Client(follow_redirects=True, timeout=30) as client:
            resposta = client.get(url)

        resposta.raise_for_status()

        content_type = resposta.headers.get("content-type", "")
        conteudo = resposta.text

        # Valida minimamente que contém regras — aceita YAML ou JSON
        conteudo_lower = conteudo.strip()
        tem_rules = (
            "rules:" in conteudo_lower           # YAML: `rules:\n  - id: ...`
            or '"rules"' in conteudo_lower        # JSON: {"rules": [...]}
            or '"id"' in conteudo_lower           # JSON compacto
        )
        if not tem_rules:
            logger.error(
                "Conteúdo baixado de %s não parece ser um ruleset válido "
                "(Content-Type: %s, primeiros 200 chars: %s).",
                url, content_type, conteudo[:200],
            )
            return False

        # Salva como recebido — Semgrep aceita JSON e YAML igualmente
        destino.write_text(conteudo, encoding="utf-8")
        linhas = conteudo.count("\n")
        tamanho_kb = len(conteudo.encode()) / 1024
        fmt = "JSON" if "json" in content_type else "YAML"
        logger.info(
            "[OK] Salvo em: %s (%s, %d linhas, %.1f KB)",
            destino.relative_to(Path.cwd()), fmt, linhas, tamanho_kb,
        )
        return True

    except httpx.TimeoutException:
        logger.error("Timeout ao baixar %s. Verifique sua conexão.", nome)
        return False
    except httpx.HTTPStatusError as exc:
        logger.error(
            "Erro HTTP ao baixar %s: status %d", nome, exc.response.status_code
        )
        return False
    except Exception as exc:
        logger.error("Erro inesperado ao baixar %s: %s", nome, exc)
        return False


if __name__ == "__main__":
    logger.info("Destino: %s/", DIR_RULESETS.relative_to(Path.cwd()))

    sucessos = 0
    for nome, info in RULESETS.items():
        if baixar_ruleset(nome, info["url"], info["destino"]):
            sucessos += 1

    print()
    print(f"Resultado: {sucessos}/{len(RULESETS)} rulesets baixados.")
    if sucessos == len(RULESETS):
        print("[OK] Rulesets fixados. O ZettaScan usará as versões locais automaticamente.")
        print("     Commite a pasta rulesets/ para que todo o time use as mesmas regras.")
    else:
        print("[AVISO] Alguns rulesets não foram baixados. Verifique sua conexão e tente novamente.")
        sys.exit(1)
