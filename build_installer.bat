@echo off
chcp 65001 >nul
title DMS Kurulum Sihirbazi Derleyici

echo ========================================================
echo DMS On-Premise Kurulum Sihirbazi Paketleniyor...
echo Bu islem sirasinda Docker acik olmalidir.
echo ========================================================

echo 1. Frontend kodlari derleniyor...
cd frontend
call npm run build
cd ..

echo 2. Docker imajlari olusturuluyor...
docker-compose build

echo 3. Docker imajlari .tar dosyasina sikistiriliyor (Bu biraz uzun surebilir)...
docker save dms-backend:latest dms-frontend:latest dms-ai-service:latest postgres:15-alpine -o dms-images.tar

echo 4. Docker Desktop Kurulum dosyasi indiriliyor (Eger yoksa)...
if not exist "Docker Desktop Installer.exe" (
    curl -L -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" -o "Docker Desktop Installer.exe" "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe"
)

echo 5. Inno Setup ile .exe kurulum dosyasi olusturuluyor...
"%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe" dms-installer.iss

echo ========================================================
echo Paketleme tamamlandi! 'Output' klasorunde DMS-Kurulum.exe dosyasini bulabilirsiniz.
echo ========================================================

