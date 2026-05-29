import { AudioPlayer, AudioPlayerStatus, StreamType, createAudioResource } from '@discordjs/voice';
import { spawn } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'fs';
import { type RadioInstance } from './config';

const YTDLP_PATH = process.env.YTDLP_PATH || 'yt-dlp';
const FFMPEG_PATH = process.env.FFMPEG_PATH || ffmpegStatic || 'ffmpeg';

export function setupStreamPlayer(player: AudioPlayer, config: RadioInstance) {
  let currentTrackIndex = 1;
  let consecutiveErrors = 0;

  const playStream = async () => {
    try {
      const isPlaylist = config.streamUrl.includes('playlist') || config.streamUrl.includes('list=');
      console.log(`[${config.name}] Extraindo URL da faixa via YT-DLP...`);

      const cookiesPath = process.env.COOKIES_PATH || './cookies.txt';

      const ytdlpArgs = [
        config.streamUrl,
        '--format', 'bestaudio/best',
        '--no-warnings',
        '--no-check-certificates',
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
        ytdlpStderr += data.toString();
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

      player.once(AudioPlayerStatus.Playing, () => {
        console.log(`[${config.name}] 🔊 Transmitindo com sucesso! ${isPlaylist ? `(Música #${currentTrackIndex})` : '(Live 24/7)'}`);
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