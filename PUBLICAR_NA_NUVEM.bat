@echo off
title FC Gestao - Publicar na Nuvem (Deploy)
cls
echo =======================================================
echo          FC GESTAO - PUBLICADOR NA NUVEM
echo =======================================================
echo.
echo [1/2] Atualizando versoes de cache dos arquivos...
powershell -ExecutionPolicy Bypass -File "%~dp0compilar.ps1"
echo.
echo [2/2] Enviando sistema para a nuvem (Firebase)...
where firebase >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    call firebase.cmd deploy
) else (
    call npx --yes firebase-tools deploy
)
echo.
echo =======================================================
echo  Processo finalizado!
echo =======================================================
pause
