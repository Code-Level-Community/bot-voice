FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --production


FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Usuário não-root para segurança
RUN useradd -r -s /bin/false appuser

WORKDIR /app

# Copia apenas o necessário do estágio de build
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

RUN chown -R appuser:appuser /app
USER appuser

ENV FFMPEG_PATH=ffmpeg \
    YTDLP_PATH=yt-dlp \
    NODE_ENV=production

CMD ["node", "dist/index.js"]