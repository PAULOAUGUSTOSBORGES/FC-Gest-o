import os

bat_content = """@echo off
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
"""

bat_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "PUBLICAR_NA_NUVEM.bat")
with open(bat_path, "wb") as f:
    f.write(bat_content.replace("\n", "\r\n").encode("ascii"))

print("PUBLICAR_NA_NUVEM.bat atualizado com sucesso!")
