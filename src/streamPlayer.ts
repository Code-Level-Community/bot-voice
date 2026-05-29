import { AudioPlayer, AudioPlayerStatus, StreamType, createAudioResource } from '@discordjs/voice';
import { spawn } from 'child_process';
import { Client, EmbedBuilder } from 'discord.js';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'fs';
import { type RadioInstance } from './config';

const YTDLP_PATH = process.env.YTDLP_PATH || 'yt-dlp';
const FFMPEG_PATH = process.env.FFMPEG_PATH || ffmpegStatic || 'ffmpeg';

interface TrackMetadata {
  title: string;
  uploader: string;
  thumbnail: string | null;
  duration: number;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

async function fetchTrackMetadata(streamUrl: string, trackIndex: number, isPlaylist: boolean): Promise<TrackMetadata | null> {
  const args = [
    streamUrl,
    '--dump-json',
    '--skip-download',
    '--no-warnings',
    '--geo-bypass',
  ];
  if (isPlaylist) {
    args.push('--playlist-items', String(trackIndex));
  }

  return new Promise((resolve) => {
    const proc = spawn(YTDLP_PATH, args, { stdio: ['ignore', 'pipe', 'ignore'] });
    let output = '';
    proc.stdout!.on('data', (data: Buffer) => { output += data.toString(); });
    proc.on('close', (code) => {
      if (code !== 0) { resolve(null); return; }
      try {
        const json = JSON.parse(output.trim().split('\n').pop() ?? '{}');
        resolve({
          title: json.title ?? 'Desconhecido',
          uploader: json.uploader ?? json.channel ?? 'Desconhecido',
          thumbnail: json.thumbnail ?? null,
          duration: json.duration ?? 0,
        });
      } catch {
        resolve(null);
      }
    });
    proc.on('error', () => resolve(null));
  });
}

async function sendNowPlayingEmbed(
  client: Client,
  config: RadioInstance,
  metadata: TrackMetadata,
  trackIndex: number,
  lastMessageId: string | null,
): Promise<string | null> {
  try {
    const channel = await client.channels.fetch(config.voiceChannelId);
    if (!channel?.isTextBased() || channel.isDMBased()) return null;

    if (lastMessageId) {
      await channel.messages.delete(lastMessageId).catch(() => {});
    }

    const embed = new EmbedBuilder()
      .setColor(config.color)
      .setAuthor({ name: `Rádio ${config.name}` })
      .setTitle(metadata.title)
      .setDescription(`por **${metadata.uploader}**`)
      .addFields(
        { name: '🎵 Faixa', value: `#${trackIndex}`, inline: true },
        { name: '⏱️ Duração', value: formatDuration(metadata.duration), inline: true },
      )
      .setTimestamp();

    if (metadata.thumbnail) {
      embed.setThumbnail(metadata.thumbnail);
    }

    const msg = await channel.send({ embeds: [embed] });
    return msg.id;
  } catch (err: any) {
    console.error(`[${config.name}] Erro ao enviar embed:`, err.message);
    return null;
  }
}

export function setupStreamPlayer(player: AudioPlayer, config: RadioInstance, client: Client) {
  let currentTrackIndex = 1;
  let consecutiveErrors = 0;
  let lastMessageId: string | null = null;

  const playStream = async () => {
    try {
      const isPlaylist = config.streamUrl.includes('playlist') || config.streamUrl.includes('list=');
      console.log(`[${config.name}] Extraindo URL da faixa via YT-DLP...`);

      const cookiesPath = process.env.COOKIES_PATH || './cookies.txt';

      // Busca metadados em paralelo com o início do stream
      const metadataPromise = fetchTrackMetadata(config.streamUrl, currentTrackIndex, isPlaylist);

      const ytdlpArgs = [
        config.streamUrl,
        '--format', 'bestaudio/best',
        '--no-warnings',
        '--geo-bypass',
        '-o', '-',
      ];

      if (isPlaylist) {
        ytdlpArgs.push('--playlist-items', String(currentTrackIndex));
      }
      if (fs.existsSync(cookiesPath)) {
        ytdlpArgs.push('--cookies', cookiesPath);
      }

      const ytdlpProcess = spawn(YTDLP_PATH, ytdlpArgs, {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let ytdlpStderr = '';
      ytdlpProcess.stderr!.on('data', (data: Buffer) => {
        if (ytdlpStderr.length < 10_000) ytdlpStderr += data.toString();
      });

      ytdlpProcess.on('close', (code: number | null) => {
        if (code !== 0) {
          consecutiveErrors++;
          if (ytdlpStderr) {
            const lastLine = ytdlpStderr.trim().split('\n').pop() ?? '';
            console.error(`[${config.name}] YT-DLP saiu com código ${code}: ${lastLine}`);
          }
          if (isPlaylist && consecutiveErrors >= 5) {
            console.log(`[${config.name}] Fim da playlist detectado. Reiniciando do início...`);
            currentTrackIndex = 1;
            consecutiveErrors = 0;
          }
        } else {
          consecutiveErrors = 0;
        }
      });

      ytdlpProcess.on('error', (err: any) => {
        console.error(`[${config.name}] Erro ao iniciar YT-DLP:`, err.message);
      });

      console.log(`[${config.name}] Injetando stream de áudio no FFmpeg...`);

      const ffmpegProcess = spawn(FFMPEG_PATH, [
        '-i', 'pipe:0',
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        '-vn',
        '-loglevel', 'quiet',
        'pipe:1'
      ], { stdio: ['pipe', 'pipe', 'ignore'] });

      ytdlpProcess.stdout!.pipe(ffmpegProcess.stdin!);

      ffmpegProcess.on('error', (err: any) => {
        console.error(`[${config.name}] Erro no FFmpeg:`, err.message);
      });

      const resource = createAudioResource(ffmpegProcess.stdout!, {
        inputType: StreamType.Raw
      });

      player.play(resource);

      const capturedIndex = currentTrackIndex;

      player.once(AudioPlayerStatus.Playing, async () => {
        console.log(`[${config.name}] 🔊 Transmitindo com sucesso! ${isPlaylist ? `(Música #${capturedIndex})` : '(Live 24/7)'}`);

        const metadata = await metadataPromise;
        if (metadata) {
          lastMessageId = await sendNowPlayingEmbed(client, config, metadata, capturedIndex, lastMessageId);
        }
      });

      if (isPlaylist) {
        currentTrackIndex++;
      }

    } catch (err: any) {
      console.error(`[${config.name}] Falha no ciclo do stream:`, err.message || err);

      if (config.streamUrl.includes('list=')) {
        currentTrackIndex++;
      }

      setTimeout(playStream, 1000);
    }
  };

  return { playStream };
}
