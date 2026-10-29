// HOW TO EDIT THIS FILE
// - BUCKETS is the list of broad genres, in rough global popularity order (used to fill slots).
// - RULES maps raw Spotify genres / Last.fm tags to a bucket. Keywords are written in
//   NORMALIZED form: lowercase, no punctuation ("hip hop", "r and b", "k pop", "lo fi").
// - A keyword matches on word boundaries, so 'rap' matches "pop rap" but not "trapeze".
// - 'unless' keywords stop that rule from matching a genre (e.g. Pop ignores "k pop").
// - A genre can match several buckets ("indie pop" -> Indie / Alternative and Pop).
// - Anything that matches nothing ends up in Misc.
// - JUNK_TAGS are Last.fm tags we ignore entirely.

export const MISC = 'Misc'

export const BUCKETS: readonly string[] = [
  'Pop',
  'Hip-Hop',
  'R&B',
  'Rock',
  'Indie / Alternative',
  'Electronic',
  'Latin',
  'Country',
  'K-Pop',
  'Metal',
  'Reggae / Afrobeats',
  'Folk / Acoustic',
  'Jazz',
  'Soundtrack',
  'Classical',
]

export const RULES: { bucket: string; match: string[]; unless?: string[] }[] = [
  {
    bucket: 'Pop',
    match: [
      'pop', 'dance pop', 'electropop', 'synthpop', 'synth pop', 'teen pop', 'art pop',
      'dream pop', 'indie pop', 'bedroom pop', 'pop rock', 'pop punk', 'pop rap', 'j pop',
      'jpop', 'c pop', 'cpop', 'mandopop', 'cantopop', 'europop', 'hyperpop', 'power pop',
      'latin pop', 'pop soul', 'bubblegum', 'singer songwriter pop',
    ],
    unless: ['k pop', 'kpop'],
  },
  {
    bucket: 'Hip-Hop',
    match: [
      'hip hop', 'hiphop', 'rap', 'trap', 'drill', 'uk drill', 'grime', 'boom bap', 'phonk',
      'gangster rap', 'conscious hip hop', 'cloud rap', 'emo rap', 'mumble rap', 'crunk',
      'southern hip hop', 'east coast hip hop', 'west coast hip hop', 'atl hip hop',
      'rap rock', 'g funk', 'underground hip hop', 'old school hip hop', 'pop rap',
    ],
  },
  {
    bucket: 'R&B',
    match: [
      'r and b', 'rnb', 'rhythm and blues', 'neo soul', 'soul', 'contemporary r and b', 'alternative r and b',
      'urban contemporary', 'quiet storm', 'new jack swing', 'funk', 'motown', 'pop soul',
      'southern soul', 'northern soul', 'blue eyed soul', 'disco', 'trap soul',
    ],
    unless: ['funk carioca', 'baile funk', 'funk metal'],
  },
  {
    bucket: 'Rock',
    match: [
      'rock', 'hard rock', 'classic rock', 'punk', 'pop punk', 'post punk', 'grunge',
      'garage rock', 'psychedelic rock', 'progressive rock', 'prog rock', 'glam rock',
      'blues rock', 'emo', 'hardcore', 'screamo', 'surf rock', 'modern rock', 'soft rock',
      'folk rock', 'southern rock', 'stoner rock', 'shoegaze', 'new wave', 'britpop',
      'rock and roll', 'rockabilly', 'blues',
    ],
    unless: ['rap rock', 'rock en espanol', 'rhythm and blues', 'emo rap', 'hardcore hip hop', 'hardcore techno'],
  },
  {
    bucket: 'Indie / Alternative',
    match: [
      'indie', 'alternative', 'alt', 'alt rock', 'indie rock', 'indie pop', 'indie folk',
      'bedroom pop', 'lo fi indie', 'dream pop', 'shoegaze', 'post rock', 'math rock',
      'alternative rock', 'alternative pop', 'alt pop', 'art rock', 'chamber pop',
      'new rave', 'noise pop', 'slowcore', 'midwest emo', 'jangle pop', 'indietronica',
      'singer songwriter', 'pov indie', 'modern alternative rock',
    ],
  },
  {
    bucket: 'Electronic',
    match: [
      'electronic', 'electronica', 'edm', 'house', 'deep house', 'tech house', 'techno',
      'trance', 'dubstep', 'drum and bass', 'dnb', 'electro', 'synthwave', 'retrowave',
      'lo fi', 'lofi', 'ambient', 'idm', 'downtempo', 'chillwave', 'future bass', 'breakbeat',
      'garage', 'uk garage', 'hardstyle', 'big room', 'progressive house', 'electro house',
      'trip hop', 'vaporwave', 'chillhop', 'eurodance', 'rave', 'jungle', 'bass music', 'tropical house',
    ],
    unless: ['garage rock', 'garage punk'],
  },
  {
    bucket: 'Latin',
    match: [
      'latin', 'reggaeton', 'bachata', 'salsa', 'cumbia', 'corridos', 'corrido',
      'regional mexican', 'sertanejo', 'funk carioca', 'baile funk', 'latin pop', 'trap latino',
      'urbano latino', 'musica mexicana', 'banda', 'norteno', 'mariachi', 'bossa nova',
      'tango', 'bolero', 'merengue', 'dembow', 'latin hip hop', 'mpb', 'pagode', 'samba',
      'forro', 'rock en espanol', 'vallenato', 'ranchera', 'tropical', 'latino',
    ],
    unless: ['tropical house'],
  },
  {
    bucket: 'Country',
    match: [
      'country', 'classic country', 'country rock', 'contemporary country', 'country pop',
      'outlaw country', 'bluegrass', 'americana', 'honky tonk', 'nashville sound',
      'alt country', 'red dirt', 'country road', 'bro country', 'texas country',
      'country dawn', 'western swing', 'cowboy', 'new country',
    ],
  },
  {
    bucket: 'K-Pop',
    match: [
      'k pop', 'kpop', 'korean pop', 'k pop boy group', 'k pop girl group', 'k rap',
      'k indie', 'k rock', 'k r and b', 'korean r and b', 'korean', 'k ballad', 'k hip hop',
      'korean hip hop', 'korean ost', 'k drama ost', 'korean indie', 'k trot', 'trot',
    ],
  },
  {
    bucket: 'Metal',
    match: [
      'metal', 'heavy metal', 'death metal', 'black metal', 'thrash metal', 'doom metal',
      'metalcore', 'deathcore', 'nu metal', 'power metal', 'progressive metal', 'djent',
      'grindcore', 'sludge', 'symphonic metal', 'folk metal', 'industrial metal',
      'speed metal', 'gothic metal', 'post metal', 'melodic death metal', 'groove metal',
    ],
  },
  {
    bucket: 'Reggae / Afrobeats',
    match: [
      'reggae', 'dancehall', 'afrobeats', 'afrobeat', 'amapiano', 'afropop', 'soca', 'dub',
      'ska', 'roots reggae', 'reggae fusion', 'ragga', 'afroswing', 'afro house', 'gqom',
      'highlife', 'naija', 'nigerian pop', 'ghanaian', 'bongo flava', 'afro pop', 'lovers rock',
      'rocksteady', 'calypso', 'zouk', 'kompa', 'african', 'afro soul', 'afro fusion',
    ],
    unless: ['dubstep', 'brostep'],
  },
  {
    bucket: 'Folk / Acoustic',
    match: [
      'folk', 'acoustic', 'indie folk', 'folk rock', 'singer songwriter', 'traditional folk',
      'contemporary folk', 'anti folk', 'freak folk', 'celtic', 'irish folk', 'neofolk',
      'stomp and holler', 'folk pop', 'acoustic pop', 'bluegrass', 'americana',
      'chamber folk', 'british folk', 'appalachian folk',
    ],
    unless: ['folk metal', 'folk punk'],
  },
  {
    bucket: 'Jazz',
    match: [
      'jazz', 'smooth jazz', 'bebop', 'swing', 'big band', 'cool jazz', 'jazz fusion',
      'vocal jazz', 'latin jazz', 'acid jazz', 'jazz funk', 'hard bop', 'free jazz',
      'jazz rap', 'jazz blues', 'nu jazz', 'trad jazz', 'bossa nova jazz', 'dixieland',
      'gypsy jazz', 'contemporary jazz', 'jazz pop', 'lounge', 'easy listening', 'standards',
    ],
  },
  {
    bucket: 'Soundtrack',
    match: [
      'soundtrack', 'score', 'video game music', 'anime', 'broadway', 'show tunes',
      'movie tunes', 'film score', 'ost', 'original score', 'musicals', 'musical', 'cinematic',
      'game soundtrack', 'anime ost', 'tv soundtrack', 'disney', 'video game', 'vgm',
      'movie soundtrack', 'orchestral soundtrack', 'trailer music',
      'j rock anime', 'anime score', 'chiptune',
    ],
  },
  {
    bucket: 'Classical',
    match: [
      'classical', 'baroque', 'opera', 'orchestra', 'orchestral', 'symphony',
      'chamber music', 'romantic era', 'early music', 'renaissance', 'contemporary classical',
      'neoclassical', 'minimalism', 'choral', 'string quartet', 'concerto', 'sonata',
      'classical piano', 'modern classical', 'post romantic', 'medieval', 'gregorian chant',
      'solo piano', 'cello', 'violin', 'harpsichord',
    ],
  },
]

