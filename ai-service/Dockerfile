# ============================================================
# DMS AI Service - Python (FastAPI) Dockerfile
# Tesseract OCR + pdf2image (Poppler)
# Base: python:3.10-slim | Port: 8000
# ============================================================

FROM python:3.10-slim

# Sistem bağımlılıklarını kur (Tesseract OCR + Poppler PDF renderer + Türkçe/İngilizce dil paketleri)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-tur \
    tesseract-ocr-eng \
    poppler-utils \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Python bağımlılık dosyasını kopyala ve kur
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Türkçe NLP modeli indir (turkish-nlp-suite tr_core_news_md - ~15MB)
RUN pip install https://huggingface.co/turkish-nlp-suite/tr_core_news_md/resolve/main/tr_core_news_md-1.0-py3-none-any.whl

# Uygulama kaynak kodlarını kopyala
COPY . .

# Paylaşılan dosya dizinini oluştur
RUN mkdir -p /app/shared-uploads

# Volume mount noktası: backend ile paylaşılan dosya alanı
VOLUME ["/app/shared-uploads"]

# Tesseract dil verisi yolu
ENV TESSDATA_PREFIX=/usr/share/tesseract-ocr/4.00/tessdata

# 8000 portunu dışa aç
EXPOSE 8000

# Sağlık kontrolü (Health Check)
HEALTHCHECK --interval=30s --timeout=15s --start-period=30s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
