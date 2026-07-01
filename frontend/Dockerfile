# ============================================================
# DMS Frontend - Vue 3 (Vite) Dockerfile
# Multi-stage build: Build with Node, Serve with Nginx
# ============================================================

# --- Stage 1: Build ---
FROM node:20-alpine AS build

WORKDIR /app

# Bağımlılık dosyalarını önce kopyala (Docker cache optimizasyonu)
COPY package*.json ./

RUN npm ci --silent

# Uygulama kaynak kodlarını kopyala ve üretim derlemesi yap
COPY . .

RUN npm run build

# --- Stage 2: Serve ---
FROM nginx:stable-alpine AS production

# Nginx yapılandırma dosyasını kopyala
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Build çıktısını Nginx sunucu dizinine kopyala
COPY --from=build /app/dist /usr/share/nginx/html

# 80 portunu dışa aç
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
