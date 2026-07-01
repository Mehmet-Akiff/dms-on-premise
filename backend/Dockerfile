# ============================================================
# DMS Backend - Node.js (Express) Dockerfile
# Base: node:20-alpine | Port: 3000
# ============================================================

FROM node:20-alpine

WORKDIR /app

# Bağımlılık dosyalarını önce kopyala (Docker cache optimizasyonu)
COPY package*.json ./

RUN npm ci --omit=dev --silent

# Uygulama kaynak kodlarını kopyala
COPY . .

# Yüklenen dosyaların saklanacağı dizini oluştur
RUN mkdir -p /app/uploads

# Volume mount noktası: dosya yüklemeleri için kalıcı alan
VOLUME ["/app/uploads"]

# 3000 portunu dışa aç
EXPOSE 3000

# Sağlık kontrolü (Health Check)
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "src/server.js"]
