import { MessageFlags, PermissionFlagsBits, SlashCommandBuilder, ThreadAutoArchiveDuration } from 'discord.js';
import { getAnimeById, pickRandomAnime, searchAnime } from './anilist.js';
import { CHOICES } from './db.js';
import {
  autocompleteLabel,
  buildAnimeEmbed,
  buildRecapEmbed,
  buildThreadStarter,
  buildVoteConfirmation,
  buildVoteRows,
  displayTitle,
  formatDayHeader,
  threadName,
} from './messages.js';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const commands = [
  new SlashCommandBuilder()
    .setName('anime')
    .setDescription('Administration du bot Anime du Jour')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sc) =>
      sc
        .setName('poster')
        .setDescription("Poster l'anime du jour maintenant")
        .addStringOption((o) =>
          o.setName('titre').setDescription('Choisir un anime par son titre').setAutocomplete(true).setMaxLength(100),
        )
        .addIntegerOption((o) => o.setName('anilist_id').setDescription('Choisir un anime par son id AniList')),
    )
    .addSubcommand((sc) => sc.setName('recap').setDescription('Poster le récap des 7 derniers jours maintenant')),
  new SlashCommandBuilder().setName('watchlist').setDescription('Les animes que tu as marqués « Ça me tente »'),
].map((c) => c.toJSON());

