"""
attack_path.py
--------------
Motor de Correlação e Análise de Caminhos de Ataque (Attack Path Analysis) do Zetta ASPM.

Inspirado em plataformas líderes de mercado (OX Security, Orca Security, Cycode, Prisma Cloud):
- Correlaciona achados das 5 camadas (SAST, Secrets, SCA, IaC e DAST).
- Constrói a cadeia de ataque (Kill Chain): Acesso Inicial → Escalação de Privilégios → Movimentação Lateral → Alvo Crítico / Exfiltração.
- Identifica CHOKEPOINTS: a vulnerabilidade/falha exata que, se mitigada, quebra todo o vetor de ataque.
- Calcula o Raio de Explosão (Blast Radius) e a Probabilidade de Exploração (Likelihood).

Adições 2026-08-17:
- [APA-1] Algoritmo de correlação em grafo e síntese de vetores de ataque
- [APA-2] Geração de nós e arestas para renderização gráfica interativa no frontend
"""

import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


def gerar_attack_paths(vulnerabilidades: List[Dict[str, Any]], iac_findings: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
    """
    Analisa a lista consolidada de vulnerabilidades e achados de infraestrutura
    para construir caminhos de ataque correlacionados.

    Retorna uma lista de caminhos de ataque estruturados com:
      - id: identificador único do caminho
      - titulo: nome descritivo do vetor de ataque
      - severidade: "CRITICAL" | "HIGH" | "MEDIUM"
      - probabilidade: porcentagem estimada de sucesso (0-100%)
      - blast_radius: "CRITICAL" | "HIGH" | "MEDIUM"
      - alvo_impactado: "Banco de Dados de Produção", "Cluster Kubernetes", etc.
      - chokepoint: a vulnerabilidade central que anula o ataque se corrigida
      - steps: etapas sequenciais da kill chain
      - nodes: nós para renderização de grafo (id, label, type, severity, description)
      - edges: conexões direcionadas entre os nós
    """
    all_vulns = list(vulnerabilidades or [])
    if iac_findings:
        all_vulns.extend(iac_findings)

    # Indexar achados por categorias de ataque
    secrets_findings = []
    injection_findings = []
    rce_or_sca_findings = []
    iac_misconfigs = []
    auth_findings = []

    for v in all_vulns:
        titulo = (v.get("titulo") or "").lower()
        explicacao = (v.get("explicacao") or v.get("mensagem") or "").lower()
        regra = (v.get("regra") or "").lower()
        tipo = (v.get("tipo") or "codigo").lower()
        texto_completo = f"{titulo} {explicacao} {regra}"

        # 1. Detecção de Segredos / Credenciais Expostas
        if any(w in texto_completo for w in ["secret", "token", "password", "senha", "api_key", "credential", "chave", "private_key", "hardcoded"]):
            secrets_findings.append(v)

        # 2. Detecção de Injeções (SQLi, Command Injection, SSRF, Path Traversal)
        if any(w in texto_completo for w in ["sql", "injection", "command", "exec", "eval", "ssrf", "traversal", "xss", "deserialization"]):
            injection_findings.append(v)

        # 3. Dependências com CVEs / RCE
        if tipo == "dependencia" or any(w in texto_completo for w in ["cve", "osv", "remote code", "rce", "overflow"]):
            rce_or_sca_findings.append(v)

        # 4. Inseguranças de Container / IaC
        if tipo in ["iac", "docker", "terraform"] or any(w in texto_completo for w in ["docker", "root", "privileged", "socket", "compose", "port", "network"]):
            iac_misconfigs.append(v)

        # 5. Falhas de Autenticação e Controle de Acesso
        if any(w in texto_completo for w in ["auth", "jwt", "session", "cors", "bypass", "permission", "access control"]):
            auth_findings.append(v)

    attack_paths: List[Dict[str, Any]] = []

    # ── VETOR 1: Injeção de Código/SQL + Credencial Hardcoded → Exfiltração de Banco de Dados ─
    if (injection_findings or auth_findings) and secrets_findings:
        initial = injection_findings[0] if injection_findings else auth_findings[0]
        secret = secrets_findings[0]

        chokepoint_title = secret.get("titulo") or "Credencial Sensível Exposta"
        path_id = "AP-01-DATA-EXFIL"
        attack_paths.append({
            "id": path_id,
            "titulo": "Cadeia de Exfiltração de Dados Críticos (SQLi/Auth + Hardcoded Secret)",
            "severidade": "CRITICAL",
            "probabilidade": 88,
            "blast_radius": "CRITICAL",
            "alvo_impactado": "Banco de Dados & Storage em Produção (Vazamento de LGPD / PII)",
            "chokepoint": {
                "titulo": chokepoint_title,
                "arquivo": secret.get("arquivo", "codigo"),
                "linha": str(secret.get("linha", "1")),
                "motivo": "Remover o segredo e rotacionar as credenciais impede o atacante de acessar o banco de dados mesmo que explore a falha inicial.",
            },
            "steps": [
                {
                    "stage": "1. Acesso Inicial",
                    "action": f"Atacante explora falha em {initial.get('arquivo', 'app')}: '{initial.get('titulo', 'Vulnerabilidade Pública')}'.",
                    "source": initial.get("tipo", "SAST").upper(),
                },
                {
                    "stage": "2. Extração de Segredos",
                    "action": f"Localiza chave hardcoded em {secret.get('arquivo', 'secrets')}:{secret.get('linha', '0')} sem controle de acesso.",
                    "source": "SECRETS",
                },
                {
                    "stage": "3. Movimentação Lateral",
                    "action": "Utiliza as credenciais legítimas obtidas para autenticar diretamente no cluster de dados.",
                    "source": "PRIVILEGE ESCALATION",
                },
                {
                    "stage": "4. Impacto / Exfiltração",
                    "action": "Download completo de tabelas com dados sensíveis e credenciais de usuários da empresa.",
                    "source": "DATA BREACH",
                },
            ],
            "nodes": [
                {"id": "n1", "label": "Atacante Externo", "type": "threat_actor", "severity": "HIGH"},
                {"id": "n2", "label": initial.get("titulo", "Ponto de Entrada"), "type": "vulnerability", "severity": initial.get("severidade", "HIGH")},
                {"id": "n3", "label": secret.get("titulo", "Chave Hardcoded"), "type": "secret", "severity": "CRITICAL", "isChokepoint": True},
                {"id": "n4", "label": "Banco de Dados Prod", "type": "target_asset", "severity": "CRITICAL"},
            ],
            "edges": [
                {"from": "n1", "to": "n2", "label": "Explora entrada pública"},
                {"from": "n2", "to": "n3", "label": "Lê credenciais no repo"},
                {"from": "n3", "to": "n4", "label": "Acesso direto e exfiltração"},
            ],
        })

    # ── VETOR 2: CVE em Dependência + Container Root/Privilegiado → Escape de Host ───────────
    if rce_or_sca_findings and iac_misconfigs:
        cve = rce_or_sca_findings[0]
        iac = iac_misconfigs[0]

        path_id = "AP-02-CONTAINER-ESCAPE"
        attack_paths.append({
            "id": path_id,
            "titulo": "Comprometimento de Infraestrutura (CVE em Pacote + Container Escape)",
            "severidade": "CRITICAL",
            "probabilidade": 74,
            "blast_radius": "HIGH",
            "alvo_impactado": "Host Docker e Nós do Cluster de Orquestração",
            "chokepoint": {
                "titulo": f"Atualização de Dependência ({cve.get('pacote') or cve.get('titulo')})",
                "arquivo": cve.get("arquivo", "manifest"),
                "linha": str(cve.get("linha", "1")),
                "motivo": "Atualizar a versão da biblioteca vulnerável bloqueia a Execução Remota de Código (RCE), invalidando a escalação para o container.",
            },
            "steps": [
                {
                    "stage": "1. Exploração de SCA",
                    "action": f"Envio de payload malicioso explorando CVE na dependência '{cve.get('pacote') or cve.get('titulo')}'.",
                    "source": "SCA / CVE",
                },
                {
                    "stage": "2. Execução no Container",
                    "action": "Atacante obtém shell interativo dentro do container rodando como usuário ROOT.",
                    "source": "RCE",
                },
                {
                    "stage": "3. Escalação via IaC",
                    "action": f"Aproveita má configuração de infra ({iac.get('titulo', 'Docker Privilegiado')}) para montar diretórios do host.",
                    "source": "IaC ESCALATION",
                },
                {
                    "stage": "4. Host Takeover",
                    "action": "Acesso total ao sistema operacional da máquina servidora e outros containers vizinhos.",
                    "source": "INFRA COMPROMISE",
                },
            ],
            "nodes": [
                {"id": "n1", "label": "Atacante Remoto", "type": "threat_actor", "severity": "HIGH"},
                {"id": "n2", "label": cve.get("titulo", "CVE em Dependência"), "type": "vulnerability", "severity": "CRITICAL", "isChokepoint": True},
                {"id": "n3", "label": iac.get("titulo", "Container Inseguro (Root)"), "type": "iac_misconfig", "severity": "HIGH"},
                {"id": "n4", "label": "Host Host OS / Kernel", "type": "target_asset", "severity": "CRITICAL"},
            ],
            "edges": [
                {"from": "n1", "to": "n2", "label": "Payload via HTTP/RPC"},
                {"from": "n2", "to": "n3", "label": "Shell RCE como Root"},
                {"from": "n3", "to": "n4", "label": "Escape de Container"},
            ],
        })

    # ── VETOR 3 (Fallback/Geral): Cadeia de Postura e Exposição de Superfície ─────────────────
    if not attack_paths and all_vulns:
        top_vuln = all_vulns[0]
        attack_paths.append({
            "id": "AP-03-GENERIC-CHAIN",
            "titulo": "Cadeia de Exploração Direta de Aplicação",
            "severidade": top_vuln.get("severidade", "HIGH"),
            "probabilidade": 65,
            "blast_radius": "MEDIUM",
            "alvo_impactado": "Integridade da Aplicação e Sessões de Usuários",
            "chokepoint": {
                "titulo": top_vuln.get("titulo", "Vulnerabilidade Principal"),
                "arquivo": top_vuln.get("arquivo", "app"),
                "linha": str(top_vuln.get("linha", "1")),
                "motivo": "Aplicar o patch sugerido pela IA elimina a vulnerabilidade no código-fonte.",
            },
            "steps": [
                {
                    "stage": "1. Mapeamento de Superfície",
                    "action": "Atacante identifica rotas e parâmetros não sanitizados na aplicação.",
                    "source": "RECON",
                },
                {
                    "stage": "2. Exploração de Vulnerabilidade",
                    "action": f"Disparo de requisição direcionada explorando '{top_vuln.get('titulo')}'.",
                    "source": top_vuln.get("tipo", "codigo").upper(),
                },
                {
                    "stage": "3. Impacto Operacional",
                    "action": top_vuln.get("impacto") or "Potencial indisponibilidade ou modificação não autorizada de dados.",
                    "source": "EXPLOIT",
                },
            ],
            "nodes": [
                {"id": "n1", "label": "Atacante", "type": "threat_actor", "severity": "MEDIUM"},
                {"id": "n2", "label": top_vuln.get("titulo", "Falha de Código"), "type": "vulnerability", "severity": top_vuln.get("severidade", "HIGH"), "isChokepoint": True},
                {"id": "n3", "label": "Serviço da Aplicação", "type": "target_asset", "severity": "HIGH"},
            ],
            "edges": [
                {"from": "n1", "to": "n2", "label": "Envio de requisição"},
                {"from": "n2", "to": "n3", "label": "Comprometimento de serviço"},
            ],
        })

    logger.info("[AttackPath] %d caminhos de ataque correlacionados identificados.", len(attack_paths))
    return attack_paths
