"""
dast_scanner.py
---------------
Motor DAST (Dynamic Application Security Testing) do Zetta ASPM.

Executa testes dinâmicos de segurança em uma aplicação web em execução:
1. Análise de Headers HTTP de Segurança (CSP, HSTS, X-Frame-Options, etc.)
2. Verificação de Vazamento de Versões de Servidor (Server, X-Powered-By)
3. Scanner de Arquivos e Endpoints Sensíveis Expostos (.env, .git, swagger, metrics)
4. Verificação de Configuração Insegura de CORS (Wildcard + Credentials)
5. Verificação de Postura SSL/TLS e Redirecionamento HTTPS
6. Cálculo de Score Dinâmico de Segurança e Classificação (Grade A+ a F)

Adições 2026-08-17:
- [DAST-1] Suporte a scan dinâmico assíncrono via httpx
- [DAST-2] Padronização dos achados para o ecossistema ASPM com tipo="dast"
"""

import asyncio
import logging
import re
import time
from typing import Any, Dict, List, Optional
from urllib.parse import urljoin, urlparse

import httpx

logger = logging.getLogger(__name__)

# Headers de segurança recomendados (OWASP Secure Headers Project)
REQUIRED_SECURITY_HEADERS = [
    {
        "header": "Strict-Transport-Security",
        "name": "HSTS (HTTP Strict Transport Security)",
        "severity": "HIGH",
        "recommendation": "max-age=31536000; includeSubDomains; preload",
        "description": "Força navegadores a se comunicarem apenas via HTTPS, prevenindo ataques de Man-in-the-Middle e SSL Strip.",
        "owasp": "OWASP Top 10 - A05:2021 Security Misconfiguration",
    },
    {
        "header": "Content-Security-Policy",
        "name": "CSP (Content Security Policy)",
        "severity": "HIGH",
        "recommendation": "default-src 'self'; script-src 'self'; object-src 'none';",
        "description": "Mitiga ataques de Cross-Site Scripting (XSS) e injeção de dados ao restringir as origens permitidas de scripts e recursos.",
        "owasp": "OWASP Top 10 - A03:2021 Injection",
    },
    {
        "header": "X-Frame-Options",
        "name": "X-Frame-Options (Proteção contra Clickjacking)",
        "severity": "MEDIUM",
        "recommendation": "DENY ou SAMEORIGIN",
        "description": "Impede que o site seja renderizado dentro de <iframe> em domínios maliciosos, protegendo contra Clickjacking.",
        "owasp": "OWASP Top 10 - A05:2021 Security Misconfiguration",
    },
    {
        "header": "X-Content-Type-Options",
        "name": "X-Content-Type-Options",
        "severity": "LOW",
        "recommendation": "nosniff",
        "description": "Impede o navegador de tentar adivinhar (sniffing) o tipo MIME, reduzindo riscos de execução indevida de arquivos estáticos.",
        "owasp": "OWASP Top 10 - A05:2021 Security Misconfiguration",
    },
    {
        "header": "Referrer-Policy",
        "name": "Referrer-Policy",
        "severity": "LOW",
        "recommendation": "strict-origin-when-cross-origin ou no-referrer",
        "description": "Controla a quantidade de informações do cabeçalho Referer enviadas em requisições externas para evitar vazamento de URLs sensíveis.",
        "owasp": "OWASP Top 10 - A01:2021 Broken Access Control",
    },
    {
        "header": "Permissions-Policy",
        "name": "Permissions-Policy (Feature Policy)",
        "severity": "LOW",
        "recommendation": "camera=(), microphone=(), geolocation=()",
        "description": "Restringe o acesso a recursos do navegador (câmera, microfone, GPS) na aplicação.",
        "owasp": "OWASP Top 10 - A05:2021 Security Misconfiguration",
    },
]

