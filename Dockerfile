FROM node:22-slim AS builder

WORKDIR /app

ENV YOUTUBE_DL_SKIP_DOWNLOAD=true

COPY package*.json tsconfig.json ./
RUN npm install --ignore-scripts

COPY . .
RUN npm run build && npm prune --production


FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip xz-utils curl unzip \
    && pip3 install -q yt-dlp --break-system-packages \
    && curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh \
    && curl -L https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz \
       | tar -xJ --strip-components=1 -C /usr/local/bin --wildcards '*/ffmpeg' \
    && apt-get purge -y xz-utils curl unzip \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -r -s /bin/false appuser

WORKDIR /app

COPY --from=builder /app/dist         ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

RUN mkdir -p /home/appuser/.cache/yt-dlp && \
    chown -R appuser:appuser /home/appuser

USER appuser

ENV YOUTUBE_DL_SKIP_DOWNLOAD=true \
    FFMPEG_PATH=ffmpeg \
    YTDLP_PATH=yt-dlp \
    NODE_ENV=production

CMD ["node", "dist/index.js"]