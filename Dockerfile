FROM node:20-slim

# Instala as dependências de sistema: python3 (pro yt-dlp) e o ffmpeg do Linux
RUN apt-get update && apt-get install -y \
    python3 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copia os arquivos de pacotes primeiro para aproveitar o cache de camadas do Docker
COPY package*.json ./
RUN npm install

# Copia o restante do código fonte
COPY . .

# Compila o TypeScript para JavaScript (gera a pasta dist/)
RUN npm run build

# Define as variáveis de ambiente para o código usar os comandos globais do Linux
ENV FFMPEG_PATH=ffmpeg
ENV YTDLP_PATH=yt-dlp

# Comando de inicialização nativo e direto
CMD ["node", "dist/index.js"]