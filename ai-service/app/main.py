"""
DMS On-Premise - Yerel Yapay Zeka Servisi
FastAPI | Tesseract OCR | Pillow | pdf2image | SpaCy (NLP)
Port: 8000

Tüm işlemler yerel (on-premise) sunucuda gerçekleşir.
Hiçbir veri dış servislere gönderilmez.
"""

import os
import re
import logging
import tempfile
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import pytesseract
from PIL import Image
from pdf2image import convert_from_path
import spacy

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
# Sabitler & Model Yükleme
# ============================================================

SHARED_UPLOADS_DIR = os.getenv("SHARED_UPLOADS_DIR", "/app/shared-uploads")
TESSERACT_LANG = os.getenv("TESSERACT_LANG", "tur+eng")

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".webp"}
PDF_EXTENSIONS = {".pdf"}
SUPPORTED_EXTENSIONS = IMAGE_EXTENSIONS | PDF_EXTENSIONS

# SpaCy Türkçe Dil Modelini Yükle
try:
    logger.info("SpaCy Türkçe dil modeli (tr_core_news_md) yükleniyor...")
    nlp = spacy.load("tr_core_news_md")
    logger.info("SpaCy modeli başarıyla yüklendi. ✓")
except Exception as e:
    logger.error("SpaCy model yükleme hatası! Boş bir model kuruluyor: %s", str(e))
    # Fallback: model yüklenemezse blank model kur
    nlp = spacy.blank("tr")

# Sınıflandırma Kuralları (Anahtar Kelimeler)
CATEGORY_KEYWORDS = {
    "Fatura": ["fatura", "invoice", "kdv", "matrah", "tutar", "fiyat", "vergi", "ödeme", "makbuz", "fiş", "toplam", "iban", "odeme", "fis", "faturasi"],
    "Bordro": ["bordro", "maaş", "ücret", "gelir", "kesinti", "sgk", "mesai", "çalışan", "net ödenen", "brüt", "bordrosu", "maas", "ucret", "calisan", "brut"],
    "Sozlesme": ["sözleşme", "anlaşma", "protokol", "taraf", "maddesi", "taahhüt", "imza", "akdedilen", "hüküm", "şartname", "sozlesme", "anlasma", "taahhut", "hukum", "sartname"],
    "Rapor": ["rapor", "analiz", "sunum", "değerlendirme", "sonuç", "grafik", "istatistik", "durum", "özet", "bilanço", "degerlendirme", "sonuc", "ozet", "bilanco"],
    "Dilekce": ["dilekçe", "dilekçesi", "makamına", "arz ederim", "gereğini", "bilgilerinize", "saygılarımla", "talep", "başvuru", "dilekce", "dilekcesi", "makamina", "geregini", "basvuru"]
}

# ============================================================
# FastAPI Uygulama Yapılandırması
# ============================================================

