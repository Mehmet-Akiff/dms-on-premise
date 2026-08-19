"""
DMS On-Premise - Yerel Yapay Zeka Servisi
FastAPI | Tesseract OCR | pdfplumber (Tablo Uyumlu) | Pillow | pdf2image | SpaCy (NLP)
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

try:
    import pdfplumber
except ImportError:
    pdfplumber = None

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
# Sabitler & Güvenlik Tanımları
# ============================================================

SHARED_UPLOADS_DIR = os.getenv("SHARED_UPLOADS_DIR", "/app/shared-uploads")
TESSERACT_LANG = os.getenv("TESSERACT_LANG", "tur+eng")

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".tiff", ".tif", ".bmp", ".webp"}
PDF_EXTENSIONS = {".pdf"}
EXECUTABLE_EXTENSIONS = {
    ".exe", ".bat", ".cmd", ".sh", ".vbs", ".js", ".jar", ".msi",
    ".ps1", ".com", ".scr", ".hta", ".dll", ".bin", ".iso", ".deb",
    ".rpm", ".appimage", ".pif", ".reg", ".wsf", ".cpl", ".action", ".command"
}
SUPPORTED_EXTENSIONS = IMAGE_EXTENSIONS | PDF_EXTENSIONS | EXECUTABLE_EXTENSIONS

EXECUTABLE_SECURITY_WARNING = "⚠️ DİKKAT: Bu çalıştırılabilir bir dosyadır. İçerisine sistem güvenliğini tehdit edecek gizli kodlar enjekte edilmiş olabilir."

# SpaCy Türkçe Dil Modelini Yükle
try:
    logger.info("SpaCy Türkçe dil modeli (tr_core_news_md) yükleniyor...")
    nlp = spacy.load("tr_core_news_md")
    logger.info("SpaCy modeli başarıyla yüklendi. ✓")
except Exception as e:
    logger.error("SpaCy model yükleme hatası! Boş model kuruluyor: %s", str(e))
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
    description="On-Premise Doküman İşleme, Tablo Uyumlu OCR, AI Özetleme ve Sınıflandırma Servisi",
    version="0.5.0",
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
    hasTables: bool = False


class ClassifyRequest(BaseModel):
    text: str = Field(..., description="Sınıflandırılacak ve analiz edilecek ham metin")
    fileName: Optional[str] = None


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
    summary: Optional[str] = None


class SummarizeRequest(BaseModel):
    text: str = Field(..., description="Özetlenecek ham metin")
    maxSentences: int = Field(3, description="Özette yer alacak maksimum cümle sayısı")


class SummarizeResponse(BaseModel):
    status: str = "success"
    summary: str


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
# Yardımcı Fonksiyonlar & Algoritmalar
# ============================================================

def resolve_file_path(file_path: str) -> Path:
    """Gelen dosya yolunu çözümler."""
    path = Path(file_path)
    if path.is_absolute():
        return path
    return Path(SHARED_UPLOADS_DIR) / path


def ocr_single_image(image: Image.Image) -> str:
    """Tek bir Pillow Image nesnesi üzerinde Tesseract OCR çalıştırır."""
    return pytesseract.image_to_string(image, lang=TESSERACT_LANG, config="--psm 4").strip()


def ocr_pdf_tesseract(file_path: Path) -> tuple[str, int]:
    """PDF dosyasını görsellere dönüştürüp Tesseract OCR ile tarar (Fallback)."""
    logger.info("PDF → Tesseract OCR fallback başlatılıyor — Dosya: %s", file_path.name)
    with tempfile.TemporaryDirectory(prefix="dms_pdf_") as tmp_dir:
        pages = convert_from_path(
            str(file_path),
            dpi=150,
            output_folder=tmp_dir,
            fmt="png",
            thread_count=4,
        )
        page_count = len(pages)
        page_texts = []
        for i, page_image in enumerate(pages, start=1):
            text = ocr_single_image(page_image)
            page_texts.append(f"--- Sayfa {i} ---\n{text}")
        return "\n\n".join(page_texts).strip(), page_count


def extract_pdf_with_tables(file_path: Path) -> tuple[str, int, bool]:
    """
    PDF dosyasını pdfplumber ile okur.
    Tabloları tespit edip Markdown formatında metne dahil eder (Tablo Yapısı Korunur).
    Eğer pdfplumber metin bulamazsa (taranmış görsel PDF) Tesseract fallback çalıştırır.
    Dönüş: (birleşik_metin, sayfa_sayısı, tablo_var_mı)
    """
    has_tables = False
    if pdfplumber is not None:
        try:
            page_texts = []
            with pdfplumber.open(str(file_path)) as pdf:
                page_count = len(pdf.pages)
                for i, page in enumerate(pdf.pages, start=1):
                    page_content = []
                    
                    # 1. Tabloları Çıkar ve Markdown Formatına Dönüştür
                    tables = page.extract_tables()
                    table_mds = []
                    if tables:
                        for table in tables:
                            if not table or len(table) < 1:
                                continue
                            cleaned_table = [
                                [(cell or "").strip().replace("\n", " ") for cell in row]
                                for row in table
                            ]
                            if not any(any(row) for row in cleaned_table):
                                continue
                            
                            has_tables = True
                            header = cleaned_table[0]
                            num_cols = max(1, len(header))
                            
                            md_rows = [
                                "| " + " | ".join(header) + " |",
                                "| " + " | ".join(["---"] * num_cols) + " |"
                            ]
                            for row in cleaned_table[1:]:
                                row_cells = (row + [""] * num_cols)[:num_cols]
                                md_rows.append("| " + " | ".join(row_cells) + " |")
                            
                            table_mds.append("\n".join(md_rows))

                    # 2. Sayfadaki Düz Metni Al
                    raw_text = page.extract_text() or ""
                    
                    if raw_text.strip():
                        page_content.append(raw_text.strip())
                    if table_mds:
                        page_content.append("\n📊 **[Tablo Verileri]**:\n" + "\n\n".join(table_mds))
                    
                    full_page = "\n\n".join(page_content).strip()
                    if full_page:
                        page_texts.append(f"--- Sayfa {i} ---\n{full_page}")

                combined_text = "\n\n".join(page_texts).strip()
                if len(combined_text) > 30:
                    logger.info("pdfplumber ile %d sayfa ve tablolar başarıyla çıkarıldı.", page_count)
                    return combined_text, page_count, has_tables

        except Exception as e:
            logger.warning("pdfplumber ayrıştırma hatası, Tesseract OCR deneniyor: %s", str(e))

    # Taranmış görsel PDF fallback
    text, count = ocr_pdf_tesseract(file_path)
    return text, count, has_tables


def extract_summary(text: str, max_sentences: int = 3) -> str:
    """
    SpaCy ve TF-IDF tabanlı hafif, çevrimdışı (Extractive) Özetleme Algoritması.
    En kritik 3-5 cümleyi seçerek özet oluşturur.
    """
    if not text or len(text.strip()) < 40:
        return text.strip() if text else "Özet çıkarılamadı."

    if "⚠️ DİKKAT: Bu çalıştırılabilir bir dosyadır" in text:
        return EXECUTABLE_SECURITY_WARNING

    # Metnin ilk 10.000 karakterini analiz et
    sample_text = text[:10000]
    doc = nlp(sample_text)
    
    sentences = [sent.text.strip() for sent in doc.sents if len(sent.text.strip()) > 15]
    if len(sentences) <= max_sentences:
        return " ".join(sentences)

    # Kelime frekansı hesapla
    word_freq = {}
    for token in doc:
        if not token.is_stop and not token.is_punct and len(token.text) > 2:
            w = token.text.lower()
            word_freq[w] = word_freq.get(w, 0) + 1

    if not word_freq:
        return " ".join(sentences[:max_sentences])

    max_freq = max(word_freq.values())
    for w in word_freq:
        word_freq[w] = word_freq[w] / max_freq

    # Cümleleri skorla
    sentence_scores = []
    for i, sent in enumerate(sentences):
        score = 0
        words = [w.strip().lower() for w in re.split(r'\W+', sent) if w.strip()]
        for word in words:
            if word in word_freq:
                score += word_freq[word]
        if words:
            score = score / (len(words) ** 0.5)
        sentence_scores.append((score, i, sent))

    # En yüksek puanlı cümleleri orijinal sırasına göre diz
    top_sentences = sorted(sentence_scores, key=lambda x: x[0], reverse=True)[:max_sentences]
    top_ordered = sorted(top_sentences, key=lambda x: x[1])
    
    return " ".join([item[2] for item in top_ordered])


# ============================================================
# API Endpoints
# ============================================================

@app.get("/health", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="ok",
        service="ai-service",
        timestamp=datetime.utcnow().isoformat(),
    )


@app.get("/", response_model=HealthResponse)
async def root():
    return HealthResponse(
        status="ok",
        service="ai-service",
        timestamp=datetime.utcnow().isoformat(),
    )


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
    Verilen dosya yolundaki belgeyi okur.
    - Çalıştırılabilir dosya ise (.exe, .bat vb.) OCR atlanır ve güvenlik uyarısı basılır.
    - PDF ise pdfplumber ile tablolar korunarak metin çıkarılır.
    - Görsel ise Tesseract OCR kullanılır.
    """
    resolved_path = resolve_file_path(request.filePath)

    if not resolved_path.exists():
        logger.warning("Dosya bulunamadı: %s", resolved_path)
        raise HTTPException(
            status_code=404,
            detail={"status": "error", "message": f"Dosya bulunamadı: {request.filePath}"},
        )

    suffix = resolved_path.suffix.lower()

    # 1. Güvenlik: Çalıştırılabilir Dosya Kontrolü
    if suffix in EXECUTABLE_EXTENSIONS:
        logger.warning("Çalıştırılabilir dosya algılandı, OCR atlandı: %s", resolved_path.name)
        return OCRSuccessResponse(
            status="success",
            text=EXECUTABLE_SECURITY_WARNING,
            filePath=str(resolved_path),
            language="none",
            pageCount=1,
            processedAt=datetime.utcnow().isoformat(),
            hasTables=False,
        )

    if suffix not in SUPPORTED_EXTENSIONS:
        logger.warning("Desteklenmeyen dosya formatı: %s", suffix)
        raise HTTPException(
            status_code=422,
            detail={
                "status": "error",
                "message": f"Desteklenmeyen dosya formatı '{suffix}'. Desteklenenler: PDF, PNG, JPG, TIFF, BMP, WEBP",
            },
        )

    try:
        has_tables = False
        if suffix in PDF_EXTENSIONS:
            extracted_text, page_count, has_tables = extract_pdf_with_tables(resolved_path)
        else:
            with Image.open(resolved_path) as img:
                extracted_text = ocr_single_image(img)
                page_count = 1

        logger.info("Metin çıkarma tamamlandı — Dosya: %s — Sayfa: %d — Karakter: %d", resolved_path.name, page_count, len(extracted_text))

        return OCRSuccessResponse(
            status="success",
            text=extracted_text,
            filePath=str(resolved_path),
            language=TESSERACT_LANG,
            pageCount=page_count,
            processedAt=datetime.utcnow().isoformat(),
            hasTables=has_tables,
        )

    except Exception as e:
        logger.exception("OCR işlemi sırasında hata: %s", resolved_path.name)
        raise HTTPException(
            status_code=500,
            detail={"status": "error", "message": f"OCR işlemi sırasında hata: {str(e)}"},
        )


