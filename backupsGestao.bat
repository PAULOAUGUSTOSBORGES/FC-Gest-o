@echo off
chcp 65001 > nul
title backupsGestao - FC Gestão Backup do Banco
color 0A
cls
echo ====================================================================
echo                   backupsGestao - BACKUP DO BANCO
echo ====================================================================
echo.
echo Conectando ao banco de dados e preparando backup...
echo.

node "%~dp0scripts\fazer_backup_completo.js"

if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo.
    echo ❌ Ocorreu um erro durante a execução do backup.
    echo Verifique sua conexão com a internet ou se o Node.js está instalado.
) else (
    echo.
    echo --------------------------------------------------------------------
    echo ✅ Backup concluído com sucesso!
    echo 📁 Pasta de destino: g:\VERSOES DO SISTEMA\site sistema\backupsGestao
    echo --------------------------------------------------------------------
)

echo.
echo Pressione qualquer tecla para fechar esta janela...
pause > nul