export function createBot({ client, db, config }) {
  async function getChannel() {
    const channel = await client.channels.fetch(config.channelId);
    if (!channel?.isTextBased()) throw new Error(`Le salon ${config.channelId} est introuvable ou n'est pas textuel.`);
    return channel;
  }

  async function postDailyAnime({ anilistId } = {}) {
    const media = anilistId
      ? await getAnimeById(anilistId)
      : await pickRandomAnime({ excludeIds: db.postedAnilistIds(), minScore: config.minScore, poolSize: config.poolSize });
    const title = displayTitle(media);
    const postId = db.createPost({ anilistId: media.id, title, color: media.coverImage?.color, siteUrl: media.siteUrl });

    try {
      const channel = await getChannel();
      const message = await channel.send({
        content: formatDayHeader(new Date(), postId, config.timezone),
        embeds: [buildAnimeEmbed(media, postId)],
        components: buildVoteRows(postId, db.counts(postId), media.siteUrl),
      });

      let threadId = null;
      try {
        const thread = await message.startThread({ name: threadName(title), autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek });
        await thread.send(buildThreadStarter(title));
        threadId = thread.id;
      } catch (err) {
        console.error('[thread] Impossible de créer le fil :', err.message);
      }

      db.attachMessage(postId, { channelId: channel.id, messageId: message.id, threadId });
      console.log(`[post] #${postId} ${title} (AniList ${media.id})`);
      return { postId, title };
    } catch (err) {
      db.deletePost(postId);
      throw err;
    }
  }

  async function refreshButtons(post) {
    const channel = await client.channels.fetch(post.channel_id);
    const message = await channel.messages.fetch(post.message_id);
    await message.edit({ components: buildVoteRows(post.id, db.counts(post.id), post.site_url) });
  }

  async function postWeeklyRecap() {
    const to = new Date();
    const from = new Date(to.getTime() - WEEK_MS);
    const posts = db.postsSince(from.getTime());
    if (!posts.length) {
      console.log('[recap] Aucun post cette semaine, récap ignoré.');
      return false;
    }

    const entries = [];
    for (const post of posts) {
      let threadMessages = 0;
      if (post.thread_id) {
        try {
          const thread = await client.channels.fetch(post.thread_id);
          // messageCount inclut le message d'ouverture du bot
          threadMessages = Math.max(0, (thread?.messageCount ?? 0) - 1);
        } catch {
          /* fil supprimé */
        }
      }
      entries.push({ post, counts: db.counts(post.id), threadMessages });
    }

    const channel = await getChannel();
    await channel.send({
      embeds: [
        buildRecapEmbed(entries, {
          from,
          to,
          voters: db.votersSince(from.getTime()),
          timeZone: config.timezone,
          guildId: config.guildId,
        }),
      ],
    });
    console.log(`[recap] ${posts.length} anime(s) récapitulé(s).`);
    return true;
  }

  async function handleVote(interaction, postId, choice) {
    const post = db.getPost(postId);
    if (!post || !CHOICES.includes(choice)) {
      await interaction.reply({ content: "Ce vote n'est plus disponible.", flags: MessageFlags.Ephemeral });
      return;
    }
    db.setVote(postId, interaction.user.id, choice);
    // Met à jour les compteurs sur le message, puis confirme en privé
    await interaction.update({ components: buildVoteRows(postId, db.counts(postId), post.site_url) });
    await interaction.followUp({ ...buildVoteConfirmation(postId, choice, post.title), flags: MessageFlags.Ephemeral });
  }

  async function handleUnvote(interaction, postId) {
    const post = db.getPost(postId);
    const removed = post ? db.removeVote(postId, interaction.user.id) : false;
    await interaction.update({
      content: removed ? `↩️ Vote annulé pour *${post.title}*.` : "Tu n'avais pas de vote sur cet anime.",
      components: [],
    });
    if (removed) await refreshButtons(post);
  }

  async function handleCommand(interaction) {
    if (interaction.commandName === 'watchlist') {
      const items = db.watchlist(interaction.user.id);
      const content = items.length
        ? `🔖 **Ta watchlist** (${items.length})\n` +
          items.map((p) => `• [${p.title}](<${p.site_url}>) · anime du jour #${p.id}`).join('\n')
        : 'Ta watchlist est vide. Clique sur **🔖 Ça me tente** sous un anime du jour pour l\'y ajouter.';
      await interaction.reply({ content, flags: MessageFlags.Ephemeral });
      return;
    }

    if (interaction.commandName === 'anime') {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const sub = interaction.options.getSubcommand();
      if (sub === 'poster') {
        const anilistId = await resolveAnimeOption(
          interaction.options.getString('titre'),
          interaction.options.getInteger('anilist_id'),
        );
        const { postId, title } = await postDailyAnime({ anilistId });
        await interaction.editReply(`✅ Posté : **${title}** (#${postId}) dans <#${config.channelId}>.`);
      } else if (sub === 'recap') {
        const posted = await postWeeklyRecap();
        await interaction.editReply(posted ? '✅ Récap posté.' : "Aucun anime posté ces 7 derniers jours, pas de récap.");
      }
    }
  }

  // Valeur de l'option « titre » : un id (choisi dans l'autocomplétion) ou un texte libre
  async function resolveAnimeOption(titre, anilistId) {
    if (anilistId) return anilistId;
    if (!titre) return undefined;
    if (/^\d+$/.test(titre)) return Number(titre);
    const [first] = await searchAnime(titre, { limit: 1 });
    if (!first) throw new Error(`Aucun anime trouvé sur AniList pour « ${titre} ».`);
    return first.id;
  }

  async function handleAutocomplete(interaction) {
    const typed = interaction.options.getFocused().trim();
    if (typed.length < 2) return interaction.respond([]);
    let results = [];
    try {
      results = await searchAnime(typed, { limit: 10 });
    } catch (err) {
      console.error('[autocomplete]', err.message);
    }
    const posted = db.postedAnilistIds();
    await interaction.respond(results.map((m) => ({ name: autocompleteLabel(m, posted.has(m.id)), value: String(m.id) })));
  }

  async function handleInteraction(interaction) {
    try {
      if (interaction.isAutocomplete()) return await handleAutocomplete(interaction);
      if (interaction.isChatInputCommand()) return await handleCommand(interaction);
      if (!interaction.isButton()) return;
      const [kind, rawId, choice] = interaction.customId.split(':');
      const postId = Number(rawId);
      if (kind === 'vote') return await handleVote(interaction, postId, choice);
      if (kind === 'unvote') return await handleUnvote(interaction, postId);
    } catch (err) {
      console.error('[interaction]', err);
      const payload = { content: `❌ Une erreur est survenue : ${err.message}`, flags: MessageFlags.Ephemeral };
      try {
        if (interaction.deferred && !interaction.replied) await interaction.editReply(payload.content);
        else if (interaction.replied || interaction.deferred) await interaction.followUp(payload);
        else await interaction.reply(payload);
      } catch {
        /* interaction expirée */
      }
    }
  }

  return { postDailyAnime, postWeeklyRecap, handleInteraction };
}