@app.post(
    "/api/classify-and-extract",
    response_model=ClassifyResponse,
    responses={
        500: {"model": ErrorResponse, "description": "Analiz işlemi sırasında hata"},
    },
)
async def classify_and_extract(request: ClassifyRequest):
    """
    Metni sınıflandırır, NER varlıklarını çıkarır ve AI özetini üretir.
    """
    try:
        text = request.text
        file_name = (request.fileName or "").lower()
        suffix = Path(file_name).suffix.lower() if file_name else ""

        # Çalıştırılabilir dosya kontrolü
        if suffix in EXECUTABLE_EXTENSIONS or EXECUTABLE_SECURITY_WARNING in text:
            return ClassifyResponse(
                status="success",
                category="EXECUTABLE_WARNING",
                documentCategory="Güvenlik Uyarısı (Çalıştırılabilir Dosya)",
                confidence=1.0,
                entities=[],
                tags=["ZARARLI_DOSYA_RISKI", "CALISTIRILABILIR", "GÜVENLİK_ENGELİ"],
                summary=EXECUTABLE_SECURITY_WARNING
            )

        text_lower = text.lower()

        # 1. Kategori Sınıflandırma
        scores = {cat: 0 for cat in CATEGORY_KEYWORDS.keys()}
        total_keywords = 0

        for cat, keywords in CATEGORY_KEYWORDS.items():
            for kw in keywords:
                matches = text_lower.count(kw)
                scores[cat] += matches
                total_keywords += matches

        best_cat = "Diger"
        max_score = 0
        confidence = 0.0

        if total_keywords > 0:
            for cat, score in scores.items():
                if score > max_score:
                    max_score = score
                    best_cat = cat
            confidence = round(max_score / total_keywords, 2)
            if max_score < 1:
                best_cat = "Diger"
                confidence = 0.0

        # 2. NER & Etiket Çıkarımı
        doc = nlp(text[:10000])
        entities = []
        tags = set()

        for ent in doc.ents:
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
            if ent.label_ in ["PERSON", "ORG", "DATE", "MONEY", "CARDINAL"]:
                tags.add(clean_text)

        # Regex etiketleri
        dates = re.findall(r'\b\d{2}[./-]\d{2}[./-]\d{4}\b', text)
        for d in dates[:3]:
            tags.add(d)

        ibans = re.findall(r'\bTR\d{2}\s?(?:\d{4}\s?){5}\d{2}\b', text)
        for iban in ibans[:2]:
            tags.add("IBAN: " + iban.replace(" ", "")[:10] + "...")

        kdvs = re.findall(r'\b(?:kdv|KDV)\s*(?:%|% |)\s*(?:8|10|18|20)\b', text)
        for k in kdvs[:2]:
            tags.add(k.upper())

        # 3. AI Özetleme (Extractive)
        generated_summary = extract_summary(text, max_sentences=3)

        return ClassifyResponse(
            status="success",
            category=best_cat,
            documentCategory=best_cat,
            confidence=confidence,
            entities=entities[:15],
            tags=sorted(list(tags))[:10],
            summary=generated_summary
        )

    except Exception as e:
        logger.exception("classify-and-extract işleminde hata")
        raise HTTPException(
            status_code=500,
            detail={"status": "error", "message": f"Analiz sırasında hata: {str(e)}"},
        )


