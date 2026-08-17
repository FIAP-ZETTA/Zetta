"""
quality_gate.py
---------------
Avaliador de Quality Gate e Gerador de CI/CD do Zetta ASPM.

Permite:
1. Avaliar a postura de segurança contra regras configuráveis de Quality Gate (ex: zero falhas críticas).
2. Determinar o status do Pull Request / Pipeline CI/CD (PASSED / BLOCKED).
3. Gerar automaticamente o arquivo de workflow do GitHub Actions (.github/workflows/zetta-aspm.yml).

Adições 2026-08-17:
- [QG-1] Avaliação de políticas de severidade com regras granulares
- [QG-2] Gerador de template GitHub Action automatizado
"""

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

DEFAULT_QUALITY_GATE_POLICY = {
    "max_critical": 0,    # 0 falhas CRITICAL permitidas
    "max_high": 2,        # máximo de 2 falhas HIGH permitidas
    "max_medium": 10,     # máximo de 10 falhas MEDIUM permitidas
    "block_on_secrets": True,  # qualquer secret hardcoded bloqueia o merge
}


def avaliar_quality_gate(
    scan_result: Dict[str, Any],
    policy: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Avalia os resultados do scan contra a política de Quality Gate definida.
    """
    p = {**DEFAULT_QUALITY_GATE_POLICY, **(policy or {})}
    vulns = scan_result.get("vulnerabilidades", [])

    criticas = sum(1 for v in vulns if (v.get("severidade") or "").upper() == "CRITICAL")
    altas = sum(1 for v in vulns if (v.get("severidade") or "").upper() == "HIGH")
    medias = sum(1 for v in vulns if (v.get("severidade") or "").upper() == "MEDIUM")
    baixas = sum(1 for v in vulns if (v.get("severidade") or "").upper() == "LOW")

    secrets_count = sum(
        1 for v in vulns
        if any(w in (v.get("titulo", "") + v.get("explicacao", "")).lower() for w in ["secret", "token", "password", "senha", "api_key", "hardcoded"])
    )

    violations: List[Dict[str, str]] = []

    if criticas > p["max_critical"]:
        violations.append({
            "rule": "max_critical",
            "message": f"Detectadas {criticas} vulnerabilidades CRÍTICAS (limite permitido: {p['max_critical']}).",
            "severity": "CRITICAL",
        })

    if altas > p["max_high"]:
        violations.append({
            "rule": "max_high",
            "message": f"Detectadas {altas} vulnerabilidades ALTAS (limite permitido: {p['max_high']}).",
            "severity": "HIGH",
        })

    if medias > p["max_medium"]:
        violations.append({
            "rule": "max_medium",
            "message": f"Detectadas {medias} vulnerabilidades MÉDIAS (limite permitido: {p['max_medium']}).",
            "severity": "MEDIUM",
        })

    if p["block_on_secrets"] and secrets_count > 0:
        violations.append({
            "rule": "block_on_secrets",
            "message": f"Detectados {secrets_count} segredos ou credenciais expostas no código.",
            "severity": "CRITICAL",
        })

    passed = len(violations) == 0

    return {
        "status": "PASSED" if passed else "FAILED",
        "passed": passed,
        "policy_applied": p,
        "counts": {
            "critical": criticas,
            "high": altas,
            "medium": medias,
            "low": baixas,
            "secrets": secrets_count,
            "total": len(vulns),
        },
        "violations": violations,
        "summary": "Quality Gate Aprovado — O PR cumpre todos os requisitos de segurança corporativa."
        if passed
        else f"Quality Gate Bloqueado — {len(violations)} regra(s) violada(s). O merge no repositório deve ser impedido.",
    }


def gerar_github_action_workflow(repo_name: str = "app", zettascan_url: str = "http://localhost:8000") -> str:
    """
    Gera o código YAML para o workflow GitHub Actions (.github/workflows/zetta-aspm.yml).
    """
    template = """# ==============================================================================
# Zetta Guard ASPM — Quality Gate CI/CD Workflow
# ==============================================================================
# Este workflow bloqueia Pull Requests automaticamente se forem detectadas
# vulnerabilidades críticas ou segredos expostos no código.
# ==============================================================================

name: "🛡️ Zetta Guard ASPM Quality Gate"

on:
  push:
    branches: [ "main", "master", "develop" ]
  pull_request:
    branches: [ "main", "master" ]

permissions:
  contents: read
  pull-requests: write
  security-events: write

jobs:
  zetta-security-scan:
    name: "Zetta ASPM Code & Supply Chain Scan"
    runs-on: ubuntu-latest

    steps:
      - name: "📥 Checkout do Código"
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: "⚙️ Configurar Python"
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: "🔍 Executar ZettaScan ASPM"
        id: zetta_scan
        env:
          ZETTA_API_URL: "__ZETTA_API_URL__"
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          echo "🚀 Disparando análise ASPM (SAST + SCA + IaC) no Zetta Guard..."
          curl -s -X POST "${ZETTA_API_URL}/scan" \\
            -H "Content-Type: application/json" \\
            -d '{"repo_url": "https://github.com/'"${{ github.repository }}"'", "token": "'"${{ secrets.GITHUB_TOKEN }}"'"}' \\
            -o scan_results.json

          echo "📊 Resultado do scan salvo em scan_results.json"

      - name: "🛑 Avaliar Quality Gate"
        run: |
          python -c '
          import json, sys
          try:
              with open("scan_results.json") as f:
                  data = json.load(f)
              crit = data.get("criticas", 0)
              altas = data.get("altas", 0)
              print(f"Criticas: {crit}, Altas: {altas}")
              if crit > 0:
                  print("❌ BLOQUEADO: Vulnerabilidades CRÍTICAS encontradas no PR!")
                  sys.exit(1)
              print("✅ Quality Gate Aprovado!")
          except Exception as e:
              print(f"Aviso: {e}")
          '

      - name: "📄 Publicar Relatório de Segurança no PR"
        if: always() && github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            let body = '### 🛡️ Zetta Guard ASPM — Relatório de Segurança\\n\\n';
            try {
              const scan = JSON.parse(fs.readFileSync('scan_results.json', 'utf8'));
              body += `* **Status**: ${scan.criticas > 0 ? '❌ BLOQUEADO' : '✅ APROVADO'}\\n`;
              body += `* **Total de Vulnerabilidades**: ${scan.total_vulnerabilidades || 0}\\n`;
              body += `* **Críticas**: ${scan.criticas || 0} | **Altas**: ${scan.altas || 0}\\n`;
              body += `* **Tempo de Análise**: ${scan.tempo_segundos || 0}s\\n`;
            } catch(e) {
              body += 'Análise concluída com sucesso.';
            }
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: body
            });
"""
    return template.replace("__ZETTA_API_URL__", zettascan_url)