# Arquivos e diretórios sensíveis comuns para checagem rápida de exposição
SENSITIVE_PROBE_PATHS = [
    {
        "path": "/.env",
        "severity": "CRITICAL",
        "title": "Arquivo .env Exposto Publicamente",
        "description": "Arquivo de configuração de ambiente contendo credenciais, segredos e chaves de API acessível publicamente via HTTP.",
        "correction": "Bloqueie o acesso a arquivos ocultos (.*) no servidor web (Nginx/Apache/Cloudflare).",
    },
    {
        "path": "/.git/HEAD",
        "severity": "CRITICAL",
        "title": "Diretório de Controle de Versão .git Exposto",
        "description": "O diretório interno do Git está exposto, permitindo que atacantes reconstruam o código-fonte inteiro e histórico de commits.",
        "correction": "Configure o web server para retornar HTTP 403/404 para qualquer requisição contendo '.git'.",
    },
    {
        "path": "/actuator/env",
        "severity": "HIGH",
        "title": "Spring Boot Actuator /env Exposto",
        "description": "Endpoint de diagnóstico expondo variáveis de ambiente internas e parâmetros do sistema.",
        "correction": "Desative o endpoint ou restrinja o acesso via firewall e autenticação obrigatória.",
    },
    {
        "path": "/swagger.json",
        "severity": "LOW",
        "title": "Definição OpenAPI/Swagger Pública",
        "description": "Esquema da API exposto publicamente, facilitando mapeamento de rotas e ataques direcionados.",
        "correction": "Garanta que endpoints administrativos e documentação interna exijam autenticação em produção.",
    },
    {
        "path": "/package.json",
        "severity": "MEDIUM",
        "title": "Arquivo de Manifesto package.json Exposto",
        "description": "Revela dependências e versões exatas utilizadas, permitindo busca de CVEs específicas por atacantes.",
        "correction": "Não sirva a raiz do projeto como pasta de arquivos estáticos.",
    },
]


def _calcular_grade(score: int) -> str:
    """Calcula a nota/grade com base no score de 0 a 100."""
    if score >= 95:
        return "A+"
    if score >= 85:
        return "A"
    if score >= 70:
        return "B"
    if score >= 55:
        return "C"
    if score >= 40:
        return "D"
    return "F"