@app.post("/api/summarize", response_model=SummarizeResponse)
async def summarize_text(request: SummarizeRequest):
    """
    Verilen metnin kısa AI özetini döner.
    """
    summary = extract_summary(request.text, request.maxSentences)
    return SummarizeResponse(status="success", summary=summary)


@app.post(
    "/api/nlp-search",
    response_model=NLPSearchResponse,
    responses={
        500: {"model": ErrorResponse, "description": "NLP arama analizi sırasında hata"},
    },
)
async def nlp_search(request: NLPSearchRequest):
    """Kullanıcının doğal dilde girdiği arama sorgusunu ayrıştırır."""
    try:
        query = request.query.strip()
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
            "ilgili", "ilişkin", "iliskin", "dokumanlari", "dokuman", "dokumanlar", 
            "belgeler", "belgeleri", "dosyalari", "tum", "tumu", "tümü", "ama", "sadece", "bir"
        ]

        def clean_turkish_suffixes(word: str) -> str:
            w = word.lower().strip()
            w = re.sub(r"['’\"].*$", "", w)
            suffixes = r"(in|ın|un|ün|nın|nin|nun|nün|a|e|ı|i|u|ü|da|de|ta|te|dan|den|tan|ten|la|le|y|ya|ye|n)$"
            for _ in range(2):
                w = re.sub(suffixes, "", w)
            return w

        doc = nlp(query)
        detected_category = None
        exclude_category = None
        detected_filetype = None
        exclude_filetype = None
        exclude_keywords = []

        for i, token in enumerate(doc):
            t_text = token.text.lower()
            t_lemma = token.lemma_.lower()
            found_cat = None
            for cat, keywords in category_mapping.items():
                if t_text in keywords or t_lemma in keywords or clean_turkish_suffixes(t_text) in keywords:
                    found_cat = cat
                    break
            if found_cat:
                is_negated = any(doc[j].text.lower() in negation_words for j in range(i + 1, min(i + 4, len(doc))))
                if is_negated:
                    exclude_category = found_cat
                else:
                    detected_category = found_cat

        for i, token in enumerate(doc):
            t_text = token.text.lower()
            t_lemma = token.lemma_.lower()
            found_type = None
            if t_text in pdf_keywords or t_lemma in pdf_keywords:
                found_type = "pdf"
            elif t_text in image_keywords or t_lemma in image_keywords:
                found_type = "image"
            if found_type:
                is_negated = any(doc[j].text.lower() in negation_words for j in range(i + 1, min(i + 4, len(doc))))
                if is_negated:
                    exclude_filetype = found_type
                else:
                    detected_filetype = found_type

        words_to_remove = set(stop_words + negation_words)
        for kw_list in category_mapping.values():
            words_to_remove.update(kw_list)
        words_to_remove.update(pdf_keywords)
        words_to_remove.update(image_keywords)

        cleaned_tokens = []
        for token in doc:
            t_text = token.text.strip()
            if not t_text or token.is_punct:
                continue
            t_lower = t_text.lower()
            t_clean = clean_turkish_suffixes(t_lower)
            if t_lower in words_to_remove or t_clean in words_to_remove:
                continue
            cleaned_tokens.append(clean_turkish_suffixes(t_text))

        cleaned_query = " ".join(cleaned_tokens).strip()

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
            detail={"status": "error", "message": f"NLP arama analizi hatası: {str(e)}"},
        )