export const JUNK_TAGS: string[] = [
  'seen live', 'favorites', 'favourites', 'favorite', 'favourite', 'my favorite',
  'my favourite', 'love', 'awesome', 'beautiful', 'male vocalists', 'female vocalists',
  'male vocalist', 'female vocalist', 'under 2000 listeners', 'albums i own', 'spotify',
  'check out', 'good', 'great', 'best', 'cool', 'amazing', 'love at first listen',
  'all', 'music', 'catchy', 'sexy', 'usa', 'american', 'british', 'uk', 'live',
]

export const LASTFM_MIN_COUNT = 25 // Last.fm tag "count" is 0-100 relative weight
export const LASTFM_MAX_TAGS = 5

export function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[-_/:]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function hasKeyword(paddedGenre: string, keyword: string): boolean {
  return paddedGenre.includes(' ' + keyword + ' ')
}

export function bucketsFor(rawGenres: string[]): string[] {
  const found = new Set<string>()
  for (const raw of rawGenres) {
    const padded = ' ' + normalize(raw) + ' '
    for (const rule of RULES) {
      if (rule.unless?.some((k) => hasKeyword(padded, k))) continue
      if (rule.match.some((k) => hasKeyword(padded, k))) found.add(rule.bucket)
    }
  }
  return BUCKETS.filter((b) => found.has(b))
}