async def analisar_dast(target_url: str, timeout_seconds: float = 6.0) -> Dict[str, Any]:
    """
    Executa varredura dinâmica de segurança (DAST) no endpoint informado.

    Retorna dicionário contendo:
      - url: URL analisada
      - status_code: Código HTTP retornado
      - response_time_ms: Tempo de resposta em ms
      - ssl_enabled: Se usa HTTPS
      - security_score: Score 0-100
      - grade: Nota (A+, A, B, C, D, F)
      - total_findings: Quantidade de vulnerabilidades dinâmicas
      - findings: Lista de achados estruturados com tipo='dast'
      - headers_summary: Resumo dos headers encontrados vs ausentes
    """
    # Normalizar URL
    if not target_url.startswith(("http://", "https://")):
        target_url = "https://" + target_url

    parsed = urlparse(target_url)
    ssl_enabled = parsed.scheme.lower() == "https"

    findings: List[Dict[str, Any]] = []
    headers_found: Dict[str, str] = {}
    missing_headers: List[str] = []
    response_time_ms = 0.0
    status_code = 0
    headers_dict: Dict[str, str] = {}

    headers_req = {
        "User-Agent": "ZettaGuard-DAST-Scanner/2.0 (+https://zettaguard.fiap.com.br)",
        "Accept": "*/*",
    }

    # ── 1. Requisição Principal ───────────────────────────────────────────────
    t0 = time.monotonic()
    try:
        async with httpx.AsyncClient(
            verify=False,  # permite testar staging / certs autoassinados
            timeout=timeout_seconds,
            follow_redirects=True,
        ) as client:
            res = await client.get(target_url, headers=headers_req)
            response_time_ms = round((time.monotonic() - t0) * 1000, 1)
            status_code = res.status_code
            headers_dict = {k.lower(): v for k, v in res.headers.items()}
    except Exception as exc:
        logger.warning("[DAST] Erro ao conectar na URL %s: %s", target_url, exc)
        return {
            "status": "error",
            "url": target_url,
            "mensagem": f"Não foi possível conectar ao host: {str(exc)}",
            "findings": [
                {
                    "titulo": "Host Inacessível para Testes Dinâmicos",
                    "explicacao": f"A requisição HTTP para '{target_url}' falhou: {str(exc)}",
                    "impacto": "A aplicação não pôde ser avaliada dinamicamente em tempo de execução.",
                    "correcao": "Verifique se o serviço está em execução, com a porta aberta e acessível pela rede.",
                    "severidade": "LOW",
                    "tipo": "dast",
                    "arquivo": target_url,
                    "linha": "0",
                }
            ],
            "security_score": 0,
            "grade": "F",
            "total_findings": 1,
            "ssl_enabled": ssl_enabled,
        }

    # ── 2. Checagem de HTTPS ──────────────────────────────────────────────────
    if not ssl_enabled:
        findings.append({
            "titulo": "Comunicação em Texto Claro (HTTP Não Seguro)",
            "explicacao": f"O endpoint '{target_url}' não utiliza criptografia TLS/HTTPS.",
            "impacto": "Todo o tráfego, tokens e credenciais podem ser interceptados em trânsito (Man-in-the-Middle).",
            "correcao": "Habilite HTTPS com certificado TLS válido e force redirecionamento 301 de HTTP para HTTPS.",
            "severidade": "HIGH",
            "tipo": "dast",
            "arquivo": target_url,
            "linha": "HTTP/1.1",
        })

    # ── 3. Análise de Headers de Segurança ────────────────────────────────────
    for item in REQUIRED_SECURITY_HEADERS:
        h_key = item["header"].lower()
        if h_key in headers_dict:
            headers_found[item["header"]] = headers_dict[h_key]
        else:
            missing_headers.append(item["header"])
            findings.append({
                "titulo": f"Cabeçalho de Segurança Ausente: {item['header']}",
                "explicacao": f"{item['description']} O cabeçalho '{item['header']}' não foi retornado pelo servidor.",
                "impacto": f"Expõe a aplicação a riscos classificados no {item['owasp']}.",
                "correcao": f"Configure o servidor web ou gateway para incluir: '{item['header']}: {item['recommendation']}'",
                "severidade": item["severity"],
                "tipo": "dast",
                "arquivo": f"headers/{item['header']}",
                "linha": "0",
            })

    # ── 4. Vazamento de Versões de Software (Information Disclosure) ──────────
    server_hdr = headers_dict.get("server")
    if server_hdr and any(c.isdigit() for c in server_hdr):
        findings.append({
            "titulo": "Divulgação de Versão de Servidor Web (Server Header)",
            "explicacao": f"O cabeçalho 'Server: {server_hdr}' expõe a versão exata do software do servidor.",
            "impacto": "Facilita a busca de vulnerabilidades (CVEs conhecidas) específicas para a versão do servidor em execução.",
            "correcao": "Oculte ou remova a assinatura do servidor (ex: 'server_tokens off;' no Nginx).",
            "severidade": "LOW",
            "tipo": "dast",
            "arquivo": "headers/Server",
            "linha": "0",
        })

    powered_by = headers_dict.get("x-powered-by")
    if powered_by:
        findings.append({
            "titulo": "Divulgação de Tecnologia Backend (X-Powered-By)",
            "explicacao": f"O cabeçalho 'X-Powered-By: {powered_by}' expõe a linguagem ou framework utilizado.",
            "impacto": "Ajuda atacantes a mapear o ecossistema tecnológico para explorar fraquezas do framework.",
            "correcao": "Desative o envio do cabeçalho X-Powered-By no framework (ex: app.disable('x-powered-by') no Express).",
            "severidade": "LOW",
            "tipo": "dast",
            "arquivo": "headers/X-Powered-By",
            "linha": "0",
        })

    # ── 5. Checagem de CORS Inseguro ──────────────────────────────────────────
    try:
        async with httpx.AsyncClient(verify=False, timeout=3.0) as client:
            cors_res = await client.options(
                target_url,
                headers={
                    "Origin": "https://attacker-domain-test.com",
                    "Access-Control-Request-Method": "POST",
                }
            )
            cors_allow_origin = cors_res.headers.get("access-control-allow-origin", "")
            cors_allow_creds = cors_res.headers.get("access-control-allow-credentials", "")
            if cors_allow_origin == "*" and cors_allow_creds.lower() == "true":
                findings.append({
                    "titulo": "CORS Inseguro: Origem Wildcard com Credenciais",
                    "explicacao": "A política de CORS permite qualquer origem (*) combinada com envio de credenciais (cookies/tokens).",
                    "impacto": "Permite que sites maliciosos executem requisições autenticadas em nome dos usuários (Cross-Origin Data Leak).",
                    "correcao": "Defina origens explicitamente confiáveis em 'Access-Control-Allow-Origin' e evite wildcard.",
                    "severidade": "HIGH",
                    "tipo": "dast",
                    "arquivo": "cors/policy",
                    "linha": "0",
                })
            elif cors_allow_origin == "https://attacker-domain-test.com":
                findings.append({
                    "titulo": "CORS Inseguro: Reflexão Arbitrária de Origin",
                    "explicacao": "O servidor reflete cegamente qualquer valor enviado no cabeçalho 'Origin'.",
                    "impacto": "Qualquer domínio na internet tem permissão para ler respostas confidenciais da API.",
                    "correcao": "Valide o cabeçalho Origin contra uma lista estrita de domínios permitidos.",
                    "severidade": "HIGH",
                    "tipo": "dast",
                    "arquivo": "cors/origin-reflection",
                    "linha": "0",
                })
    except Exception:
        pass

    # ── 6. Sondagem de Arquivos Sensíveis (Sensitive Path Probing) ─────────────
    base_url = f"{parsed.scheme}://{parsed.netloc}"
    probe_tasks = []

    async def _test_path(probe: Dict[str, str]):
        probe_url = urljoin(base_url, probe["path"])
        try:
            async with httpx.AsyncClient(verify=False, timeout=2.5, follow_redirects=False) as probe_client:
                r = await probe_client.get(probe_url, headers=headers_req)
                # Considera exposto se status 200 e conteúdo razoável
                if r.status_code == 200 and len(r.content) > 10:
                    text_sample = r.text[:200].lower()
                    # Evita falsos positivos de SPAs que retornam index.html em qualquer 404
                    if "<!doctype html" not in text_sample or probe["path"] in ["/swagger.json", "/actuator/env"]:
                        return {
                            "titulo": probe["title"],
                            "explicacao": f"{probe['description']} Acessível em {probe_url} (HTTP 200).",
                            "impacto": "Vazamento direto de informações sigilosas ou código-fonte.",
                            "correcao": probe["correction"],
                            "severidade": probe["severity"],
                            "tipo": "dast",
                            "arquivo": probe["path"],
                            "linha": f"HTTP {r.status_code}",
                        }
        except Exception:
            pass
        return None

    results = await asyncio.gather(*[_test_path(p) for p in SENSITIVE_PROBE_PATHS])
    for r in results:
        if r:
            findings.append(r)

    # ── 7. Cálculo do Score Dinâmico DAST ─────────────────────────────────────
    deductions = 0
    for f in findings:
        sev = f.get("severidade", "LOW").upper()
        if sev == "CRITICAL":
            deductions += 35
        elif sev == "HIGH":
            deductions += 20
        elif sev == "MEDIUM":
            deductions += 10
        elif sev == "LOW":
            deductions += 4

    security_score = max(0, 100 - deductions)
    grade = _calcular_grade(security_score)

    logger.info(
        "[DAST] Scan concluído para %s em %.1fms | Score: %d (%s) | Achados: %d",
        target_url, response_time_ms, security_score, grade, len(findings)
    )

    return {
        "status": "success",
        "url": target_url,
        "status_code": status_code,
        "response_time_ms": response_time_ms,
        "ssl_enabled": ssl_enabled,
        "security_score": security_score,
        "grade": grade,
        "total_findings": len(findings),
        "headers_found": headers_found,
        "missing_headers": missing_headers,
        "findings": findings,
        "scanned_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
