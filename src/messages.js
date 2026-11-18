// Construction des messages du bot (design A : « la fiche complète »).
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { FORMATS, GENRES, SEASONS, SOURCES, STATUSES, tr } from './i18n.js';

export const CHOICE_META = {
  liked: { emoji: '❤️', label: 'Vu, aimé', style: ButtonStyle.Success },
  disliked: { emoji: '👎', label: 'Vu, pas aimé', style: ButtonStyle.Danger },
  want: { emoji: '🔖', label: 'Ça me tente', style: ButtonStyle.Primary },
  skip: { emoji: '🚫', label: 'Pas pour moi', style: ButtonStyle.Secondary },
};

const DEFAULT_COLOR = 0xc2306b;
const SYNOPSIS_MAX = 350;

export function displayTitle(media) {
  return media.title.english || media.title.romaji || media.title.native;
}

export function cleanSynopsis(raw, max = SYNOPSIS_MAX) {
  if (!raw) return null;
  let text = raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\(Source:[^)]*\)/gi, '')
    .replace(/\n\s*Notes?:[\s\S]*$/i, '')
    .replace(/\n{2,}/g, '\n')
    .trim();
  // Garder le premier paragraphe s'il est suffisant
  const first = text.split('\n')[0].trim();
  if (first.length >= 120) text = first;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return lastStop > max * 0.5 ? cut.slice(0, lastStop + 1) : `${cut.replace(/\s+\S*$/, '')}…`;
}

export function formatAiring(media) {
  if (media.season && media.seasonYear) return `${tr(SEASONS, media.season)} ${media.seasonYear}`;
  return String(media.seasonYear ?? media.startDate?.year ?? '—');
}

export function formatFormat(media) {
  const parts = [tr(FORMATS, media.format)];
  if (media.format === 'MOVIE') {
    if (media.duration) parts.push(`${media.duration} min`);
  } else {
    if (media.episodes) parts.push(`${media.episodes} ép.`);
    if (media.duration) parts.push(`${media.duration} min`);
  }
  return parts.join(' · ');
}

export function parseColor(hex) {
  if (!hex || !/^#?[0-9a-f]{6}$/i.test(hex)) return DEFAULT_COLOR;
  return parseInt(hex.replace('#', ''), 16);
}

export function formatDayHeader(date, number, timeZone) {
  const day = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone }).format(date);
  return `🌸 **L'anime du jour** · ${day} · #${number}`;
}

export function buildAnimeEmbed(media, number) {
  const title = displayTitle(media);
  const subtitle = [media.title.native, media.title.romaji !== title ? media.title.romaji : null]
    .filter(Boolean)
    .join(' · ');
  const synopsis = cleanSynopsis(media.description);
  const studio = media.studios?.nodes?.[0]?.name ?? '—';
  const genres = media.genres?.length ? media.genres.map((g) => tr(GENRES, g)).join(' · ') : '—';

  const embed = new EmbedBuilder()
    .setColor(parseColor(media.coverImage?.color))
    .setAuthor({ name: `Anime du jour #${number}` })
    .setTitle(title)
    .setURL(media.siteUrl)
    .setDescription([subtitle && `*${subtitle}*`, synopsis].filter(Boolean).join('\n\n') || null)
    .addFields(
      { name: '📅 Diffusion', value: formatAiring(media), inline: true },
      { name: '🎬 Studio', value: studio, inline: true },
      { name: '📺 Format', value: formatFormat(media), inline: true },
      { name: '⭐ Note AniList', value: media.averageScore ? `${media.averageScore} / 100` : '—', inline: true },
      { name: '📖 Source', value: tr(SOURCES, media.source), inline: true },
      { name: '✅ Statut', value: tr(STATUSES, media.status), inline: true },
      { name: '🏷️ Genres', value: genres, inline: false },
    )
    .setFooter({ text: 'Source : AniList · Votez ci-dessous, discutez dans le fil 🧵' });

  const image = media.bannerImage || media.coverImage?.extraLarge || media.coverImage?.large;
  if (image) embed.setImage(image);
  if (media.bannerImage && (media.coverImage?.large || media.coverImage?.extraLarge)) {
    embed.setThumbnail(media.coverImage.large || media.coverImage.extraLarge);
  }
  return embed;
}

function voteButton(postId, choice, count) {
  const meta = CHOICE_META[choice];
  return new ButtonBuilder()
    .setCustomId(`vote:${postId}:${choice}`)
    .setStyle(meta.style)
    .setEmoji(meta.emoji)
    .setLabel(`${meta.label} · ${count}`);
}

