@echo off
chcp 65001 >nul
title DMS On-Premise (Test Modu)

echo ========================================================
echo   🧪 DMS On-Premise Test Laboratuvari Baslatiliyor...
echo ========================================================
echo.

cd /d "%~dp0"

REM Docker aktif mi kontrol et
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo Docker Desktop baslatiliyor, lutfen bekleyin...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    :wait_loop
    timeout /t 3 /nobreak >nul
    docker info >nul 2>&1
    if %errorlevel% neq 0 goto wait_loop
)

echo [✓] Docker hazir. Konteynerler baslatiliyor...
docker-compose up -d

echo.
echo [✓] Sistem hazir! Tarayici aciliyor...
start http://localhost/?debug=1

timeout /t 2 /nobreak >nul
exit
