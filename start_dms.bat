@echo off
chcp 65001 >nul
title DMS On-Premise Baslatiliyor...
echo ========================================================
echo DMS On-Premise Sistemi Baslatiliyor...
echo Lutfen bekleyin, bu islem birkac saniye surebilir.
echo ========================================================

REM Docker'in acik olup olmadigini kontrol et, kapaliysa baslat
tasklist /fi "imagename eq Docker Desktop.exe" | find ":" > nul
if errorlevel 1 goto docker_is_running
echo Docker baslatiliyor...
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
:wait_docker
timeout /t 5 /nobreak > nul
docker info > nul 2>&1
if errorlevel 1 (
    echo Docker'in acilmasi bekleniyor...
    goto wait_docker
)
:docker_is_running

echo.
echo Sistem konteynerleri ayaga kaldiriliyor...
cd /d "%~dp0"
docker-compose up -d

echo.
echo ========================================================
echo Sistem hazir! Tarayiciniz aciliyor...
echo Kapatmak isterseniz masaustundeki "DMS'i Kapat"
echo kisayolunu kullanabilirsiniz.
echo ========================================================
timeout /t 3 /nobreak > nul
start http://localhost
exit
