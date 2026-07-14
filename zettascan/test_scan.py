"""
test_scan.py
------------
Executa um scan completo local, sem subir a API.
Útil para validar o fluxo ponta-a-ponta durante desenvolvimento.

Como usar:
    python test_scan.py

Pré-requisitos:
    Configure GITHUB_TOKEN e GEMINI_API_KEY no arquivo .env

Saída:
    resultado_teste.json — relatório completo do scan
"""

import asyncio
import json
import logging
import os
import sys

# Forca UTF-8 no terminal Windows (evita UnicodeEncodeError com emojis)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# pyrefly: ignore [missing-import]
from dotenv import load_dotenv
from scanner import executar_scan

load_dotenv()

# Configura logging para o terminal durante testes locais
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s — %(message)s",
)

# Repositório público com vulnerabilidades conhecidas para testes
REPO_DE_TESTE = "https://github.com/WebGoat/WebGoat"

# Variáveis do .env
TOKEN = os.getenv("GITHUB_TOKEN", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")


async def main():
    # Valida chaves antes de iniciar — falha clara e explícita
    erros = []
    if not TOKEN:
        erros.append("GITHUB_TOKEN não configurado no .env")
    if not GEMINI_API_KEY:
        erros.append("GEMINI_API_KEY não configurado no .env")

    if erros:
        for e in erros:
            print(f"[ERRO] {e}")
        print("\nAdicione as chaves ao arquivo .env e tente novamente.")
        sys.exit(1)

    print("=" * 55)
    print("  ZettaScan — Teste Local (scan completo)")
    print("=" * 55)
    print(f"  Repositório: {REPO_DE_TESTE}")
    print("=" * 55)

    resultado = await executar_scan(REPO_DE_TESTE, TOKEN)

    # Salva o resultado em disco
    arquivo_saida = "resultado_teste.json"
    with open(arquivo_saida, "w", encoding="utf-8") as f:
        json.dump(resultado, f, ensure_ascii=False, indent=2)

    print(f"\n[OK] Resultado salvo em: {arquivo_saida}")
    print(f"   Status: {resultado.get('status', 'desconhecido')}")
    print(f"   Total de vulnerabilidades: {resultado.get('total_vulnerabilidades', 0)}")
    print(f"   Críticas:  {resultado.get('criticas', 0)}")
    print(f"   Altas:     {resultado.get('altas', 0)}")
    print(f"   Médias:    {resultado.get('medias', 0)}")
    print(f"   Baixas:    {resultado.get('baixas', 0)}")

    if resultado.get("status") == "error":
        print(f"\n[ERRO] {resultado.get('mensagem')}")
        sys.exit(2)


if __name__ == "__main__":
    asyncio.run(main())