// Minimal Spotify Web API client: plain fetch, every call charged to a Budget.
import { Budget } from './budget';
import type { Env, TokenRow } from './types';

const API = 'https://api.spotify.com/v1';
const ACCOUNTS = 'https://accounts.spotify.com';
export const SCOPES =
  'user-read-recently-played user-top-read playlist-read-private playlist-modify-private playlist-modify-public';

export class SpotifyError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** 429: don't sleep inside a Worker; record `until` and resume on a later run. */
export class RateLimited extends Error {
  readonly until: number;
  constructor(until: number) {
    super(`Spotify rate limit until ${new Date(until).toISOString()}`);
    this.until = until;
  }
}

/** Spotify rejected the refresh token (revoked, removed from User Management, etc). */
export class ReconnectNeeded extends Error {
  constructor() {
    super('Spotify access was revoked or expired — log in again to reconnect');
  }
}

export interface Tokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  genres?: string[];
}

export interface PlayHistory {
  played_at: string;
  track: {
    id: string | null;
    uri: string;
    name: string;
    is_local?: boolean;
    artists: { id: string | null; name: string }[];
  } | null;
}

export function authorizeUrl(env: Env, redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    response_type: 'code',
    client_id: env.SPOTIFY_CLIENT_ID,
    scope: SCOPES,
    redirect_uri: redirectUri,
    state,
  });
  return `${ACCOUNTS}/authorize?${q}`;
}

async function tokenRequest(env: Env, budget: Budget, body: Record<string, string>, oldRefresh?: string): Promise<Tokens> {
  budget.take();
  const res = await fetch(`${ACCOUNTS}/api/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(body),
  });
  if (res.status === 429) throw new RateLimited(retryAt(res));
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    if (data.error === 'invalid_grant' && oldRefresh) throw new ReconnectNeeded();
    throw new SpotifyError(res.status, `Spotify token error: ${String(data.error_description ?? data.error ?? res.status)}`);
  }
  return {
    access_token: String(data.access_token),
    // Spotify may rotate the refresh token; keep the old one only if no new one came back.
    refresh_token: String(data.refresh_token ?? oldRefresh ?? ''),
    expires_at: Date.now() + Number(data.expires_in ?? 3600) * 1000,
  };
}

export function exchangeCode(env: Env, budget: Budget, code: string, redirectUri: string): Promise<Tokens> {
  return tokenRequest(env, budget, { grant_type: 'authorization_code', code, redirect_uri: redirectUri });
}

function retryAt(res: Response): number {
  const secs = Number(res.headers.get('Retry-After'));
  return Date.now() + (Number.isFinite(secs) && secs > 0 ? secs : 60) * 1000;
}

/** A client for one user. `changed` is set when tokens were refreshed and need saving. */
export class Spotify {
  tokens: Tokens;
  changed = false;
  /** The refresh token as stored in D1; saves only apply if it's still the stored one. */
  storedRefresh: string;
  /** Called right after a refresh so a rotated refresh token is saved immediately. */
  onRefresh?: () => Promise<void>;
  budget: Budget;
  private readonly env: Env;

  constructor(env: Env, tokens: Tokens | TokenRow, budget: Budget) {
    this.env = env;
    this.tokens = { access_token: tokens.access_token, refresh_token: tokens.refresh_token, expires_at: tokens.expires_at };
    this.storedRefresh = tokens.refresh_token;
    this.budget = budget;
  }

  async refresh(): Promise<void> {
    this.tokens = await tokenRequest(
      this.env,
      this.budget,
      { grant_type: 'refresh_token', refresh_token: this.tokens.refresh_token },
      this.tokens.refresh_token,
    );
    this.changed = true;
    await this.onRefresh?.();
  }

  private send(method: string, path: string, body?: unknown): Promise<Response> {
    this.budget.take();
    return fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.tokens.access_token}`,
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  async call<T>(method: string, path: string, body?: unknown): Promise<T> {
    if (this.tokens.expires_at - 60_000 < Date.now()) await this.refresh();
    let res = await this.send(method, path, body);
    if (res.status === 401) {
      // One forced refresh, then retry once.
      await this.refresh();
      res = await this.send(method, path, body);
    }
    if (res.status === 429) throw new RateLimited(retryAt(res));
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      let msg = `Spotify ${res.status} on ${method} ${path.split('?')[0]}`;
      if (data.error?.message) msg += `: ${data.error.message}`;
      if (res.status === 403) msg += ' (is this user added in the Spotify Developer Dashboard → User Management?)';
      throw new SpotifyError(res.status, msg);
    }
    const text = await res.text();
    return (text ? JSON.parse(text) : null) as T;
  }

  me(): Promise<{ id: string; display_name: string | null; account_id?: string }> {
    return this.call('GET', '/me');
  }

  async topArtists(range: 'short_term' | 'medium_term' | 'long_term'): Promise<SpotifyArtist[]> {
    const r = await this.call<{ items: SpotifyArtist[] }>('GET', `/me/top/artists?time_range=${range}&limit=50`);
    return r?.items ?? [];
  }

  async recentlyPlayed(after: number | null): Promise<PlayHistory[]> {
    const q = after ? `&after=${after}` : '';
    const r = await this.call<{ items: PlayHistory[] }>('GET', `/me/player/recently-played?limit=50${q}`);
    return r?.items ?? [];
  }

  /** One artist (batch GET /artists was removed in 2026). Returns null if Spotify doesn't know the id. */
  async artist(id: string): Promise<SpotifyArtist | null> {
    try {
      return await this.call<SpotifyArtist>('GET', `/artists/${encodeURIComponent(id)}`);
    } catch (e) {
      if (e instanceof SpotifyError && (e.status === 404 || e.status === 400)) return null;
      throw e;
    }
  }

  /** Double-checks a 404 before we treat a playlist as deleted. */
  async playlistExists(id: string): Promise<boolean> {
    try {
      await this.call('GET', `/playlists/${encodeURIComponent(id)}?fields=id`);
      return true;
    } catch (e) {
      if (e instanceof SpotifyError && e.status === 404) return false;
      throw e;
    }
  }

  createPlaylist(name: string, description: string): Promise<{ id: string }> {
    return this.call('POST', '/me/playlists', { name, description, public: false });
  }

  async updatePlaylist(id: string, name: string, description: string): Promise<void> {
    await this.call('PUT', `/playlists/${encodeURIComponent(id)}`, { name, description });
  }

  /** Up to 100 URIs per call (Spotify's limit). Endpoint renamed from /tracks to /items in 2026. */
  async addItems(id: string, uris: string[]): Promise<void> {
    await this.call('POST', `/playlists/${encodeURIComponent(id)}/items`, { uris });
  }
}
