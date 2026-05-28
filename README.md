# Bot Voice — Rádios Virtuais para Discord

Bot de rádio 24/7 para Discord que conecta múltiplos bots simultaneamente em canais de voz, transmitindo áudio de streams do YouTube (lives e playlists) via yt-dlp + FFmpeg.

Cada "rádio" é um bot Discord independente, com seu próprio token, canal e URL de stream — todos rodando em paralelo no mesmo processo.

---

## Funcionalidades

- Múltiplas rádios simultâneas (uma por bot Discord)
- Suporte a streams ao vivo (24/7) e playlists do YouTube
- Ciclo automático de playlists (próxima faixa ao terminar, reinicia do início)
- Reconexão automática em caso de queda
- Suporte a cookies para conteúdo restrito por região/idade
- Deploy via Docker (sem configuração de ambiente manual)

---

## Pré-requisitos

- [Node.js](https://nodejs.org/) 20+
- [FFmpeg](https://ffmpeg.org/) instalado no sistema (ou use o Docker)
- Um bot Discord para cada rádio ([Discord Developer Portal](https://discord.com/developers/applications))
- URL de stream do YouTube (live ou playlist)

---

## Configuração

### 1. Clone o repositório

```bash
git clone https://github.com/Code-Level-Community/bot-voice
cd bot-voice
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure o `.env`

Crie um arquivo `.env` na raiz do projeto com base no exemplo abaixo:

```env
# ID do servidor Discord (igual para todas as rádios)
GUILD_ID=SEU_GUILD_ID

# Rádio: Forró
RADIO_FORRO_TOKEN=TOKEN_DO_BOT_FORRO
RADIO_FORRO_VOICE_ID=ID_DO_CANAL_DE_VOZ_FORRO
RADIO_FORRO_URL=https://www.youtube.com/watch?v=EXEMPLO

# Rádio: Rock
RADIO_ROCK_TOKEN=TOKEN_DO_BOT_ROCK
RADIO_ROCK_VOICE_ID=ID_DO_CANAL_DE_VOZ_ROCK
RADIO_ROCK_URL=https://www.youtube.com/watch?v=EXEMPLO

# Rádio: Lofi
RADIO_LOFI_TOKEN=TOKEN_DO_BOT_LOFI
RADIO_LOFI_VOICE_ID=ID_DO_CANAL_DE_VOZ_LOFI
RADIO_LOFI_URL=https://www.youtube.com/watch?v=EXEMPLO

# Opcional: caminho customizado para o yt-dlp e ffmpeg
# YTDLP_PATH=./bin/yt-dlp
# FFMPEG_PATH=ffmpeg

# Caminho para o arquivo de cookies do YouTube (obrigatório)
COOKIES_PATH=./cookies.txt
```

> **Como obter os IDs:** Ative o "Modo Desenvolvedor" nas configurações do Discord, então clique com o botão direito no servidor ou canal para copiar o ID.

### Gerando o `cookies.txt` (obrigatório)

O bot usa cookies do YouTube para conseguir extrair URLs de áudio. Sem esse arquivo o yt-dlp falha na extração.

1. No seu navegador, **faça login no YouTube**
2. Instale a extensão **[Get cookies.txt LOCALLY](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)** (Chrome/Edge)
3. Acesse [youtube.com](https://www.youtube.com), clique na extensão e exporte o arquivo
4. Salve o arquivo como `cookies.txt` na raiz do projeto

> O arquivo de cookies é sensível — nunca suba ele para o repositório. Ele já deve estar no `.gitignore`.

### 4. Permissões necessárias para os bots

Cada bot precisa das seguintes permissões no servidor:
- `Connect` — entrar em canais de voz
- `Speak` — transmitir áudio

E dos seguintes **Privileged Gateway Intents** no Developer Portal:
- `GUILDS`
- `GUILD_VOICE_STATES`

---

## Rodando o projeto

### Desenvolvimento

```bash
npm run dev
```

### Produção (compilado)

```bash
npm run build
node dist/index.js
```

### Via Docker

```bash
docker build -t bot-voice .
docker run --env-file .env bot-voice
```

---

## Adicionando ou removendo rádios

Edite o arquivo `src/config.ts` e adicione um novo objeto no array `radios`:

```ts
{
  name: "Pagode",
  token: process.env.RADIO_PAGODE_TOKEN || '',
  guildId: commonGuildId,
  voiceChannelId: process.env.RADIO_PAGODE_VOICE_ID || '',
  streamUrl: process.env.RADIO_PAGODE_URL || ''
}
```

Depois adicione as variáveis correspondentes no `.env`. Não há limite de rádios.

---

## Estrutura do projeto

```
src/
├── index.ts         # Ponto de entrada — inicializa todas as rádios
├── config.ts        # Lê o .env e exporta a lista de rádios
├── radioManager.ts  # Gerencia o ciclo de vida de cada bot Discord
└── streamPlayer.ts  # Extrai URL via yt-dlp e injeta no FFmpeg
```

---

## Stack

| Tecnologia | Uso |
|---|---|
| [discord.js](https://discord.js.org/) | Cliente Discord |
| [@discordjs/voice](https://github.com/discordjs/voice) | Conexão e player de áudio |
| [yt-dlp](https://github.com/yt-dlp/yt-dlp) | Extração de URL de áudio do YouTube |
| [FFmpeg](https://ffmpeg.org/) | Transcodificação do stream para PCM |
| TypeScript | Tipagem e build |
| Docker | Deploy em produção |

---

## Comunidade

Esse projeto foi feito para a comunidade **CodeLevel** no Discord.

[![Discord](https://img.shields.io/badge/Discord-CodeLevel-5865F2?logo=discord&logoColor=white)](https://discord.gg/QfTphGwsp)

---

## Licença

ISC