export function buildVoteRows(postId, counts, siteUrl) {
  const row1 = new ActionRowBuilder().addComponents(
    voteButton(postId, 'liked', counts.liked),
    voteButton(postId, 'disliked', counts.disliked),
  );
  const row2 = new ActionRowBuilder().addComponents(
    voteButton(postId, 'want', counts.want),
    voteButton(postId, 'skip', counts.skip),
  );
  if (siteUrl) {
    row2.addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(siteUrl).setEmoji('🔗').setLabel('AniList'));
  }
  return [row1, row2];
}

export function threadName(title) {
  const name = `💬 ${title} — discussion`;
  return name.length > 100 ? `${name.slice(0, 99)}…` : name;
}

const OPENERS = [
  'Quel personnage vous a le plus marqué, et pourquoi ?',
  'Votre scène préférée ? (sous spoiler !)',
  "Si vous deviez le conseiller à quelqu'un en une phrase, vous diriez quoi ?",
  "L'opening ou l'ending : lequel vous reste en tête ?",
  'Un anime à regarder ensuite si on a aimé celui-ci ?',
  "Qu'est-ce qui vous a accroché (ou fait décrocher) ?",
];

export function buildThreadStarter(title, random = Math.random) {
  const opener = OPENERS[Math.floor(random() * OPENERS.length)];
  return [
    `Fil de discussion pour **${title}** 🌸`,
    `Pour lancer : ${opener}`,
    '-# ⚠️ Spoilers entre `||barres||`, merci pour ceux qui ne l\'ont pas encore vu.',
  ].join('\n');
}

export function buildVoteConfirmation(postId, choice, title) {
  const meta = CHOICE_META[choice];
  return {
    content: `✅ Vote enregistré : **${meta.emoji} ${meta.label}** pour *${title}*. Tu peux changer d'avis quand tu veux.`,
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`unvote:${postId}`).setStyle(ButtonStyle.Secondary).setEmoji('↩️').setLabel('Annuler mon vote'),
      ),
    ],
  };
}

export function likeRatio(counts) {
  const seen = counts.liked + counts.disliked;
  return seen ? counts.liked / seen : null;
}

export function bar(ratio, width = 10) {
  const filled = Math.round(ratio * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

/**
 * entries : [{ post, counts, threadMessages }]
 */
export function buildRecapEmbed(entries, { from, to, voters, timeZone, guildId }) {
  const fmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone });
  const lines = entries.map(({ post, counts }) => {
    const r = likeRatio(counts);
    const pct = r == null ? '  — ' : `${String(Math.round(r * 100)).padStart(3)} %`;
    const link = post.message_id
      ? `[${post.title}](https://discord.com/channels/${guildId}/${post.channel_id}/${post.message_id})`
      : post.title;
    return `\`${bar(r ?? 0)} ${pct}\` ${link}`;
  });

  const mostWanted = [...entries].sort((a, b) => b.counts.want - a.counts.want)[0];
  const mostDiscussed = [...entries].sort((a, b) => (b.threadMessages ?? 0) - (a.threadMessages ?? 0))[0];

  const embed = new EmbedBuilder()
    .setColor(0xff6fa5)
    .setTitle(`🏆 Récap de la semaine · ${fmt.format(from)} → ${fmt.format(to)}`)
    .setDescription(lines.join('\n') || 'Aucun anime posté cette semaine.')
    .setFooter({ text: `% = part de « aimé » parmi ceux qui l'ont vu · ${voters} votant${voters > 1 ? 's' : ''} cette semaine` });

  if (mostWanted?.counts.want) {
    embed.addFields({ name: '🔖 Le plus attendu', value: `${mostWanted.post.title} · ${mostWanted.counts.want} envie${mostWanted.counts.want > 1 ? 's' : ''}`, inline: true });
  }
  if (mostDiscussed?.threadMessages) {
    embed.addFields({ name: '💬 Le plus discuté', value: `${mostDiscussed.post.title} · ${mostDiscussed.threadMessages} msg`, inline: true });
  }
  return embed;
}

// Libellé d'une suggestion d'autocomplétion (100 caractères max côté Discord)
export function autocompleteLabel(media, alreadyPosted = false) {
  const year = media.seasonYear ?? media.startDate?.year;
  const meta = [year, media.format ? tr(FORMATS, media.format) : null].filter(Boolean).join(', ');
  const suffix = `${meta ? ` (${meta})` : ''}${alreadyPosted ? ' · déjà posté' : ''}`;
  const title = displayTitle(media);
  const max = 100 - suffix.length;
  return (title.length > max ? `${title.slice(0, max - 1)}…` : title) + suffix;
}
