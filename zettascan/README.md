# ZettaScan 🔍

Motor de análise e descoberta de vulnerabilidades do **Zetta Guard**.

## O que faz

1. Clona o repositório do cliente com token **read-only**
2. Roda o **Semgrep** para análise estática do código (OWASP Top 10)
3. Consulta o **OSV.dev** para verificar CVEs nas dependências
4. Usa o **Claude (Anthropic)** para priorizar, explicar e sugerir correções
5. Apaga o código clonado — o cliente não tem seus dados retidos

## Estrutura dos arquivos

```
zettascan/
├── github_reader.py    # Clona e apaga o repositório
├── semgrep_wrapper.py  # Analisa o código com Semgrep
├── osv_client.py       # Verifica dependências no OSV.dev
├── ai_prioritizer.py   # Prioriza com IA (Claude)
├── scanner.py          # Orquestrador — chama tudo na ordem certa
├── api.py              # API FastAPI com endpoint POST /scan
├── test_scan.py        # Script para testar localmente
├── requirements.txt    # Dependências Python
├── .env.example        # Modelo do arquivo de configuração
└── .gitignore          # Arquivos que não vão pro GitHub
```

## Como rodar localmente

### 1. Pré-requisitos
- Python 3.11+
- Git instalado
- Semgrep instalado (`pip install semgrep`)

### 2. Configurar o ambiente

```bash
# Clona o repositório do projeto
git clone https://github.com/FIAP-ZETTA/Zetta.git
cd Zetta/zettascan

# Cria ambiente virtual (boa prática)
python -m venv venv

# Ativa o ambiente virtual
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Instala as dependências
pip install -r requirements.txt
```

### 3. Configurar as chaves de API

```bash
# Copia o arquivo de exemplo
cp .env.example .env

# Abre o .env e preenche:
# ANTHROPIC_API_KEY → pega em https://console.anthropic.com/settings/keys
# GITHUB_TOKEN → pega em GitHub → Settings → Developer settings → Tokens
```

### 4. Testar

```bash
# Teste direto (sem API)
python test_scan.py

# Ou subir a API completa
uvicorn api:app --reload --port 8001
# Abre: http://localhost:8001/docs
```

## Endpoints da API

### `POST /scan`
Inicia um scan de segurança.

**Body:**
```json
{
  "repo_url": "https://github.com/usuario/projeto",
  "token": "ghp_xxxxx"
}
```

**Resposta:**
```json
{
  "status": "success",
  "repositorio": "https://github.com/usuario/projeto",
  "tempo_segundos": 45.2,
  "total_vulnerabilidades": 12,
  "criticas": 2,
  "altas": 4,
  "medias": 5,
  "baixas": 1,
  "vulnerabilidades": [
    {
      "titulo": "SQL Injection em login.py",
      "explicacao": "A query SQL é montada com dados do usuário sem validação.",
      "impacto": "Atacante pode acessar ou apagar dados do banco.",
      "correcao": "Use queries parametrizadas.",
      "severidade": "CRITICAL",
      "arquivo": "src/login.py",
      "linha": 34,
      "tipo": "codigo"
    }
  ]
}
```

### `GET /health`
Verifica se a API está rodando.

## Responsável
**Gustavo** — FIAP 2026 · Turma 1TDCPW
