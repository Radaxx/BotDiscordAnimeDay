import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variable d'environnement manquante : ${name} (voir .env.example)`);
  }
  return value;
}

export const config = {
  token: required('DISCORD_TOKEN'),
  clientId: required('DISCORD_CLIENT_ID'),
  guildId: required('DISCORD_GUILD_ID'),
  channelId: required('DISCORD_CHANNEL_ID'),
  timezone: process.env.TIMEZONE || 'Europe/Paris',
  // Format cron : minute heure jour mois jour-de-semaine
  dailyCron: process.env.DAILY_CRON || '0 10 * * *',
  recapCron: process.env.RECAP_CRON || '0 20 * * 0',
  dbPath: process.env.DB_PATH || './data/anime-du-jour.db',
  // Seuils pour le tirage AniList
  minScore: Number(process.env.MIN_SCORE || 70),
  poolSize: Number(process.env.POOL_SIZE || 1000),
};
