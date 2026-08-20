@echo off
chcp 65001 >nul
title DMS On-Premise [TEST / DEBUG MODU] Baslatiliyor...

echo ========================================================
echo   🧪 DMS On-Premise [TEST / DEBUG LABORATUVARI]
echo ========================================================
echo.

REM 1. Docker kontrolu
tasklist /fi "imagename eq Docker Desktop.exe" | find ":" > nul
if errorlevel 1 goto docker_is_running
echo [1/3] Docker Desktop kapali, baslatiliyor...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"

:wait_docker
timeout /t 4 /nobreak > nul
docker info > nul 2>&1
if errorlevel 1 (
    echo Docker'in acilmasi bekleniyor...
    goto wait_docker
)

:docker_is_running
echo [✓] Docker Desktop aktif.

REM 2. Proje dizinine git ve Docker konteynerlerini ayaga kaldir
echo.
echo [2/3] Konteynerler Test / Debug yapilandirmasiyla baslatiliyor...
cd /d "%~dp0"
set VITE_APP_MODE=debug
docker-compose up -d

echo.
echo [3/3] Sistem hazir!
echo ========================================================
echo   🔑 TEST GİRİŞ BİLGİLERİ:
echo   - Admin Hesabı: admin / admin
echo   - CISO Hesabı: ciso / ciso
echo   - Kasa Açma Parolası: 123456
echo.
echo   🧪 OCR Konsensüs Laboratuvarı: AKTİF
echo ========================================================
echo.

timeout /t 2 /nobreak > nul
start http://localhost/?debug=1
exit
