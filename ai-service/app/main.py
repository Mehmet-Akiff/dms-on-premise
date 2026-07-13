"""
DMS On-Premise - Yerel Yapay Zeka Servisi
FastAPI | Tesseract OCR | Pillow | pdf2image
Port: 8000

Tüm işlemler yerel (on-premise) sunucuda gerçekleşir.
Hiçbir veri dış servislere gönderilmez.
"""

import os
import logging
import tempfile
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import pytesseract
from PIL import Image
from pdf2image import convert_from_path

# ============================================================
# Loglama Yapılandırması
# ============================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("dms-ai-service")

# ============================================================
# Sabitler
# ============================================================

SHARED_UPLOADS_DIR = os.getenv("SHARED_UPLOADS_DIR", "/app/shared-uploads")
TESSERACT_LANG = os.getenv("TESSERACT_LANG", "tur+eng")

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".webp"}
PDF_EXTENSIONS = {".pdf"}
SUPPORTED_EXTENSIONS = IMAGE_EXTENSIONS | PDF_EXTENSIONS

# ============================================================
# FastAPI Uygulama Yapılandırması
# ============================================================

app = FastAPI(
    title="DMS AI Service",
    description="On-Premise Doküman İşleme ve Sınıflandırma Servisi — Tesseract OCR + PDF Desteği",
    version="0.3.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# Pydantic Şemaları (Request / Response)
# ============================================================


class HealthResponse(BaseModel):
    status: str
    service: str
    timestamp: str


class OCRRequest(BaseModel):
    filePath: str = Field(
        ...,
        description="İşlenecek dosyanın /app/shared-uploads içindeki yolu veya tam yolu",
        examples=["document.png", "/app/shared-uploads/document.pdf"],
    )


class OCRSuccessResponse(BaseModel):
    status: str = "success"
    text: str
    filePath: str
    language: str
    pageCount: int = 1
    processedAt: str


class ErrorResponse(BaseModel):
    status: str = "error"
    message: str


# ============================================================
# Yardımcı Fonksiyonlar
# ============================================================


def resolve_file_path(file_path: str) -> Path:
    """
    Gelen dosya yolunu çözümler.
    - Mutlak yol verilmişse doğrudan kullanır.
    - Göreli yol verilmişse SHARED_UPLOADS_DIR ile birleştirir.
    """
    path = Path(file_path)
    if path.is_absolute():
        return path
    return Path(SHARED_UPLOADS_DIR) / path


def ocr_single_image(image: Image.Image) -> str:
    """Tek bir Pillow Image nesnesi üzerinde Tesseract OCR çalıştırır."""
    return pytesseract.image_to_string(image, lang=TESSERACT_LANG).strip()


def ocr_pdf(file_path: Path) -> tuple[str, int]:
    """
    PDF dosyasını sayfa sayfa görsele dönüştürür ve her sayfada OCR çalıştırır.
    Sonuçları sayfa ayracı ile birleştirir.
    Dönüş: (birleşik_metin, sayfa_sayısı)
    """
    logger.info("PDF → Görsel dönüşümü başlatılıyor — Dosya: %s", file_path.name)

    with tempfile.TemporaryDirectory(prefix="dms_pdf_") as tmp_dir:
        pages = convert_from_path(
            str(file_path),
            dpi=300,
            output_folder=tmp_dir,
            fmt="png",
            thread_count=2,
        )

        page_count = len(pages)
        logger.info("PDF → %d sayfa başarıyla görsele dönüştürüldü.", page_count)

        page_texts = []
        for i, page_image in enumerate(pages, start=1):
            logger.info("OCR işleniyor — Sayfa %d/%d", i, page_count)
            text = ocr_single_image(page_image)
            page_texts.append(f"--- Sayfa {i} ---\n{text}")

        combined_text = "\n\n".join(page_texts).strip()
        return combined_text, page_count


# ============================================================
# GET /health — Sağlık Kontrolü
# ============================================================


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Servisin ayakta olup olmadığını kontrol eder. Docker HEALTHCHECK tarafından kullanılır."""
    logger.info("Sağlık kontrolü isteği alındı.")
    return HealthResponse(
        status="ok",
        service="ai-service",
        timestamp=datetime.utcnow().isoformat(),
    )


@app.get("/", response_model=HealthResponse)
async def root():
    """Kök endpoint — sağlık kontrolü ile aynı yanıtı döner."""
    return HealthResponse(
        status="ok",
        service="ai-service",
        timestamp=datetime.utcnow().isoformat(),
    )


# ============================================================
# POST /api/ocr — Tesseract OCR ile Metin Çıkarımı (Görsel + PDF)
# ============================================================


@app.post(
    "/api/ocr",
    response_model=OCRSuccessResponse,
    responses={
        404: {"model": ErrorResponse, "description": "Dosya bulunamadı"},
        422: {"model": ErrorResponse, "description": "Desteklenmeyen dosya formatı"},
        500: {"model": ErrorResponse, "description": "OCR işlemi sırasında hata"},
    },
)
async def perform_ocr(request: OCRRequest):
    """
    Verilen dosya yolundaki görseli veya PDF'i Tesseract OCR ile okur ve metni döner.

    - Dosya, Node.js backend ile paylaşılan `/app/shared-uploads` dizininden okunur.
    - PDF dosyaları pdf2image (poppler) ile sayfa sayfa görsele dönüştürülür.
    - Dil parametresi varsayılan olarak Türkçe + İngilizce (tur+eng) ayarlıdır.
    """
    resolved_path = resolve_file_path(request.filePath)

    logger.info("OCR isteği alındı — Dosya: %s", resolved_path)

    # --- Dosya varlık kontrolü ---
    if not resolved_path.exists():
        logger.error("Dosya bulunamadı: %s", resolved_path)
        raise HTTPException(
            status_code=404,
            detail={"status": "error", "message": f"Dosya bulunamadı: {resolved_path}"},
        )

    if not resolved_path.is_file():
        logger.error("Belirtilen yol bir dosya değil: %s", resolved_path)
        raise HTTPException(
            status_code=400,
            detail={"status": "error", "message": f"Belirtilen yol bir dosya değil: {resolved_path}"},
        )

    # --- Dosya uzantı kontrolü ---
    suffix = resolved_path.suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        logger.error("Desteklenmeyen dosya formatı: %s (uzantı: %s)", resolved_path.name, suffix)
        raise HTTPException(
            status_code=422,
            detail={
                "status": "error",
                "message": f"Desteklenmeyen dosya formatı: {suffix}. Desteklenen: {', '.join(sorted(SUPPORTED_EXTENSIONS))}",
            },
        )

    # --- OCR İşlemi ---
    try:
        is_pdf = suffix in PDF_EXTENSIONS
        page_count = 1

        if is_pdf:
            # ===== PDF MODU =====
            logger.info("PDF modu — Çok sayfalı OCR başlatılıyor — Dosya: %s", resolved_path.name)
            extracted_text, page_count = ocr_pdf(resolved_path)
        else:
            # ===== GÖRSEL MODU =====
            logger.info("Görsel modu — OCR başlatılıyor — Dil: %s — Dosya: %s", TESSERACT_LANG, resolved_path.name)
            image = Image.open(resolved_path)
            extracted_text = ocr_single_image(image)

        logger.info(
            "OCR işlemi tamamlandı — Dosya: %s — Sayfa: %d — Çıkarılan karakter: %d",
            resolved_path.name,
            page_count,
            len(extracted_text),
        )

        return OCRSuccessResponse(
            status="success",
            text=extracted_text,
            filePath=str(resolved_path),
            language=TESSERACT_LANG,
            pageCount=page_count,
            processedAt=datetime.utcnow().isoformat(),
        )

    except pytesseract.TesseractNotFoundError:
        logger.critical("Tesseract OCR motoru bulunamadı! Kurulum kontrol edilmeli.")
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "message": "Tesseract OCR motoru sunucuda bulunamadı. Lütfen kurulumu kontrol edin.",
            },
        )

    except Exception as e:
        logger.exception("OCR işlemi sırasında beklenmeyen hata — Dosya: %s", resolved_path.name)
        raise HTTPException(
            status_code=500,
            detail={
                "status": "error",
                "message": f"OCR işlemi sırasında hata oluştu: {str(e)}",
            },
        )
