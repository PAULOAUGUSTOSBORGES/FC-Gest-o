@echo off
title FC Gestao - Servidor Local
cls
echo =======================================================
echo          FC GESTAO - SERVIDOR LOCAL (LOCALHOST)
echo =======================================================
echo.
echo Iniciando servidor local na porta 8080...
echo O Google Auth e recursos offline funcionam 100%% em http://localhost:8080
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0iniciar_sistema.ps1"
pause
