import os
import time
import urllib.request
import urllib.parse
from PIL import Image, ImageDraw, ImageFont

# Test verileri (4 Kişi, her kişiye 1 kimlik, 1 maaş bordrosu)
TEST_DOCUMENTS = [
    # 1. Ahmet Yılmaz
    {
        "filename": "ahmet_yilmaz_kimlik.pdf",
        "text": "TURKIYE CUMHURIYETI KIMLIK KARTI\n\nAdi: Ahmet\nSoyadi: Yilmaz\nTC Kimlik No: 12345678901\nDogum Tarihi: 01.01.1990\nDogum Yeri: Ankara\nCinsiyeti: Erkek"
    },
    {
        "filename": "ahmet_yilmaz_bordro.pdf",
        "text": "HAZIRAN 2026 DONEMI MAAS BORDROSU\n\nSirket: DMS On-Premise Teknoloji AS\nPersonel Adi: Ahmet Yilmaz\nUnvan: Kidemli Yazilim Gelistirici\nNet Odenen Tutar: 45000 TL\nSGK Matrahi: 60000 TL\nOdeme Tarihi: 30.06.2026"
    },
    # 2. Ayşe Demir
    {
        "filename": "ayse_demir_kimlik.pdf",
        "text": "TURKIYE CUMHURIYETI KIMLIK KARTI\n\nAdi: Ayse\nSoyadi: Demir\nTC Kimlik No: 98765432109\nDogum Tarihi: 15.05.1992\nDogum Yeri: Istanbul\nCinsiyeti: Kadin"
    },
    {
        "filename": "ayse_demir_bordro.pdf",
        "text": "HAZIRAN 2026 DONEMI MAAS BORDROSU\n\nSirket: DMS On-Premise Teknoloji AS\nPersonel Adi: Ayse Demir\nUnvan: Sistem Analisti ve Proje Lideri\nNet Odenen Tutar: 48000 TL\nSGK Matrahi: 65000 TL\nOdeme Tarihi: 30.06.2026"
    },
    # 3. Caner Kaya
    {
        "filename": "caner_kaya_kimlik.pdf",
        "text": "TURKIYE CUMHURIYETI KIMLIK KARTI\n\nAdi: Caner\nSoyadi: Kaya\nTC Kimlik No: 45678901234\nDogum Tarihi: 20.09.1988\nDogum Yeri: Izmir\nCinsiyeti: Erkek"
    },
    {
        "filename": "caner_kaya_bordro.pdf",
        "text": "HAZIRAN 2026 DONEMI MAAS BORDROSU\n\nSirket: DMS On-Premise Teknoloji AS\nPersonel Adi: Caner Kaya\nUnvan: Arayuz Gelistirici (Frontend Developer)\nNet Odenen Tutar: 42000 TL\nSGK Matrahi: 55000 TL\nOdeme Tarihi: 30.06.2026"
    },
    # 4. Elif Şahin
    {
        "filename": "elif_sahin_kimlik.pdf",
        "text": "TURKIYE CUMHURIYETI KIMLIK KARTI\n\nAdi: Elif\nSoyadi: Sahin\nTC Kimlik No: 56789012345\nDogum Tarihi: 10.12.1995\nDogum Yeri: Antalya\nCinsiyeti: Kadin"
    },
    {
        "filename": "elif_sahin_bordro.pdf",
        "text": "HAZIRAN 2026 DONEMI MAAS BORDROSU\n\nSirket: DMS On-Premise Teknoloji AS\nPersonel Adi: Elif Sahin\nUnvan: Proje Yoneticisi (Project Manager)\nNet Odenen Tutar: 50000 TL\nSGK Matrahi: 70000 TL\nOdeme Tarihi: 30.06.2026"
    }
]

def create_text_pdf(filename, text):
    """Pillow ile metin içeren bir görsel oluşturur ve PDF olarak kaydeder."""
    # 1200x1600 boyutunda beyaz bir sayfa oluştur
    img = Image.new('RGB', (1200, 1600), color='white')
    draw = ImageDraw.Draw(img)
    
    # Metni yaz
    # On-premise sistemlerde font dosyasının yerini garantiye almak için default font kullanalım
    # Gerekirse daha büyük font boyutları için default yerine arial vb. yüklenebilir ama standart draw.text yeterlidir
    draw.text((80, 100), text, fill='black')
    
    # PDF olarak kaydeder
    img.save(filename, 'PDF')
    print(f"[PDF_GEN] {filename} olusturuldu.")

def upload_file(filename):
    """Oluşturulan dosyayı multipart/form-data ile backend API'sine yükler."""
    url = "http://127.0.0.1:3000/api/documents/upload"
    
    # Python standart urllib ile multipart/form-data yükleme yapmak
    boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW"
    
    with open(filename, 'rb') as f:
        file_content = f.read()
        
    # Multipart header ve body oluştur
    parts = []
    parts.append(f"--{boundary}".encode('utf-8'))
    parts.append(f'Content-Disposition: form-data; name="file"; filename="{filename}"'.encode('utf-8'))
    parts.append(b'Content-Type: application/pdf')
    parts.append(b'')
    parts.append(file_content)
    parts.append(f"--{boundary}--".encode('utf-8'))
    
    body = b'\r\n'.join(parts)
    
    req = urllib.request.Request(url, data=body)
    req.add_header('Content-Type', f'multipart/form-data; boundary={boundary}')
    
    try:
        with urllib.request.urlopen(req) as response:
            res_body = response.read().decode('utf-8')
            print(f"[UPLOAD_OK] {filename} yuklendi -> {res_body}")
    except Exception as e:
        print(f"[UPLOAD_ERR] {filename} yuklenirken hata olustu: {str(e)}")

def main():
    print("=== TEST BELGELERI URETIMI VE YUKLENMESI ===")
    created_files = []
    
    for doc in TEST_DOCUMENTS:
        filename = doc["filename"]
        text = doc["text"]
        create_text_pdf(filename, text)
        created_files.append(filename)
        
    print("\nAPI yuklemeleri baslatiliyor (backend ve ai-service ayakta olmali)...")
    for filename in created_files:
        upload_file(filename)
        # İşlemlerin sırayla yapılması ve db kilitlemesi olmaması için kısa bir bekleme
        time.sleep(1)
        
    # Geçici dosyaları temizle
    print("\nGecici dosyalar temizleniyor...")
    for filename in created_files:
        if os.path.exists(filename):
            os.remove(filename)
            print(f"[CLEAN] {filename} silindi.")
            
    print("\nTum islemler tamamlandi!")

if __name__ == "__main__":
    main()
