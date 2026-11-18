import { Client, Events, GatewayIntentBits, REST, Routes } from 'discord.js';
import cron from 'node-cron';
import { commands, createBot } from './bot.js';
import { config } from './config.js';
import { openDb } from './db.js';

const db = openDb(config.dbPath);
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const bot = createBot({ client, db, config });

client.once(Events.ClientReady, async (c) => {
  console.log(`Connecté en tant que ${c.user.tag}`);

  const rest = new REST().setToken(config.token);
  await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: commands });
  console.log('Commandes slash enregistrées.');

  cron.schedule(
    config.dailyCron,
    () => bot.postDailyAnime().catch((err) => console.error('[post] Échec :', err)),
    { timezone: config.timezone },
  );
  cron.schedule(
    config.recapCron,
    () => bot.postWeeklyRecap().catch((err) => console.error('[recap] Échec :', err)),
    { timezone: config.timezone },
  );
  console.log(`Anime du jour : « ${config.dailyCron} », récap : « ${config.recapCron} » (${config.timezone}).`);
});

client.on(Events.InteractionCreate, (interaction) => bot.handleInteraction(interaction));

// Arrêt propre (redéploiement Railway, Ctrl+C) : on ferme Discord et la base
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, async () => {
    console.log(`${signal} reçu, arrêt du bot.`);
    await client.destroy();
    db.raw.close();
    process.exit(0);
  });
}

client.login(config.token);
