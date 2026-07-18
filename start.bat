@echo off
echo =======================================================
echo DMS On-Premise Kurulum ve Baslatma Araci
echo =======================================================
echo.
echo Sistemin calismasi icin Docker Desktop'in acik olmasi gerekmektedir.
echo Eger Docker acik degilse lutfen once Docker Desktop'i acin.
echo.
echo Konteynerler hazirlaniyor ve baslatiliyor... Lutfen bekleyin...
docker-compose up -d --build
echo.
echo =======================================================
echo BASARILI!
echo Uygulamaniz calisiyor.
echo Tarayicinizdan asagidaki adrese giderek sisteme girebilirsiniz:
echo.
echo http://localhost
echo =======================================================
pause
