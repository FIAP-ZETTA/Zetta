# Zetta Guard - Inicializador Automático
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "          INICIALIZANDO PLATAFORMA ZETTA GUARD         " -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host ""

$RootPath = Split-Path -Parent $MyInvocation.MyCommand.Path

# 1. Verificar Python e iniciar ZettaScan
try {
    $pythonVersion = python --version 2>&1
    Write-Host "[1/3] Python detectado ($pythonVersion). Iniciando backend ZettaScan..." -ForegroundColor Green
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$RootPath\zettascan'; pip install -r requirements.txt -q; python -m uvicorn api:app --reload --port 8000" -WindowStyle Minimized
} catch {
    Write-Host "[ERRO] Python não encontrado. Instale o Python 3.11+: https://www.python.org" -ForegroundColor Red
    Pause
    exit 1
}

# 2. Verificar Node.js e iniciar ZettaDash
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
    Write-Host ""
    Write-Host "=======================================================" -ForegroundColor Yellow
    Write-Host "[AVISO] Node.js não instalado na máquina!" -ForegroundColor Yellow
    Write-Host "O Backend ZettaScan já está rodando em http://localhost:8000" -ForegroundColor Green
    Write-Host "Para rodar o painel Web (ZettaDash), basta instalar o Node.js LTS:" -ForegroundColor Yellow
    Write-Host "🔗 https://nodejs.org" -ForegroundColor Cyan
    Write-Host "=======================================================" -ForegroundColor Yellow
    Write-Host ""
    Pause
    exit 0
}

Write-Host "[2/3] Preparando ZettaDash..." -ForegroundColor Green
Set-Location "$RootPath\zettadash"

$hasPnpm = Get-Command pnpm -ErrorAction SilentlyContinue
if ($hasPnpm) {
    pnpm install --silent
    Write-Host "[3/3] Abrindo ZettaDash em http://localhost:3000..." -ForegroundColor Cyan
    Start-Process "http://localhost:3000"
    pnpm dev
} else {
    Write-Host "[2/3] Instalando dependências com npm/npx..." -ForegroundColor Yellow
    npx -y pnpm install --silent
    Write-Host "[3/3] Abrindo ZettaDash em http://localhost:3000..." -ForegroundColor Cyan
    Start-Process "http://localhost:3000"
    npx pnpm dev
}
