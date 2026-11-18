import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openDb } from '../src/db.js';
import {
  bar,
  buildAnimeEmbed,
  buildRecapEmbed,
  buildThreadStarter,
  buildVoteRows,
  cleanSynopsis,
  formatDayHeader,
  formatFormat,
  likeRatio,
  threadName,
} from '../src/messages.js';

const frieren = {
  id: 154587,
  siteUrl: 'https://anilist.co/anime/154587',
  title: { romaji: 'Sousou no Frieren', english: "Frieren: Beyond Journey's End", native: '葬送のフリーレン' },
  description:
    'The adventure is over but life goes on for an elf mage just beginning to learn what living is all about.<br><br>(Source: Crunchyroll)<br><br><i>Notes: Includes the extended first episode.</i>',
  season: 'FALL',
  seasonYear: 2023,
  startDate: { year: 2023, month: 9, day: 29 },
  format: 'TV',
  episodes: 28,
  duration: 24,
  status: 'FINISHED',
  source: 'MANGA',
  averageScore: 91,
  genres: ['Adventure', 'Drama', 'Fantasy'],
  bannerImage: 'https://example.org/banner.jpg',
  coverImage: { extraLarge: 'https://example.org/xl.jpg', large: 'https://example.org/l.jpg', color: '#6f9fbf' },
  studios: { nodes: [{ name: 'Madhouse' }] },
};

test('la fiche reprend les infos du design A', () => {
  const e = buildAnimeEmbed(frieren, 142).toJSON();
  assert.equal(e.title, "Frieren: Beyond Journey's End");
  assert.equal(e.author.name, 'Anime du jour #142');
  assert.equal(e.color, 0x6f9fbf);
  assert.equal(e.image.url, 'https://example.org/banner.jpg');
  assert.match(e.description, /葬送のフリーレン · Sousou no Frieren/);
  assert.doesNotMatch(e.description, /Source:|Notes:|<br>/);
  const f = Object.fromEntries(e.fields.map((x) => [x.name, x.value]));
  assert.equal(f['📅 Diffusion'], 'Automne 2023');
  assert.equal(f['🎬 Studio'], 'Madhouse');
  assert.equal(f['📺 Format'], 'TV · 28 ép. · 24 min');
  assert.equal(f['⭐ Note AniList'], '91 / 100');
  assert.equal(f['📖 Source'], 'Manga');
  assert.equal(f['✅ Statut'], 'Terminé');
  assert.equal(f['🏷️ Genres'], 'Aventure · Drame · Fantasy');
});

test('sans bannière, la couverture sert d’image', () => {
  const e = buildAnimeEmbed({ ...frieren, bannerImage: null, coverImage: { extraLarge: 'https://example.org/x.jpg', color: null } }, 1).toJSON();
  assert.equal(e.image.url, 'https://example.org/x.jpg');
  assert.equal(e.thumbnail, undefined);
  assert.equal(e.color, 0xc2306b);
});

test('format film', () => {
  assert.equal(formatFormat({ format: 'MOVIE', episodes: 1, duration: 106 }), 'Film · 106 min');
});

test('synopsis tronqué proprement', () => {
  const long = 'Phrase un assez longue pour remplir. '.repeat(20);
  const out = cleanSynopsis(long, 120);
  assert.ok(out.length <= 121);
  assert.ok(out.endsWith('.') || out.endsWith('…'));
});

test('en-tête du jour en français', () => {
  const h = formatDayHeader(new Date('2026-11-18T09:00:00Z'), 142, 'Europe/Paris');
  assert.equal(h, "🌸 **L'anime du jour** · mercredi 18 novembre · #142");
});

test('boutons : 2 + 3 (dont lien AniList) avec compteurs', () => {
  const rows = buildVoteRows(7, { liked: 14, disliked: 2, want: 9, skip: 1 }, 'https://anilist.co/anime/1').map((r) => r.toJSON());
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0].components.map((c) => c.custom_id), ['vote:7:liked', 'vote:7:disliked']);
  assert.equal(rows[0].components[0].label, 'Vu, aimé · 14');
  assert.equal(rows[1].components.length, 3);
  assert.equal(rows[1].components[2].url, 'https://anilist.co/anime/1');
});

test('nom de fil limité à 100 caractères', () => {
  assert.ok(threadName('x'.repeat(200)).length <= 100);
  assert.match(buildThreadStarter('Frieren', () => 0), /Frieren[\s\S]*personnage[\s\S]*Spoilers/);
});

test('votes : un seul par membre, modifiable et annulable', () => {
  const db = openDb(':memory:');
  const id = db.createPost({ anilistId: 1, title: 'Test' });
  db.setVote(id, 'u1', 'liked');
  db.setVote(id, 'u2', 'want');
  db.setVote(id, 'u1', 'disliked');
  assert.deepEqual(db.counts(id), { liked: 0, disliked: 1, want: 1, skip: 0 });
  assert.equal(db.removeVote(id, 'u1'), true);
  assert.equal(db.removeVote(id, 'u1'), false);
  assert.deepEqual(db.counts(id), { liked: 0, disliked: 0, want: 1, skip: 0 });
  assert.deepEqual(db.watchlist('u2').map((p) => p.title), ['Test']);
  assert.ok(db.postedAnilistIds().has(1));
});

test('récap : % aimé parmi ceux qui ont vu', () => {
  assert.equal(likeRatio({ liked: 3, disliked: 1 }), 0.75);
  assert.equal(likeRatio({ liked: 0, disliked: 0 }), null);
  assert.equal(bar(0.88), '█████████░');
  const e = buildRecapEmbed(
    [
      { post: { id: 1, title: 'Frieren', channel_id: 'c', message_id: 'm' }, counts: { liked: 7, disliked: 1, want: 9, skip: 0 }, threadMessages: 23 },
      { post: { id: 2, title: 'Cowboy Bebop', channel_id: 'c', message_id: 'n' }, counts: { liked: 19, disliked: 1, want: 2, skip: 0 }, threadMessages: 41 },
    ],
    { from: new Date('2026-11-09T12:00:00Z'), to: new Date('2026-11-15T12:00:00Z'), voters: 47, timeZone: 'Europe/Paris', guildId: 'g' },
  ).toJSON();
  assert.equal(e.title, '🏆 Récap de la semaine · 9 novembre → 15 novembre');
  assert.match(e.description, /88 %.*Frieren/);
  assert.match(e.description, /discord\.com\/channels\/g\/c\/m/);
  assert.deepEqual(e.fields.map((f) => f.value), ['Frieren · 9 envies', 'Cowboy Bebop · 41 msg']);
});
