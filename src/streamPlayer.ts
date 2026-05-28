import { AudioPlayer, AudioPlayerStatus, createAudioResource } from '@discordjs/voice';
import { exec, spawn } from 'child_process';
import ffmpegStatic from 'ffmpeg-static';
import fs from 'fs';
import { promisify } from 'util';
import { type RadioInstance } from './config';

const execAsync = promisify(exec);

const YTDLP_PATH = process.env.YTDLP_PATH || 'yt-dlp';
const FFMPEG_PATH = process.env.FFMPEG_PATH || ffmpegStatic || 'ffmpeg';

export function setupStreamPlayer(player: AudioPlayer, config: RadioInstance) {
  let currentTrackIndex = 1;

  const playStream = async () => {
    let ffmpegProcess: any = null;

    try {
      const isPlaylist = config.streamUrl.includes('playlist') || config.streamUrl.includes('list=');
      console.log(`[${config.name}] Extraindo URL da faixa via YT-DLP...`);

      const cookiesPath = process.env.COOKIES_PATH || './cookies.txt';

      let command = `"${YTDLP_PATH}" "${config.streamUrl}" --format bestaudio/best --get-url --no-warnings --no-check-certificates --remote-components ejs:github`;
      
      if (isPlaylist) {
        command += ` --playlist-items ${currentTrackIndex}`;
      }
      if (fs.existsSync(cookiesPath)) {
        command += ` --cookies "${cookiesPath}"`;
      }

      const { stdout } = await execAsync(command);
      const streamUrlReal = stdout.split('\n')[0].trim();

      if (!streamUrlReal || streamUrlReal.startsWith('Usage:')) {
        if (isPlaylist && currentTrackIndex > 1) {
          console.log(`[${config.name}] Fim da playlist alcançado ou erro na faixa. Reiniciando playlist...`);
          currentTrackIndex = 1;
          setTimeout(playStream, 2000);
          return;
        }
        throw new Error("Manifesto de áudio obtido retornou vazio.");
      }

      console.log(`[${config.name}] Injetando stream de áudio no FFmpeg...`);

      ffmpegProcess = spawn(FFMPEG_PATH, [
        '-reconnect', '1',
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '5',
        '-analyzeduration', '0',
        '-probesize', '32',
        '-i', streamUrlReal,
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        '-vn',
        '-loglevel', 'quiet',
        'pipe:1'
      ], { stdio: ['ignore', 'pipe', 'ignore'] });

      ffmpegProcess.on('error', (err: any) => {
        console.error(`[${config.name}] Erro no spawn do FFmpeg:`, err.message);
      });

      const resource = createAudioResource(ffmpegProcess.stdout, {
        inputType: 'raw' as any
      });

      player.play(resource);

      // Listener descartável para o estado inicial de reprodução
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
      
      setTimeout(playStream, 10000);
    }
  };

  // Retorna a função de controle para ser disparada quando o canal estiver pronto
  return { playStream };
}