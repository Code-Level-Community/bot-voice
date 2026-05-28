# Estágio de Build
FROM node:22-slim AS builder

WORKDIR /app

COPY package*.json ./

# Impede que youtube-dl-exec tente baixar o binário durante o install
ENV YOUTUBE_DL_SKIP_DOWNLOAD=true

RUN npm ci

COPY . .
RUN npm run build && npm prune --production


# Estágio Final
FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ffmpeg \
    && pip3 install -q yt-dlp --break-system-packages \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -r -s /bin/false appuser

WORKDIR /app

COPY --from=builder /app/dist       ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

RUN chown -R appuser:appuser /app
USER appuser

ENV YOUTUBE_DL_SKIP_DOWNLOAD=true \
    FFMPEG_PATH=ffmpeg \
    YTDLP_PATH=yt-dlp \
    NODE_ENV=production

CMD ["node", "dist/index.js"]