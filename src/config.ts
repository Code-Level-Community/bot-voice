import dotenv from 'dotenv';

dotenv.config();

export interface RadioInstance {
  name: string;
  token: string;
  voiceChannelId: string;
  guildId: string;
  streamUrl: string;
}

const commonGuildId = process.env.GUILD_ID || '';

export const radios: RadioInstance[] = [
  {
    name: "Forró",
    token: process.env.RADIO_FORRO_TOKEN || '',
    guildId: commonGuildId,
    voiceChannelId: process.env.RADIO_FORRO_VOICE_ID || '',
    streamUrl: process.env.RADIO_FORRO_URL || ''
  },
  {
    name: "Rock",
    token: process.env.RADIO_ROCK_TOKEN || '',
    guildId: commonGuildId,
    voiceChannelId: process.env.RADIO_ROCK_VOICE_ID || '',
    streamUrl: process.env.RADIO_ROCK_URL || ''
  },
  {
    name: "Lofi",
    token: process.env.RADIO_LOFI_TOKEN || '',
    guildId: commonGuildId,
    voiceChannelId: process.env.RADIO_LOFI_VOICE_ID || '',
    streamUrl: process.env.RADIO_LOFI_URL || ''
  }
];

radios.forEach(radio => {
  if (!radio.token || !radio.voiceChannelId || !radio.streamUrl || !radio.guildId) {
    console.warn(`[Configuração] ⚠️ Alerta: A rádio "${radio.name}" possui variáveis de ambiente faltando no seu .env!`);
  }
});