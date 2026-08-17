# Zetta Guard

Zetta Guard é uma plataforma de gestão de segurança de aplicações com inteligência artificial, desenvolvida como projeto acadêmico na FIAP em 2026.

A ideia central é simples, mas o problema que ela resolve não é: empresas de tecnologia convivem diariamente com um volume enorme de vulnerabilidades identificadas por scanners, e a maioria das equipes não consegue responder a tempo porque não sabe por onde começar. Um scanner encontra problemas. O Zetta Guard responde qual desses problemas você precisa resolver agora.

A plataforma funciona como uma central de inteligência que se posiciona acima das ferramentas que a empresa já usa, sem substituí-las, e entrega priorização contextualizada com correções prontas para aplicar.

---

## Como o projeto é dividido

O Zetta Guard é composto por três módulos principais que trabalham juntos.

**ZettaScan** é o motor de descoberta e análise. Ele mapeia o repositório da empresa usando um token de acesso com permissão somente leitura, analisa o código com Semgrep e consulta o OSV.dev, base pública do Google, para identificar CVEs nas dependências. Quando a varredura termina, a inteligência artificial entra em cena para gerar uma explicação em linguagem simples de cada problema encontrado, incluindo o trecho de código corrigido pronto para aplicar.

**ZettaGuard** protege os sistemas de inteligência artificial da própria empresa. Qualquer organização que usa chatbots ou assistentes virtuais está exposta a ataques de prompt injection, jailbreak e exfiltração de dados, um vetor que a maioria das ferramentas tradicionais de segurança ignora. O ZettaGuard atua como um firewall e middleware invisível entre o usuário e o modelo de IA, analisando interações em tempo real com um motor de 3 camadas (L1 Regex curados com ~60 padrões, L2 Classificação Semântica com Gemini 2.0 e L3 Inspeção de Saída para prevenção de Data Leakage) e bloqueando tentativas maliciosas antes que causem dano.

**ZettaDash** é o coração da plataforma: um painel central que reúne tudo em uma tela só. O motor de priorização cruza três fatores para definir o que precisa de atenção imediata: a gravidade técnica da falha, se o sistema afetado está exposto publicamente e qual a criticidade daquele sistema para o negócio.

---

## 🚀 Como Rodar o Projeto (1 Clique)

Para facilitar para todo o time, criamos um inicializador automático:

### No Windows:
Basta dar **duplo clique** no arquivo **`iniciar.bat`** na raiz do projeto (ou rodar `.\iniciar.ps1` no PowerShell).

O script faz tudo sozinho:
1. Instala as dependências Python do **ZettaScan** e inicia a API em `http://localhost:8000`.
2. Instala as dependências Python do **ZettaGuard** e inicia o firewall de IA em `http://localhost:8002`.
3. Instala os pacotes do **ZettaDash** e sobe o painel web em `http://localhost:3000`.
4. Abre automaticamente o navegador na tela principal.

> **Pré-requisitos mínimos no PC do desenvolvedor:**
> - [Python 3.11+](https://www.python.org/downloads/)
> - [Node.js LTS](https://nodejs.org) (necessário para rodar o painel visual React/Next.js)

---

## Tecnologias utilizadas

### Backend

- Python 3.11+
- FastAPI
- SQLAlchemy
- Alembic
- Pydantic
- Uvicorn
- Pytest + HTTPx
- python-jose

### Análise de código (ZettaScan)

- Semgrep
- OSV.dev API
- GitHub API (via PyGithub ou requests)
- LLM API (OpenAI GPT-4o, Claude ou Gemini)

### Proteção de IA (ZettaGuard)

- Python com lógica própria de detecção de padrões
- LLM API como segunda camada de classificação

### Banco de dados

- PostgreSQL
- Supabase ou Railway para hospedagem

### Frontend (ZettaDash)

- React com TypeScript
- Next.js
- Tailwind CSS
- Recharts ou Chart.js
- Axios ou React Query
- Prism.js ou Shiki para syntax highlight

### DevOps e infraestrutura

- Docker
- Docker Compose
- GitHub Actions
- Vercel ou Netlify para o frontend
- Render ou Railway para o backend

### Gestão do projeto

- GitHub
- GitHub Projects
- GitHub Issues
- GitHub Actions

---

## Segurança do código do cliente

Uma das primeiras perguntas que qualquer empresa faz antes de conectar um repositório é: vocês vão ter acesso ao nosso código?

A resposta curta é: não de forma permanente. O cliente gera um token de acesso com permissão exclusiva de leitura. O ZettaScan usa esse token para rodar a análise, gerar o relatório e descartá-lo em seguida. Apenas os trechos onde uma vulnerabilidade foi identificada são enviados para o modelo de linguagem gerar a explicação e a correção. O restante do código nunca sai do ambiente de análise.

---

## Time

- Thayna Alves
- Thais Akemi
- Beatriz Castro
- Thomas de Queiroz
- Gustavo Goulart Bretas

---

## Status do projeto

O projeto está em desenvolvimento inicial. As funcionalidades descritas neste README representam o escopo planejado para a entrega acadêmica e podem evoluir ao longo do semestre.

Temos consciência de que uma plataforma ASPM verdadeiramente completa vai muito além do que está aqui. Evoluções futuras fazem parte do planejamento, e a arquitetura foi pensada para acomodá-las.