export function cleanLastfmTags(
  tags: { name: string; count: number | string }[],
  artistName: string,
): string[] {
  const junk = new Set(JUNK_TAGS.map(normalize))
  const artist = normalize(artistName)
  const out: string[] = []
  for (const tag of tags) {
    if (Number(tag.count) < LASTFM_MIN_COUNT) continue
    const n = normalize(tag.name)
    if (!n || junk.has(n) || n === artist) continue
    if (/^(\d{4}|\d{2,4}s)$/.test(n)) continue
    out.push(tag.name.toLowerCase().trim())
    if (out.length >= LASTFM_MAX_TAGS) break
  }
  return out
}

export function pickTopBuckets(rankedArtistGenres: string[][], n = 6): string[] {
  const total = rankedArtistGenres.length
  const weights = new Map<string, number>()
  rankedArtistGenres.forEach((genres, i) => {
    for (const b of bucketsFor(genres)) {
      weights.set(b, (weights.get(b) ?? 0) + (total - i))
    }
  })
  const chosen = BUCKETS.filter((b) => (weights.get(b) ?? 0) > 0)
    .sort((a, b) => weights.get(b)! - weights.get(a)! || BUCKETS.indexOf(a) - BUCKETS.indexOf(b))
    .slice(0, n)
  for (const b of BUCKETS) {
    if (chosen.length >= n) break
    if (!chosen.includes(b)) chosen.push(b)
  }
  return chosen
}

export function bestSlot(trackBuckets: string[], userBuckets: string[]): number {
  return userBuckets.findIndex((b) => trackBuckets.includes(b))
}
