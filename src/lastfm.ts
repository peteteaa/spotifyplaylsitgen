// Last.fm fallback for artists whose Spotify `genres` is empty.
import { Budget } from './budget';
import type { Env } from './types';

/** Last.fm couldn't answer right now (rate limit, outage, missing key). The artist stays unresolved. */
export class LastfmUnavailable extends Error {
  readonly rateLimited: boolean;
  constructor(message: string, rateLimited = false) {
    super(message);
    this.rateLimited = rateLimited;
  }
}

export interface LastfmTag {
  name: string;
  count: number | string;
}

/** Top tags for an artist, by name. Returns [] when Last.fm doesn't know the artist. */
export async function artistTopTags(env: Env, budget: Budget, artistName: string): Promise<LastfmTag[]> {
  if (!env.LASTFM_API_KEY) throw new LastfmUnavailable('LASTFM_API_KEY is not set');
  const q = new URLSearchParams({
    method: 'artist.gettoptags',
    artist: artistName,
    autocorrect: '1',
    api_key: env.LASTFM_API_KEY,
    format: 'json',
  });
  budget.take();
  let res: Response;
  try {
    res = await fetch(`https://ws.audioscrobbler.com/2.0/?${q}`, { headers: { 'User-Agent': 'autolist-worker/1.0' } });
  } catch {
    throw new LastfmUnavailable('Last.fm request failed');
  }
  if (res.status === 429) throw new LastfmUnavailable('Last.fm rate limit', true);
  const data = (await res.json().catch(() => null)) as
    | { error?: number; message?: string; toptags?: { tag?: LastfmTag[] | LastfmTag } }
    | null;
  if (!data) throw new LastfmUnavailable(`Last.fm returned ${res.status}`);
  if (data.error === 6) return []; // artist not found
  if (data.error === 29) throw new LastfmUnavailable('Last.fm rate limit', true);
  if (data.error) throw new LastfmUnavailable(`Last.fm error ${data.error}: ${data.message ?? ''}`);
  const tag = data.toptags?.tag ?? [];
  return Array.isArray(tag) ? tag : [tag];
}
