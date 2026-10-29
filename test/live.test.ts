// Live checks against the real Spotify and Last.fm APIs. Skipped unless keys are in the environment:
//   env $(grep -v '^#' .dev.vars | xargs) npx vitest run test/live.test.ts
import { describe, expect, it } from 'vitest';
import { lookupCtx, resolveArtist } from '../src/artists';
import { Budget } from '../src/budget';
import { bucketsFor } from '../src/genres';
import { artistTopTags } from '../src/lastfm';
import { Spotify } from '../src/spotify';
import type { Env } from '../src/types';

const env = {
  SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID ?? '',
  SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET ?? '',
  LASTFM_API_KEY: process.env.LASTFM_API_KEY ?? '',
} as Env;

// App-only token (client credentials) — enough for GET /artists/{id}.
async function appSpotify(budget: Budget): Promise<Spotify> {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  expect(res.status).toBe(200);
  const t = (await res.json()) as { access_token: string };
  return new Spotify(env, { access_token: t.access_token, refresh_token: '', expires_at: Date.now() + 3_000_000 }, budget);
}

describe.skipIf(!env.LASTFM_API_KEY)('Last.fm live', () => {
  it('classifies a well-known artist from tags', async () => {
    const tags = await artistTopTags(env, new Budget(5), 'Radiohead');
    expect(tags.length).toBeGreaterThan(0);
    const r = await resolveArtist(env, new Budget(5), null as unknown as Spotify, 'x', 'Radiohead', [], lookupCtx({}, Date.now()));
    expect(r.source).toBe('lastfm');
    expect(bucketsFor(r.genres)).toEqual(expect.arrayContaining(['Rock']));
  });

  it('marks an artist with no tags anywhere as unknown (→ Misc)', async () => {
    const r = await resolveArtist(env, new Budget(5), null as unknown as Spotify, 'x', 'zqxv nonexistent artist 8812731', [], lookupCtx({}, Date.now()));
    expect(r.source).toBe('none');
    expect(bucketsFor(r.genres)).toEqual([]);
  });
});

describe.skipIf(!env.SPOTIFY_CLIENT_SECRET || !env.LASTFM_API_KEY)('Spotify + Last.fm live', () => {
  it('resolves artists through the full chain and counts subrequests', async () => {
    const budget = new Budget(10);
    const spotify = await appSpotify(budget);
    const ctx = lookupCtx({}, Date.now());
    // Drake, Radiohead, Bad Bunny. Names are what the track object would give us.
    const artists = { '3TVXtAsR1Inumwj472S9r4': 'Drake', '4Z8W4fKeB5YxbusRsdQVPb': 'Radiohead', '4q3ewBCX7sLwd24euuV69X': 'Bad Bunny' };
    for (const [id, name] of Object.entries(artists)) {
      const a = await resolveArtist(env, budget, spotify, id, name, undefined, ctx);
      console.log(`${a.name}: source=${a.source} genres=${JSON.stringify(a.genres)} buckets=${JSON.stringify(bucketsFor(a.genres))}`);
      expect(a.name).not.toBe('');
      expect(a.source).not.toBe('none');
      expect(bucketsFor(a.genres).length).toBeGreaterThan(0);
    }
    // token + first artist (Spotify + Last.fm) + Last.fm-only for the rest once Spotify shows no genres field
    console.log(`fetches used: ${budget.used}, Spotify genres field present: ${!ctx.sawNoGenres}`);
    expect(budget.used).toBeLessThanOrEqual(7);
  });
});
