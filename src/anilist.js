// Accès à l'API GraphQL publique d'AniList (aucune clé requise).
const ENDPOINT = 'https://graphql.anilist.co';
const PER_PAGE = 50;

const MEDIA_FIELDS = `
  id
  siteUrl
  title { romaji english native }
  description(asHtml: false)
  season
  seasonYear
  startDate { year month day }
  format
  episodes
  duration
  status
  source
  averageScore
  genres
  bannerImage
  coverImage { extraLarge large color }
  studios(isMain: true) { nodes { name } }
`;

async function query(gql, variables) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query: gql, variables }),
  });
  if (!res.ok) {
    throw new Error(`AniList a répondu ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(`Erreur AniList : ${json.errors.map((e) => e.message).join(', ')}`);
  }
  return json.data;
}

export async function getAnimeById(id) {
  const data = await query(`query ($id: Int) { Media(id: $id, type: ANIME) { ${MEDIA_FIELDS} } }`, { id });
  return data.Media;
}

/**
 * Recherche d'animes par titre (romaji, anglais ou japonais), triés par pertinence.
 * Renvoie des résultats légers, pour l'autocomplétion.
 */
export async function searchAnime(search, { limit = 10 } = {}) {
  const data = await query(
    `query ($search: String, $perPage: Int) {
      Page(page: 1, perPage: $perPage) {
        media(type: ANIME, isAdult: false, search: $search, sort: [SEARCH_MATCH, POPULARITY_DESC]) {
          id
          title { romaji english }
          seasonYear
          startDate { year }
          format
        }
      }
    }`,
    { search, perPage: limit },
  );
  return data.Page.media;
}

/**
 * Tire un anime au hasard parmi les `poolSize` plus populaires,
 * en excluant les contenus adultes et les ids déjà postés.
 */
export async function pickRandomAnime({ excludeIds = new Set(), minScore = 70, poolSize = 1000 } = {}) {
  const pages = Math.max(1, Math.ceil(poolSize / PER_PAGE));
  const tried = new Set();

  for (let attempt = 0; attempt < 8 && tried.size < pages; attempt++) {
    let page;
    do page = 1 + Math.floor(Math.random() * pages);
    while (tried.has(page));
    tried.add(page);

    const data = await query(
      `query ($page: Int, $perPage: Int, $minScore: Int) {
        Page(page: $page, perPage: $perPage) {
          media(type: ANIME, isAdult: false, sort: POPULARITY_DESC,
                averageScore_greater: $minScore,
                format_in: [TV, MOVIE, ONA, OVA, TV_SHORT],
                status_in: [FINISHED, RELEASING]) {
            ${MEDIA_FIELDS}
          }
        }
      }`,
      { page, perPage: PER_PAGE, minScore },
    );

    const candidates = data.Page.media.filter((m) => !excludeIds.has(m.id));
    if (candidates.length) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
  }
  throw new Error('Aucun anime disponible : tous ceux du pool ont déjà été postés. Augmentez POOL_SIZE.');
}
