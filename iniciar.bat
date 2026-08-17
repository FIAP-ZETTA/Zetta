@echo off
title Zetta Guard - Inicializador

echo =======================================================
echo          INICIALIZANDO PLATAFORMA ZETTA GUARD
echo =======================================================
echo.

where python >nul 2>&1
if %errorlevel% neq 0 goto :sem_python

echo [1/4] Iniciando o backend ZettaScan na porta 8000...
start "ZettaScan Backend" /min cmd /k "cd /d "%~dp0zettascan" && pip install -r requirements.txt -q && python -m uvicorn api:app --reload --port 8000"

echo [2/4] Iniciando o firewall de IA ZettaGuard na porta 8002...
start "ZettaGuard Backend" /min cmd /k "cd /d "%~dp0zettaguard" && pip install -r requirements.txt -q && python -m uvicorn api:app --reload --port 8002"

where node >nul 2>&1
if %errorlevel% neq 0 goto :sem_node

echo [3/4] Instalando dependencias do ZettaDash (aguarde)...
cd /d "%~dp0zettadash"

where pnpm >nul 2>&1
if %errorlevel% equ 0 goto :com_pnpm

echo     pnpm nao encontrado globalmente, usando npm...
goto :com_npm

:com_pnpm
call pnpm install
echo [4/4] Abrindo ZettaDash em http://localhost:3000 ...
start http://localhost:3000
call pnpm dev
goto :fim

:com_npm
call npm install
echo [4/4] Abrindo ZettaDash em http://localhost:3000 ...
start http://localhost:3000
call npm run dev
goto :fim

:sem_python
echo.
echo [ERRO] Python nao encontrado!
echo Instale em: https://www.python.org/downloads/
echo.
pause
exit /b 1

:sem_node
echo.
echo =======================================================
echo [AVISO] Node.js nao instalado!
echo Para rodar o painel visual, instale em: https://nodejs.org
echo.
echo O backend ZettaScan ja esta rodando em http://localhost:8000
echo =======================================================
echo.
pause
exit /b 0

:fim
pause
