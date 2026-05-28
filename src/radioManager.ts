process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
});

import {
    AudioPlayerStatus,
    createAudioPlayer,
    entersState,
    joinVoiceChannel,
    NoSubscriberBehavior,
    VoiceConnectionStatus
} from '@discordjs/voice';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { type RadioInstance } from './config';
import { setupStreamPlayer } from './streamPlayer';

export async function startRadio(config: RadioInstance) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates
    ]
  });

  client.once(Events.ClientReady, async (readyClient) => {
    console.log(`[${config.name}] Autenticado com sucesso como: ${readyClient.user.tag}`);
    
    setTimeout(() => {
      connectAndPlay(readyClient, config);
    }, 3000);
  });

  try {
    await client.login(config.token);
  } catch (error) {
    console.error(`[${config.name}] Erro fatal ao logar com o token fornecido:`, error);
  }
}

async function connectAndPlay(client: Client, config: RadioInstance) {
  try {
    const guild = client.guilds.cache.get(config.guildId);
    
    if (!guild) {
      console.error(`[${config.name}] ERRO: Servidor (${config.guildId}) não encontrado na cache.`);
      return;
    }

    const voiceAdapterCreator = guild.voiceAdapterCreator;
    if (!voiceAdapterCreator) {
      console.error(`[${config.name}] ERRO: Não foi possível obter o voiceAdapterCreator.`);
      return;
    }

    console.log(`[${config.name}] Tentando conectar ao canal de voz: ${config.voiceChannelId}...`);

    const connection = joinVoiceChannel({
      channelId: config.voiceChannelId,
      guildId: config.guildId,
      adapterCreator: voiceAdapterCreator as any,
      selfDeaf: true,
      selfMute: false,
      group: client.user?.id
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
      console.log(`[${config.name}] ✅ Conexão de voz pronta!`);
    } catch {
      console.error(`[${config.name}] ❌ Timeout ao conectar ao canal de voz.`);
      connection.destroy();
      return;
    }

    const player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Play
      }
    });

    connection.subscribe(player);

    // Inicializa o player injetando o player do Voice
    const { playStream } = setupStreamPlayer(player, config);
    await playStream();

    // Eventos contínuos do player de áudio
    player.on(AudioPlayerStatus.Idle, () => {
      console.log(`[${config.name}] Faixa finalizada ou buffer encerrado. Próxima chamada em 3 segundos...`);
      setTimeout(() => {
        playStream();
      }, 3000);
    });

    player.on('error', (error) => {
      console.error(`[${config.name}] Erro no player de áudio: ${error.message}`);
      playStream();
    });

    // Monitoramento da conexão física do canal
    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      console.warn(`[${config.name}] Perdeu a conexão com a sala. Reconectando...`);
      setTimeout(() => connectAndPlay(client, config), 5000);
    });

    connection.on(VoiceConnectionStatus.Ready, () => {
      console.log(`[${config.name}] ✅ Conexão de voz pronta!`);
    });

    connection.on(VoiceConnectionStatus.Connecting, () => {
      console.log(`[${config.name}] 🔄 Conectando ao canal de voz...`);
    });

    connection.on(VoiceConnectionStatus.Destroyed, () => {
      console.log(`[${config.name}] ❌ Conexão destruída!`);
    });

    connection.on('error', (error) => {
      console.error(`[${config.name}] Erro na conexão de voz: ${error.message}`);
      setTimeout(() => connectAndPlay(client, config), 5000);
    });

    player.on('stateChange', (oldState, newState) => {
      console.log(`[${config.name}] Player: ${oldState.status} -> ${newState.status}`);
    });

  } catch (error) {
    console.error(`[${config.name}] Falha crítica na conexão de voz:`, error);
    setTimeout(() => connectAndPlay(client, config), 15000);
  }
}