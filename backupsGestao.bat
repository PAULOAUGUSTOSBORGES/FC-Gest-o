@echo off
title Backup do Banco de Dados - FC Gestao
cls
echo ====================================================================
echo                   BACKUP DO BANCO DE DADOS
echo ====================================================================
echo.
echo Conectando ao banco de dados e preparando backup...
echo.

node "%~dp0scripts\fazer_backup_completo.js"

if errorlevel 1 (
    echo.
    echo [ERRO] Ocorreu um erro durante a execucao do backup.
    echo Verifique sua conexao com a internet ou se o Node.js esta instalado.
) else (
    echo.
    echo --------------------------------------------------------------------
    echo [OK] Backup concluido com sucesso!
    echo Pasta de destino: %~dp0..\backupsGestao
    echo --------------------------------------------------------------------
)

echo.
echo Pressione qualquer tecla para fechar...
pause > nul
