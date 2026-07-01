"""
DMS On-Premise - Yerel Yapay Zeka Servisi
FastAPI | Tesseract OCR | SpaCy | TinyBERT
Port: 8000
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
from typing import Optional
import os

# ============================================================
# Uygulama Yapılandırması
# ============================================================

app = FastAPI(
    title="DMS AI Service",
    description="On-Premise Doküman İşleme ve Sınıflandırma Servisi",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SHARED_UPLOADS_DIR = os.getenv("SHARED_UPLOADS_DIR", "/app/shared-uploads")


# ============================================================
# Veri Modelleri (Pydantic Schemas)
# ============================================================

class HealthResponse(BaseModel):
    status: str
    service: str
    timestamp: str


class OCRResult(BaseModel):
    filename: str
    extracted_text: str
    language: str


class ClassificationResult(BaseModel):
    filename: str
    category: str
    confidence: float
    entities: list
    tags: list


class ProcessingResponse(BaseModel):
    job_id: str
    status: str
    ocr: Optional[OCRResult] = None
    classification: Optional[ClassificationResult] = None


# ============================================================
# Uç Noktalar (Endpoints)
# ============================================================

@app.get("/", response_model=HealthResponse)
async def root():
    """Kök endpoint - Servis durumu kontrolü."""
    return HealthResponse(
        status="ok",
        service="dms-ai-service",
        timestamp=datetime.utcnow().isoformat(),
    )


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Sağlık kontrolü endpoint'i (Docker HEALTHCHECK tarafından kullanılır)."""
    return HealthResponse(
        status="healthy",
        service="dms-ai-service",
        timestamp=datetime.utcnow().isoformat(),
    )


@app.post("/api/ocr", response_model=OCRResult)
async def perform_ocr(file: UploadFile = File(...)):
    """
    Yüklenen dosya üzerinde Tesseract OCR çalıştırır.
    Desteklenen formatlar: PDF, PNG, JPG, TIFF
    """
    # TODO: Tesseract OCR entegrasyonu (Gün 4'te implemente edilecek)
    return OCRResult(
        filename=file.filename or "unknown",
        extracted_text="[OCR henüz implemente edilmedi]",
        language="tur",
    )


@app.post("/api/classify", response_model=ClassificationResult)
async def classify_document(file: UploadFile = File(...)):
    """
    Doküman metnini SpaCy NER ve TinyBERT ile analiz ederek
    kategori, etiket ve varlık (entity) çıkarımı yapar.
    """
    # TODO: SpaCy + TinyBERT entegrasyonu (Gün 5'te implemente edilecek)
    return ClassificationResult(
        filename=file.filename or "unknown",
        category="uncategorized",
        confidence=0.0,
        entities=[],
        tags=[],
    )


@app.post("/api/process", response_model=ProcessingResponse)
async def process_document(file: UploadFile = File(...)):
    """
    Tam doküman işleme hattı: OCR → NLP → Sınıflandırma
    Backend tarafından asenkron olarak çağrılır.
    """
    # TODO: Tam işleme hattı (Gün 6'da implemente edilecek)
    return ProcessingResponse(
        job_id="pending",
        status="not_implemented",
    )
