@echo off
chcp 65001 >nul
title DMS On-Premise Durduruluyor...
echo ========================================================
echo DMS On-Premise Sistemi ve Docker Kapatiliyor...
echo Bu islem ile bilgisayarinizin bellegi (RAM) bosaltilacak.
echo Lutfen bekleyin...
echo ========================================================

cd /d "%~dp0"
echo.
echo 1. Sistem konteynerleri durduruluyor...
docker-compose down

echo.
echo 2. Docker Desktop uygulamasi kapatiliyor...
"%PROGRAMFILES%\Docker\Docker\DockerCli.exe" -Quit

REM Gecikme eklentisi (Docker'in kapanmasi birkac saniye surebilir)
timeout /t 5 /nobreak > nul

REM Hala calisiyorsa zorla kapat (wsl dahi kapatilabilir, rami tamamen temizler)
taskkill /F /IM "Docker Desktop.exe" > nul 2>&1
taskkill /F /IM "com.docker.backend.exe" > nul 2>&1
wsl --shutdown > nul 2>&1

echo ========================================================
echo Sistem basariyla kapatildi. RAM bosaltildi!
echo ========================================================
timeout /t 3 /nobreak > nul
exit
