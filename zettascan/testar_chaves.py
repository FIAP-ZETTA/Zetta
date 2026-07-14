"""
testar_chaves.py
----------------
Testa se as tres integracoes estao funcionando:
1. Gemini (IA de priorizacao)
2. GitHub Token (acesso ao repositorio)
3. OSV.dev (banco de CVEs - sem chave, mas testa a conexao)

Como usar:
    python testar_chaves.py

Se aparecer 3x [OK] esta tudo pronto para rodar o ZettaScan.
"""

import os
import sys
import httpx
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

# Forcamos UTF-8 no stdout para nao ter problema com emojis no Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

print("=" * 45)
print("  ZettaScan -- Verificacao de Chaves")
print("=" * 45)

resultados = []

# -- 1. Testa o Gemini --------------------------------------------------
print("\n[1/3] Testando Gemini (Google AI)...")
try:
    chave_gemini = os.getenv("GEMINI_API_KEY")
    if not chave_gemini or chave_gemini in ("AIzaSy_SUA_CHAVE_AQUI", ""):
        raise Exception("GEMINI_API_KEY nao configurada no .env")

    genai.configure(api_key=chave_gemini)
    modelo = genai.GenerativeModel("gemini-2.5-flash")
    resposta = modelo.generate_content("Responda apenas com a palavra: funcionou!")

    texto = resposta.text.strip()
    print(f"[OK] Gemini respondeu: {texto}")
    resultados.append(True)

except Exception as e:
    print(f"[ERRO] Gemini: {e}")
    resultados.append(False)

# -- 2. Testa o GitHub Token -------------------------------------------
print("\n[2/3] Testando GitHub Token...")
try:
    token = os.getenv("GITHUB_TOKEN")
    if not token or token in ("ghp_SEU_TOKEN_AQUI", ""):
        raise Exception("GITHUB_TOKEN nao configurado no .env")

    r = httpx.get(
        "https://api.github.com/user",
        headers={"Authorization": f"token {token}"},
        timeout=10,
    )

    if r.status_code == 200:
        usuario = r.json().get("login", "desconhecido")
        print(f"[OK] GitHub autenticado como: {usuario}")
        resultados.append(True)
    elif r.status_code == 401:
        print("[ERRO] GitHub: Token invalido ou expirado")
        resultados.append(False)
    else:
        print(f"[ERRO] GitHub: Status HTTP {r.status_code}")
        resultados.append(False)

except Exception as e:
    print(f"[ERRO] GitHub: {e}")
    resultados.append(False)

# -- 3. Testa o OSV.dev -----------------------------------------------
print("\n[3/3] Testando OSV.dev (sem chave necessaria)...")
try:
    r = httpx.post(
        "https://api.osv.dev/v1/query",
        json={
            "version": "1.0.0",
            "package": {"name": "lodash", "ecosystem": "npm"},
        },
        timeout=10,
    )

    if r.status_code == 200:
        total = len(r.json().get("vulns", []))
        print(f"[OK] OSV.dev respondeu: {total} CVEs para lodash 1.0.0")
        resultados.append(True)
    else:
        print(f"[ERRO] OSV.dev: Status HTTP {r.status_code}")
        resultados.append(False)

except Exception as e:
    print(f"[ERRO] OSV.dev: {e}")
    resultados.append(False)

# -- Resumo -----------------------------------------------------------
print("\n" + "=" * 45)
ok = sum(resultados)
print(f"  Resultado: {ok}/3 servicos OK")
if ok == 3:
    print("  Tudo pronto! Pode rodar o ZettaScan.")
else:
    print("  Corrija os erros acima antes de continuar.")
print("=" * 45)

sys.exit(0 if ok == 3 else 1)