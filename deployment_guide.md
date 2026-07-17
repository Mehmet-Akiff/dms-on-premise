# 🚀 DMS On-Premise Dağıtım ve Paketleme Kılavuzu

Bu kılavuz, yerel yapay zeka destekli Doküman Yönetim Sistemi (DMS) uygulamasını şirkette canlıya nasıl alacağınızı ve test amaçlı bir arkadaşınıza göndermek üzere nasıl paketleyeceğinizi adım adım açıklar.

---

## 🏢 1. Şirket İçi Yerel Ağda (LAN) Canlıya Alma ve Dağıtım

DMS, **On-Premise (Yerel Kurulum)** mimaride tasarlandığı için internete ve dış bulut servislerine ihtiyaç duymadan, tamamen şirketinizin kendi yerel sunucusunda güvenle çalıştırılabilir.

### A. Sunucu Gereksinimleri
DMS yerel yapay zeka modelleri (OCR ve özetleme) çalıştırdığı için kurulum yapılacak sunucunun şu özelliklerde olması tavsiye edilir:
- **İşletim Sistemi:** Linux (Ubuntu 22.04 LTS veya üstü tavsiye edilir) veya Windows Server 2022.
- **CPU / RAM:** En az 4 Çekirdek CPU, 8 GB RAM (Yapay zeka analiz hızı için 16 GB önerilir).
- **Disk:** Hızlı okuma/yazma ve PDF/Görsel saklama için en az 50 GB SSD alan.
- **Araçlar:** Sunucuya **Docker** ve **Docker Compose** kurulu olmalıdır.

### B. Canlıya Alma Adımları
1. **Projeyi Sunucuya Kopyalayın:**
   Proje dosyalarını sunucunun `/opt/dms-on-premise` dizinine yerleştirin.
2. **Kasa Güvenlik Ayarlarını Yapılandırın:**
   `backend/src/server.js` veya backend ortam değişkenleri (varsa `.env` dosyası) aracılığıyla master şifre ve SMTP ayarlarını şirket e-posta sunucunuza (örn. Microsoft Exchange veya yerel SMTP) göre tanımlayın.
3. **Konteynerleri Başlatın:**
   Proje dizinindeyken terminalde şu komutu çalıştırın:
   ```bash
   docker-compose up -d --build
   ```
   Bu komut veritabanını (PostgreSQL), yapay zeka servisini (AI-Service), Node.js backend'i ve Nginx frontend'i otomatik olarak ayağa kaldıracaktır.
4. **Yerel Ağda Paylaşıma Açma (Nginx & IP Yönlendirme):**
   - Sunucunun yerel IP adresini sabitleyin (Örnek: `192.168.1.150`).
   - Şirket çalışanları tarayıcılarından `http://192.168.1.150` adresine girerek sisteme anında erişebilirler.
   - Dilerseniz şirket içi DNS sunucunuza bir kayıt ekleyerek `http://dms.sirketiniz.local` gibi şık bir alan adıyla erişim sağlayabilirsiniz.

---

## 📦 2. Arkadaşınızın İncelemesi İçin Paketleme (Offline Dağıtım)

Projeyi bir arkadaşınıza, iş ortağınıza veya başka bir test sunucusuna göndermek için temiz bir şekilde paketleyebilirsiniz.

### A. Paketleme Adımları (Temizleme ve Sıkıştırma)
Paket boyutunu küçük tutmak ve veritabanı şifreleri gibi geçici test verilerinin arkadaşınıza gitmesini engellemek için şu adımları izleyin:

1. **Gereksiz Dosyaları Silin (Temizleme):**
   - Node.js bağımlılıkları (`node_modules`) paket içine dahil edilmemelidir. Docker build sırasında otomatik indirilir.
   - Önceki çalışmalardan kalan log ve test belgelerini temizleyin.
   Powershell'de şu komutu çalıştırabilirsiniz:
   ```powershell
   # node_modules temizliği
   Remove-Item -Recurse -Force -ErrorAction SilentlyContinue .\frontend\node_modules
   Remove-Item -Recurse -Force -ErrorAction SilentlyContinue .\backend\node_modules
   # Uploads temizliği
   Remove-Item -Recurse -Force -ErrorAction SilentlyContinue .\backend\uploads\*
   ```

2. **Zip Arşivi Oluşturun:**
   Projenin kök dizinindeki tüm dosyaları (`docker-compose.yml`, `frontend/`, `backend/`, `ai-service/` klasörleri) içeren bir `.zip` arşivi oluşturun:
   - Sağ tıklayıp **Sıkıştırılmış Klasör (Zip)** yapın veya 7-Zip ile arşivleyin.

### B. Arkadaşınızın Çalıştırma Adımları
Arkadaşınız projeyi aldığında sadece şu 3 adımı gerçekleştirerek projeyi kendi bilgisayarında/sunucusunda çalıştırabilir:

1. **Docker Desktop** programının bilgisayarında kurulu ve çalışır durumda olduğundan emin olur.
2. Zip dosyasını bir klasöre çıkartır ve o klasörde bir terminal (CMD veya terminal) açar.
3. Şu komutu çalıştırarak sistemi başlatır:
   ```bash
   docker-compose up -d --build
   ```
   Kurulum tamamlandığında tarayıcısından `http://localhost` adresine giderek sistemi test edebilir!
   - **İlk Giriş Master Kasa Şifresi:** `DmsSecureKasa2026!`
   - **Varsayılan CISO Girişi:** Kullanıcı adı: `ciso` / Şifre: `ciso_secure_2026`
   - **Varsayılan Admin Girişi:** Kullanıcı adı: `admin` / Şifre: `admin`