app = FastAPI(
    title="DMS AI Service",
    description="On-Premise Doküman İşleme ve Sınıflandırma Servisi — Tesseract OCR + PDF + SpaCy NLP",
    version="0.4.0",
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


class ClassifyRequest(BaseModel):
    text: str = Field(..., description="Sınıflandırılacak ve analiz edilecek ham metin")


class EntityItem(BaseModel):
    text: str
    label: str
    start: int
    end: int


class ClassifyResponse(BaseModel):
    status: str = "success"
    category: str
    documentCategory: Optional[str] = None
    confidence: float
    entities: List[EntityItem]
    tags: List[str]


class NLPSearchRequest(BaseModel):
    query: str = Field(..., description="Doğal dildeki arama sorgusu")


class NLPSearchResponse(BaseModel):
    status: str = "success"
    q: str
    category: Optional[str] = None
    excludeCategory: Optional[str] = None
    fileType: Optional[str] = None
    excludeFileType: Optional[str] = None
    excludeKeywords: Optional[List[str]] = None
    originalQuery: str


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


# ============================================================
# POST /api/classify-and-extract — Kategori & NER Analizi
# ============================================================


@app.post(
    "/api/classify-and-extract",
    response_model=ClassifyResponse,
    responses={
        500: {"model": ErrorResponse, "description": "Analiz işlemi sırasında hata"},
    },
)
async def classify_and_extract(request: ClassifyRequest):
    """
    Verilen metni SpaCy model ve anahtar kelime eşleştirme kuralları ile analiz eder.
    - Dokümanın hangi kategoriye girdiğini (Fatura, Bordro, Sözleşme vb.) belirler.
    - Metindeki NER (Kişi, Tarih, Para vb.) varlıklarını bulur.
    - Dokümana ait önemli etiketleri (Tags) çıkarır.
    """
    try:
        text = request.text
        text_lower = text.lower()

        # 1. Kategori Sınıflandırma (Anahtar Kelime Puanlaması)
        scores = {cat: 0 for cat in CATEGORY_KEYWORDS.keys()}
        total_keywords = 0

        for cat, keywords in CATEGORY_KEYWORDS.items():
            for kw in keywords:
                # Türkçe ekleri tolere etmek için basit count araması yapıyoruz
                matches = text_lower.count(kw)
                scores[cat] += matches
                total_keywords += matches

        # En yüksek puanı alan kategoriyi belirle
        best_cat = "Diger"
        max_score = 0
        confidence = 0.0

        if total_keywords > 0:
            for cat, score in scores.items():
                if score > max_score:
                    max_score = score
                    best_cat = cat
            confidence = round(max_score / total_keywords, 2)
            # En az 1 eşleşme varsa kategoriyi kabul et, yoksa Diğer yap
            if max_score < 1:
                best_cat = "Diger"
                confidence = 0.0
        else:
            best_cat = "Diger"
            confidence = 0.0

        # 2. NER & Etiket Çıkarımı (SpaCy ile)
        doc = nlp(text[:10000])  # Performans için ilk 10k karakteri analiz et
        entities = []
        tags = set()

        for ent in doc.ents:
            # Sadece önemli ve temiz etiketleri/varlıkları al
            clean_text = ent.text.strip().replace("\n", " ")
            if len(clean_text) < 2 or clean_text.isdigit():
                continue
            
            entities.append(
                EntityItem(
                    text=clean_text,
                    label=ent.label_,
                    start=ent.start_char,
                    end=ent.end_char
                )
            )

            # Belirli NER etiketlerini tags listesine de ekleyelim
            if ent.label_ in ["PERSON", "ORG", "DATE", "MONEY", "CARDINAL"]:
                tags.add(clean_text)

        # Metinden bazı önemli regex temelli etiketleri de yakalayalım (KDV, Vergi No, Tarih vb.)
        # Tarih formatı (GG.AA.YYYY veya GG/AA/YYYY)
        dates = re.findall(r'\b\d{2}[./-]\d{2}[./-]\d{4}\b', text)
        for d in dates[:3]:
            tags.add(d)

        # IBAN formatı (TR...)
        ibans = re.findall(r'\bTR\d{2}\s?(?:\d{4}\s?){5}\d{2}\b', text)
        for iban in ibans[:2]:
            tags.add("IBAN: " + iban.replace(" ", "")[:10] + "...")

        # KDV oranı
        kdvs = re.findall(r'\b(?:kdv|KDV)\s*(?:%|% |)\s*(?:8|10|18|20)\b', text)
        for k in kdvs[:2]:
            tags.add(k.upper())

        logger.info(
            "Metin analizi tamamlandı — Belirlenen Kategori: %s (Güven: %.2f) — Çıkarılan etiket sayısı: %d",
            best_cat,
            confidence,
            len(tags)
        )

        return ClassifyResponse(
            status="success",
            category=best_cat,
            documentCategory=best_cat,
            confidence=confidence,
            entities=entities[:15],  # ilk 15 varlığı dön
            tags=sorted(list(tags))[:10]  # ilk 10 etiketi dön
        )

    except Exception as e:
        logger.exception("classify-and-extract işleminde hata")
        raise HTTPException(
            status_code=500,
            detail={"status": "error", "message": f"Analiz sırasında hata oluştu: {str(e)}"},
        )


# ============================================================
# POST /api/nlp-search — Doğal Dil Arama Sorgu Analizi
# ============================================================


@app.post(
    "/api/nlp-search",
    response_model=NLPSearchResponse,
    responses={
        500: {"model": ErrorResponse, "description": "NLP arama analizi sırasında hata"},
    },
)
async def nlp_search(request: NLPSearchRequest):
    """
    Kullanıcının doğal dilde girdiği arama sorgusunu ayrıştırır.
    Örn: "bana ahmet faturalarını getir" -> q="ahmet", category="Fatura"
    Örn: "ahmetin maaş bilgisi hariç belgeleri" -> q="ahmet", excludeCategory="Bordro"
    """
    try:
        query = request.query.strip()
        query_lower = query.lower()

        logger.info("Doğal dil arama analizi isteği alındı — Sorgu: '%s'", query)

        # 1. Kategori ve Dosya Türü tanımları
        category_mapping = {
            "Fatura": ["fatura", "faturaları", "faturalarını", "faturalar", "makbuz", "makbuzu", "makbuzları", "fiş", "fişi", "fişleri", "faturalari", "faturalarini", "makbuzlari", "fisi", "fisleri"],
            "Bordro": ["bordro", "bordrosu", "bordroları", "bordrolarını", "bordrolar", "maaş", "maaşı", "maaşları", "bordrolari", "bordrolarini", "maas", "maasi", "maaslari"],
            "Sozlesme": ["sözleşme", "sözleşmesi", "sözleşmelerini", "sözleşmeleri", "anlaşma", "anlaşması", "anlaşmaları", "protokol", "sozlesme", "sozlesmesi", "sozlesmelerini", "sozlesmeleri", "anlasma", "anlasmasi", "anlasmalari"],
            "Rapor": ["rapor", "raporu", "raporları", "raporlarını", "sunum", "analiz", "analizi", "bilanço", "raporlari", "raporlarini", "bilanco"],
            "Dilekce": ["dilekçe", "dilekçesi", "dilekçeleri", "talep", "başvuru", "başvurusu", "dilekce", "dilekcesi", "dilekceleri", "basvuru", "basvurusu"]
        }

        pdf_keywords = ["pdf", "pdf'ler", "pdf'leri", "pdfler"]
        image_keywords = ["resim", "resimleri", "görsel", "görselleri", "foto", "fotoğraf", "jpg", "png", "jpeg", "gorsel", "gorselleri", "fotograf"]
        negation_words = ["hariç", "haric", "dışında", "disinda", "olmayan", "olmasın", "olmasin", "istemiyorum", "hariçtir", "harictir", "olmasi"]

        stop_words = [
            "bana", "getir", "bul", "listele", "göster", "lütfen", "olan", "olanları", 
            "bulunan", "bulunanları", "ilişkin", "ait", "hakkındaki", "ile", "ve", "veya", 
            "dökümanları", "dokümanları", "dosyalarını", "dosyası", "belgeleri", "belgesi",
            "döküman", "doküman", "belge", "dosya", "tüm", "hepsi", "herkes", "herkesin", 
            "bilgi", "bilgisi", "bilgileri", "bilgilerini", "hakkında", "hakkinda", 
            "ilgili", "ilişkin", "iliskin",
            # Türkçe karaktersiz ve ek varyasyonları
            "dokumanlari", "dokuman", "dokumanlar", "dokumanlarini", "dokumanlarin",
            "dokumanlarını", "dokümanlarını", "dökümanlarını",
            "belgeler", "belgeleri", "belgelerini", "belgesini",
            "dosyalari", "dosyalarini", "dosyalar", "tum", "tumu", "tümü", "getirsin", "bulsun",
            # Bağlaçlar ve miktar/kısıt belirteçleri
            "ama", "sadece", "sadec", "yalnız", "yalniz", "tek", "bir", "ise", "da", "de"
        ]

        def clean_turkish_suffixes(word: str) -> str:
            w = word.lower().strip()
            w = re.sub(r"['’\"].*$", "", w)
            suffixes = r"(in|ın|un|ün|nın|nin|nun|nün|a|e|ı|i|u|ü|da|de|ta|te|dan|den|tan|ten|la|le|y|ya|ye|n)$"
            for _ in range(2):
                w = re.sub(suffixes, "", w)
            return w

        # SpaCy ile parse et
        doc = nlp(query)

        detected_category = None
        exclude_category = None
        detected_filetype = None
        exclude_filetype = None
        exclude_keywords = []

        # A. Kategori Negation Analizi
        for i, token in enumerate(doc):
            t_text = token.text.lower()
            t_lemma = token.lemma_.lower()
            
            found_cat = None
            for cat, keywords in category_mapping.items():
                if t_text in keywords or t_lemma in keywords or clean_turkish_suffixes(t_text) in keywords:
                    found_cat = cat
                    break
            
            if found_cat:
                is_negated = False
                for j in range(i + 1, min(i + 4, len(doc))):
                    next_token = doc[j].text.lower()
                    if next_token in negation_words:
                        is_negated = True
                        break
                
                if is_negated:
                    exclude_category = found_cat
                else:
                    detected_category = found_cat

        # B. Dosya Türü Negation Analizi
        for i, token in enumerate(doc):
            t_text = token.text.lower()
            t_lemma = token.lemma_.lower()
            
            found_type = None
            if t_text in pdf_keywords or t_lemma in pdf_keywords:
                found_type = "pdf"
            elif t_text in image_keywords or t_lemma in image_keywords or clean_turkish_suffixes(t_text) in image_keywords:
                found_type = "image"
                
            if found_type:
                is_negated = False
                for j in range(i + 1, min(i + 4, len(doc))):
                    next_token = doc[j].text.lower()
                    if next_token in negation_words:
                        is_negated = True
                        break
                
                if is_negated:
                    exclude_filetype = found_type
                else:
                    detected_filetype = found_type

        # C. Genel Kelimeler Negation Analizi (Exclude Keywords)
        for i, token in enumerate(doc):
            t_text = token.text.lower()
            t_clean = clean_turkish_suffixes(t_text)
            t_lemma = token.lemma_.lower()
            t_lemma_clean = clean_turkish_suffixes(t_lemma)
            
            is_candidate = True
            if (t_clean in stop_words or t_lemma_clean in stop_words or 
                any(t_clean in kw_list or t_lemma_clean in kw_list for kw_list in category_mapping.values()) or
                t_clean in pdf_keywords or t_lemma_clean in pdf_keywords or
                t_clean in image_keywords or t_lemma_clean in image_keywords):
                is_candidate = False
                
            if is_candidate:
                is_negated = False
                for j in range(i + 1, min(i + 2, len(doc))):
                    next_token = doc[j].text.lower()
                    if next_token in negation_words:
                        is_negated = True
                        break
                if is_negated:
                    exclude_keywords.append(t_clean)

        # D. Temiz Arama Sorgusu (q) Çıkarımı
        words_to_remove = set(stop_words + negation_words)
        for kw_list in category_mapping.values():
            words_to_remove.update(kw_list)
        words_to_remove.update(pdf_keywords)
        words_to_remove.update(image_keywords)
        words_to_remove.update(exclude_keywords)

        cleaned_tokens = []
        for token in doc:
            t_text = token.text.strip()
            if not t_text or token.is_punct:
                continue
                
            t_lower = t_text.lower()
            t_clean = clean_turkish_suffixes(t_lower)
            t_lemma = token.lemma_.lower()
            t_lemma_clean = clean_turkish_suffixes(t_lemma)
            
            if t_lower in words_to_remove or t_lemma in words_to_remove or t_clean in words_to_remove or t_lemma_clean in words_to_remove:
                continue
                
            cleaned_tokens.append(clean_turkish_suffixes(t_text))

        cleaned_query = " ".join(cleaned_tokens).strip()

        logger.info(
            "NLP Arama Çözümlemesi — Kategori: %s (Hariç: %s) — Tür: %s (Hariç: %s) — Hariç Kelimeler: %s — Kalan Sorgu: '%s'",
            detected_category,
            exclude_category,
            detected_filetype,
            exclude_filetype,
            exclude_keywords,
            cleaned_query
        )

        return NLPSearchResponse(
            status="success",
            q=cleaned_query,
            category=detected_category,
            excludeCategory=exclude_category,
            fileType=detected_filetype,
            excludeFileType=exclude_filetype,
            excludeKeywords=exclude_keywords,
            originalQuery=query
        )

    except Exception as e:
        logger.exception("nlp-search işleminde hata")
        raise HTTPException(
            status_code=500,
            detail={"status": "error", "message": f"NLP arama analizi sırasında hata oluştu: {str(e)}"},
        )

    except Exception as e:
        logger.exception("nlp-search işleminde hata")
        raise HTTPException(
            status_code=500,
            detail={"status": "error", "message": f"NLP arama analizi sırasında hata oluştu: {str(e)}"},
        )
