@echo off
title FC Gestao (Loja de Moveis) - Publicar na Nuvem (Deploy)
cls
echo =======================================================
echo     FC GESTAO (LOJA DE MOVEIS) - PUBLICADOR NA NUVEM
echo =======================================================
echo.
cd /d "%~dp0"
echo [1/2] Atualizando versoes de cache dos arquivos...
powershell -ExecutionPolicy Bypass -File "%~dp0compilar.ps1"
echo.
echo [2/2] Enviando sistema para a nuvem (Firebase)...
where firebase >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    call firebase.cmd deploy --project lojafc-a31f9
) else (
    call npx --yes firebase-tools deploy --project lojafc-a31f9
)
echo.
echo =======================================================
echo  FC GESTAO PUBLICADO COM SUCESSO!
echo =======================================================
echo.
echo  Link Oficial: https://lojafc-a31f9.web.app
echo.
set /p ABRIR="Deseja abrir o sistema no navegador agora? (S/N): "
if /i "%ABRIR%"=="S" (
    start https://lojafc-a31f9.web.app
)
pause
