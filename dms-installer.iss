[Setup]
AppName=DMS On-Premise
AppVersion=1.0.0
AppPublisher=DMS Bilisim
DefaultDirName=C:\DMS_On_Premise
DefaultGroupName=DMS On-Premise
OutputDir=Output
OutputBaseFilename=DMS-Kurulum
Compression=lzma2/ultra64
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64
ArchitecturesInstallIn64BitMode=x64

[Files]
Source: "docker-compose.yml"; DestDir: "{app}"; Flags: ignoreversion
Source: "dms-images.tar"; DestDir: "{app}"; Flags: ignoreversion
Source: "start_dms.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "stop_dms.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "Docker Desktop Installer.exe"; DestDir: "{tmp}"; Flags: deleteafterinstall

[Icons]
Name: "{commondesktop}\DMS'e Giris Yap (Baslat)"; Filename: "{app}\start_dms.bat"; IconFilename: "{sys}\shell32.dll"; IconIndex: 13; WorkingDir: "{app}"
Name: "{commondesktop}\DMS'i Kapat (Durdur)"; Filename: "{app}\stop_dms.bat"; IconFilename: "{sys}\shell32.dll"; IconIndex: 27; WorkingDir: "{app}"

[Run]
; 1. Docker'i sessiz moda kur
Filename: "{tmp}\Docker Desktop Installer.exe"; Parameters: "install --quiet --accept-license"; StatusMsg: "Docker altyapisi kuruluyor (Bu islem birkac dakika surebilir)..."; Flags: waituntilterminated

; 2. Docker'i arka planda baslat
Filename: "C:\Program Files\Docker\Docker\Docker Desktop.exe"; StatusMsg: "Docker motoru baslatiliyor..."; Flags: nowait

; 3. Docker'in hazir olmasini bekleyen gecici batch scriptini calistir
Filename: "{cmd}"; Parameters: "/c ""echo Docker hazirlaniyor... && timeout /t 20 /nobreak""" ; StatusMsg: "Docker servislerinin uyanmasi bekleniyor..."; Flags: waituntilterminated runhidden

; 4. Imaj dosyasini Docker'a yukle (Full path veriyoruz ki PATH problemi olmasin)
Filename: "C:\Program Files\Docker\Docker\resources\bin\docker.exe"; Parameters: "load -i ""{app}\dms-images.tar"""; StatusMsg: "Sistem, Veritabani ve Yapay Zeka imajlari iceri aktariliyor (Zaman alabilir)..."; Flags: waituntilterminated runhidden

; 5. Kurulum bittiginde kullaniciya baslatmayi sor
Filename: "{app}\start_dms.bat"; Description: "DMS Sistemini hemen baslat"; Flags: postinstall nowait
