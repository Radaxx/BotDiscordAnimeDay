// Traductions FR des valeurs renvoyées par AniList.

export const GENRES = {
  Action: 'Action',
  Adventure: 'Aventure',
  Comedy: 'Comédie',
  Drama: 'Drame',
  Ecchi: 'Ecchi',
  Fantasy: 'Fantasy',
  Horror: 'Horreur',
  'Mahou Shoujo': 'Magical girl',
  Mecha: 'Mecha',
  Music: 'Musique',
  Mystery: 'Mystère',
  Psychological: 'Psychologique',
  Romance: 'Romance',
  'Sci-Fi': 'Science-fiction',
  'Slice of Life': 'Tranche de vie',
  Sports: 'Sport',
  Supernatural: 'Surnaturel',
  Thriller: 'Thriller',
};

export const SEASONS = {
  WINTER: 'Hiver',
  SPRING: 'Printemps',
  SUMMER: 'Été',
  FALL: 'Automne',
};

export const FORMATS = {
  TV: 'TV',
  TV_SHORT: 'TV (court)',
  MOVIE: 'Film',
  SPECIAL: 'Spécial',
  OVA: 'OVA',
  ONA: 'ONA',
  MUSIC: 'Clip',
};

export const STATUSES = {
  FINISHED: 'Terminé',
  RELEASING: 'En cours',
  NOT_YET_RELEASED: 'À venir',
  CANCELLED: 'Annulé',
  HIATUS: 'En pause',
};

export const SOURCES = {
  ORIGINAL: 'Original',
  MANGA: 'Manga',
  LIGHT_NOVEL: 'Light novel',
  VISUAL_NOVEL: 'Visual novel',
  VIDEO_GAME: 'Jeu vidéo',
  NOVEL: 'Roman',
  WEB_NOVEL: 'Web novel',
  WEB_MANGA: 'Webtoon',
  ONE_SHOT: 'One-shot',
  OTHER: 'Autre',
};

export const tr = (table, key, fallback = '—') => (key == null ? fallback : table[key] ?? key);
