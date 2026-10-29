// Artist genre lookup with a D1 cache: Spotify genres → Last.fm top tags → "unknown".
import { Budget, Db } from './budget';
import { bucketsFor, cleanLastfmTags } from './genres';
import { LastfmUnavailable, artistTopTags } from './lastfm';
import { Spotify } from './spotify';
import type { ArtistRow, Env } from './types';

export const ARTIST_MAX_AGE = 90 * 24 * 3600 * 1000;
export const STALE_PER_RUN = 3;

/** Worst-case fetches for one artist: Spotify + Last.fm. */
export const ARTIST_COST = 2;

/** How long to skip the Spotify step after Spotify returns artists without a `genres` field. */
export const SPOTIFY_GENRES_RECHECK_MS = 7 * 24 * 3600 * 1000;

/**
 * Shared by all lookups in one run. As of Oct 2026, dev-mode apps get artist objects with no
 * `genres` field at all, so once we see that we go straight to Last.fm (and re-check weekly).
 */
export interface LookupCtx {
  useSpotify: boolean;
  lastfmOk: boolean;
  sawNoGenres?: boolean;
}

export function lookupCtx(meta: Record<string, string | number>, now: number): LookupCtx {
  return {
    useSpotify: Number(meta.spotify_no_genres_until ?? 0) <= now,
    lastfmOk: Number(meta.lastfm_blocked_until ?? 0) <= now,
  };
}

export interface Artist {
  id: string;
  name: string;
  genres: string[];
  source: ArtistRow['source'];
  buckets?: string[]; // memo of bucketsFor(genres)
}

export function fromRow(r: ArtistRow): Artist {
  return { id: r.id, name: r.name, genres: JSON.parse(r.genres) as string[], source: r.source };
}

export function artistBuckets(a: Artist): string[] {
  return (a.buckets ??= bucketsFor(a.genres));
}

/**
 * Resolve one artist. `known` lets callers pass genres they already have (e.g. from /me/top/artists)
 * to skip the Spotify call. Throws LastfmUnavailable / RateLimited / OutOfBudget — the artist then
 * stays unresolved and is retried later, so a temporary failure never gets cached as "unknown".
 */
export async function resolveArtist(
  env: Env,
  budget: Budget,
  spotify: Spotify,
  id: string,
  name: string,
  known: string[] | undefined,
  ctx: LookupCtx,
): Promise<Artist> {
  let genres = known;
  if (genres === undefined && ctx.useSpotify) {
    const a = await spotify.artist(id);
    if (a && !('genres' in a)) {
      ctx.sawNoGenres = true;
      ctx.useSpotify = false;
    }
    genres = a?.genres;
    if (a?.name) name = a.name;
  }
  genres ??= [];
  if (genres.length) return { id, name, genres, source: 'spotify' };
  if (!ctx.lastfmOk) throw new LastfmUnavailable('Last.fm is backing off');
  const tags = cleanLastfmTags(await artistTopTags(env, budget, name), name);
  return { id, name, genres: tags, source: tags.length ? 'lastfm' : 'none' };
}

export function upsertArtist(db: Db, a: Artist, now: number): D1PreparedStatement {
  return db.stmt(
    `INSERT INTO artists (id, name, genres, source, fetched_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, genres = excluded.genres,
       source = excluded.source, fetched_at = excluded.fetched_at`,
    a.id,
    a.name,
    JSON.stringify(a.genres),
    a.source,
    now,
  );
}

/** Cached artists for a list of ids (chunked to stay under D1's 100 bound-parameter limit). */
export async function loadArtists(db: Db, ids: string[]): Promise<Map<string, Artist>> {
  const out = new Map<string, Artist>();
  const unique = [...new Set(ids)];
  const stmts: D1PreparedStatement[] = [];
  for (let i = 0; i < unique.length; i += 90) {
    const chunk = unique.slice(i, i + 90);
    stmts.push(db.stmt(`SELECT * FROM artists WHERE id IN (${chunk.map(() => '?').join(',')})`, ...chunk));
  }
  for (const r of await db.batch(stmts)) for (const row of r.results as ArtistRow[]) out.set(row.id, fromRow(row));
  return out;
}
