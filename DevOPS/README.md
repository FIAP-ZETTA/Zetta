# 🚀 DevOps & CI/CD — Zetta Guard ASPM

Este diretório contém a infraestrutura de containers, orquestração e configurações de **CI/CD Quality Gate** do **Zetta Guard**.

---

## 📁 Estrutura de Arquivos

* [`.github/workflows/zetta-aspm.yml`](file:///c:/Users/GustavoGoulartBretas/Downloads/Zetta/.github/workflows/zetta-aspm.yml): Pipeline completo de **CI/CD Quality Gate** no GitHub Actions.
* [`docker-compose.yml`](file:///c:/Users/GustavoGoulartBretas/Downloads/Zetta/DevOPS/docker-compose.yml): Orquestração de todos os serviços (Frontend Next.js + Backend FastAPI + Semgrep Engine).
* [`Dockerfile.zettascan`](file:///c:/Users/GustavoGoulartBretas/Downloads/Zetta/DevOPS/Dockerfile.zettascan): Imagem Docker do motor de análise de segurança (Python 3.12, Semgrep, OSV, DAST).
* [`Dockerfile.zettadash`](file:///c:/Users/GustavoGoulartBretas/Downloads/Zetta/DevOPS/Dockerfile.zettadash): Imagem Docker da plataforma e dashboard executivo (Next.js 16).

---

## 🛡️ Como Funciona o Pipeline de CI/CD (GitHub Actions)

A cada **`git push`** ou abertura de **`Pull Request`**:

1. **Checkout & Setup:** Prepara o ambiente Python 3.12 e instala as engines de análise.
2. **Execução do ZettaScan:** Roda o scanner estático (**SAST**), segredos hardcoded (**Secrets**), vulnerabilidades em dependências (**SCA**) e arquivos de infraestrutura (**IaC**).
3. **Avaliação do Quality Gate:**
   * 🛑 **Máximo 0 falhas CRÍTICAS** (Tolerância Zero).
   * ⚠️ **Máximo 2 falhas ALTAS**.
   * 🔑 **Zero senhas/chaves de API hardcoded**.
4. **Comentário Automático no Pull Request (Bot):** Se houver violação, o bot posta a tabela detalhada de riscos e **bloqueia o merge**.
5. **Artifacts:** Salva o relatório consolidado em JSON e SBOM CycloneDX 1.4.
