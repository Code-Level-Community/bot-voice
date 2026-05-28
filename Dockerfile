# Estágio de Build
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
# Usamos install para ser mais tolerante durante o build, 
# mas você pode voltar para 'ci' após garantir que o lock está correto
RUN npm install
COPY . .
RUN npm run build && npm prune --production

# Estágio Final
FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# Copia apenas o que foi compilado e as dependências de produção
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# Adiciona o yt-dlp globalmente para evitar erros de caminho
RUN npm install -g yt-dlp

RUN useradd -r -s /bin/false appuser
RUN chown -R appuser:appuser /app
USER appuser

ENV FFMPEG_PATH=/usr/bin/ffmpeg \
    YTDLP_PATH=/usr/local/bin/yt-dlp \
    NODE_ENV=production

CMD ["node", "dist/index.js"]