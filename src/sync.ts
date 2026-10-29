// Sync: recently-played → dedupe → genre lookup → place → add to playlists.
import {
  ARTIST_COST,
  ARTIST_MAX_AGE,
  Artist,
  LookupCtx,
  SPOTIFY_GENRES_RECHECK_MS,
  STALE_PER_RUN,
  artistBuckets,
  lookupCtx,
  fromRow,
  loadArtists,
  resolveArtist,
  upsertArtist,
} from './artists';
import { Budget, Db, FETCH_BUDGET, OutOfBudget, setMeta } from './budget';
import { MISC, bestSlot, bucketsFor, pickTopBuckets } from './genres';
import { LastfmUnavailable } from './lastfm';
import { RateLimited, ReconnectNeeded, Spotify, SpotifyArtist, SpotifyError, Tokens } from './spotify';
import {
  ArtistRow,
  Env,
  GENRE_SLOTS,
  MISC_SLOT,
  PLAYLIST_CAP,
  PlaylistRow,
  TokenRow,
  TrackRow,
  UserRow,
  UserStatus,
} from './types';

const LOCK_MS = 5 * 60_000;
const WORK_LIMIT = 300; // songs considered per user per run
const MAX_ARTISTS_PER_TRACK = 3; // primary first; the others only if the primary doesn't match
const LASTFM_BACKOFF_MS = 10 * 60_000;
const MAX_TRIES = 5;
// Spotify can list a play in recently-played a few minutes late, sometimes after a later play.
// Re-read this far behind the cursor so a late arrival isn't skipped (dedupe ignores repeats).
const LOOKBACK_MS = 30 * 60_000; // failed lookups before a pending song gives up waiting and goes to Misc

// ---------- Playlists ----------

export function playlistName(env: Env, bucket: string): string {
  return `${env.PLAYLIST_PREFIX || 'Autolist'} · ${bucket}`;
}

function playlistDescription(bucket: string): string {
  return bucket === MISC
    ? "Autolist: songs you've played that don't fit your 6 genres."
    : `Autolist: ${bucket} songs you've played, sorted automatically.`;
}

export function initialPlaylists(userId: string, buckets: string[]): PlaylistRow[] {
  return [...buckets, MISC].map((bucket, slot) => ({
    user_id: userId,
    slot,
    bucket,
    spotify_id: null,
    name_synced: 1,
    item_count: 0,
    paused_at: null,
  }));
}

/**
 * Store a play (binds: user_id, track_id, name, artist_ids, artist_names, played_at, status). Dedupe is the
 * primary key: a song the user already has is ignored, except a skipped one played again later, which gets
 * another chance (the lookback re-reads the same play, which is not later).
 */
export const INSERT_PLAY = `INSERT INTO tracks (user_id, track_id, name, artist_ids, artist_names, played_at, status)
  VALUES (?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (user_id, track_id) DO UPDATE SET status = excluded.status, played_at = excluded.played_at, slot = NULL, tries = 0
  WHERE tracks.status = 'skipped' AND excluded.played_at > tracks.played_at`;

/** A play from on or after a pause start is skipped; one from before it still counts. */
export function skippedByPause(pausedAt: number | null, playedAt: number): boolean {
  return pausedAt != null && playedAt >= pausedAt;
}

interface PlaylistChanges {
  created: Set<number>;
  renamed: Map<number, string>; // slot → bucket the Spotify name now matches
  added: Map<number, number>; // slot → songs added this run
  reset: Set<number>; // Spotify says the playlist is gone; recreate next run
}

function noChanges(): PlaylistChanges {
  return { created: new Set(), renamed: new Map(), added: new Map(), reset: new Set() };
}

/** Create any missing playlists and push pending renames. Records progress in `ch` even if it throws. */
export async function ensurePlaylists(env: Env, spotify: Spotify, rows: PlaylistRow[], ch: PlaylistChanges): Promise<void> {
  for (const p of rows) {
    if (!p.spotify_id) {
      const pl = await spotify.createPlaylist(playlistName(env, p.bucket), playlistDescription(p.bucket));
      p.spotify_id = pl.id;
      p.name_synced = 1;
      ch.created.add(p.slot);
    } else if (!p.name_synced) {
      await spotify.updatePlaylist(p.spotify_id, playlistName(env, p.bucket), playlistDescription(p.bucket));
      p.name_synced = 1;
      ch.renamed.set(p.slot, p.bucket);
    }
  }
}

function playlistStmts(db: Db, rows: PlaylistRow[], ch: PlaylistChanges): D1PreparedStatement[] {
  const out: D1PreparedStatement[] = [];
  for (const p of rows) {
    const key = [p.user_id, p.slot];
    if (ch.created.has(p.slot))
      out.push(db.stmt('UPDATE playlists SET spotify_id = ?, name_synced = 1 WHERE user_id = ? AND slot = ? AND spotify_id IS NULL', p.spotify_id, ...key));
    // Only mark synced if nobody changed the bucket again while we were renaming.
    if (ch.renamed.has(p.slot))
      out.push(db.stmt('UPDATE playlists SET name_synced = 1 WHERE user_id = ? AND slot = ? AND bucket = ?', ...key, ch.renamed.get(p.slot)));
    if (ch.added.get(p.slot))
      out.push(db.stmt('UPDATE playlists SET item_count = item_count + ? WHERE user_id = ? AND slot = ?', ch.added.get(p.slot), ...key));
    if (ch.reset.has(p.slot))
      out.push(db.stmt('UPDATE playlists SET spotify_id = NULL, item_count = 0, name_synced = 1 WHERE user_id = ? AND slot = ?', ...key));
  }
  return out;
}

function noGenresStmt(db: Db, now: number): D1PreparedStatement {
  return setMeta(db, 'spotify_no_genres_until', String(now + SPOTIFY_GENRES_RECHECK_MS));
}

/**
 * Save refreshed tokens. Guarded on the refresh token we started from, so a stale run can't
 * overwrite tokens saved by a newer login/reconnect.
 */
function tokenStmt(db: Db, userId: string, spotify: Spotify): D1PreparedStatement {
  const t = spotify.tokens;
  const stmt = db.stmt(
    'UPDATE tokens SET access_token = ?, refresh_token = ?, expires_at = ? WHERE user_id = ? AND refresh_token = ?',
    t.access_token,
    t.refresh_token,
    t.expires_at,
    userId,
    spotify.storedRefresh,
  );
  spotify.storedRefresh = t.refresh_token;
  return stmt;
}

// ---------- One user ----------

export interface SyncResult {
  ran: boolean; // false: not active, already syncing, or Spotify is rate-limiting us
  added: number;
  moreWork: boolean; // stopped early for budget; more songs could be placed with more budget
  outOfBudget: boolean;
  rateLimited: boolean;
  message: string;
  userId: string;
  spotify?: Spotify;
}

function lockStmt(db: Db, userId: string, now: number): D1PreparedStatement {
  return db.stmt(
    "UPDATE users SET lock_until = ? WHERE id = ? AND status = 'active' AND (lock_until IS NULL OR lock_until < ?)",
    now + LOCK_MS,
    userId,
    now,
  );
}

function workStmts(db: Db, userId: string): D1PreparedStatement[] {
  return [
    db.stmt(
      `SELECT * FROM tracks WHERE user_id = ? AND status IN ('pending', 'queued') ORDER BY played_at LIMIT ${WORK_LIMIT}`,
      userId,
    ),
    db.stmt(
      `SELECT * FROM artists WHERE id IN (
         SELECT j.value FROM (
           SELECT artist_ids FROM tracks WHERE user_id = ? AND status = 'pending' ORDER BY played_at LIMIT ${WORK_LIMIT}
         ) t, json_each(t.artist_ids) j)`,
      userId,
    ),
  ];
}

/**
 * Sync one user within `budget`. Uses 3 D1 queries with fetchRecent (2 without), plus one per
 * playlist add (saved right away so a killed invocation can't re-add songs) and one per token refresh.
 * Everything done before a budget/rate-limit stop is saved; leftovers continue next run.
 */
export async function syncUser(
  env: Env,
  db: Db,
  budget: Budget,
  userId: string,
  opts: { fetchRecent: boolean },
): Promise<SyncResult> {
  const now = Date.now();
  const res: SyncResult = { ran: false, added: 0, moreWork: false, outOfBudget: false, rateLimited: false, message: '', userId };

  const a = await db.batch([
    lockStmt(db, userId, now),
    db.stmt('SELECT * FROM users WHERE id = ?', userId),
    db.stmt('SELECT * FROM tokens WHERE user_id = ?', userId),
    db.stmt('SELECT * FROM playlists WHERE user_id = ? ORDER BY slot', userId),
    db.stmt("SELECT key, value FROM meta WHERE key IN ('spotify_blocked_until', 'lastfm_blocked_until', 'spotify_no_genres_until')"),
    ...(opts.fetchRecent ? [] : workStmts(db, userId)),
  ]);
  const user = a[1].results[0] as UserRow | undefined;
  if (!a[0].meta.changes || !user) {
    res.message = user?.status !== 'active' ? `Not syncing: ${user?.status ?? 'unknown user'}` : 'A sync is already running';
    return res;
  }
  res.ran = true;
  const tok = a[2].results[0] as TokenRow | undefined;
  const playlists = a[3].results as PlaylistRow[];
  const meta = Object.fromEntries((a[4].results as { key: string; value: string }[]).map((r) => [r.key, Number(r.value)]));
  let work: TrackRow[] = opts.fetchRecent ? [] : (a[5].results as TrackRow[]);
  const cache = new Map<string, Artist>((opts.fetchRecent ? [] : (a[6].results as ArtistRow[])).map((r) => [r.id, fromRow(r)]));

  const ch = noChanges();
  const dirty = new Map<string, TrackRow>();
  const newArtists: Artist[] = [];
  const extra: D1PreparedStatement[] = [];
  const spotify = tok ? new Spotify(env, tok, budget) : null;
  let status: UserStatus = 'active';
  let ok = true;
  const ctx = lookupCtx(meta, now);
  const slotErrors: string[] = [];
  if (spotify)
    spotify.onRefresh = async () => {
      if (db.left > 2) await db.batch([tokenStmt(db, userId, spotify)]);
    };

  try {
    if (!spotify) throw new ReconnectNeeded();
    if ((meta.spotify_blocked_until ?? 0) > now) throw new RateLimited(meta.spotify_blocked_until);
    await ensurePlaylists(env, spotify, playlists, ch);

    if (opts.fetchRecent) {
      const plays = await spotify.recentlyPlayed(user.cursor_after ? user.cursor_after - LOOKBACK_MS : null);
      let cursor = user.cursor_after ?? 0;
      const inserts: D1PreparedStatement[] = [];
      for (const p of [...plays].reverse()) {
        const t = p.track;
        const playedAt = Date.parse(p.played_at);
        if (playedAt > cursor) cursor = playedAt;
        if (!t?.id || t.is_local || !t.uri?.startsWith('spotify:track:')) continue;
        const artists = t.artists.filter((x) => x.id).slice(0, MAX_ARTISTS_PER_TRACK);
        inserts.push(
          db.stmt(
            INSERT_PLAY,
            userId,
            t.id,
            t.name,
            JSON.stringify(artists.map((x) => x.id)),
            JSON.stringify(artists.map((x) => x.name)),
            playedAt,
            skippedByPause(user.adding_paused_at, playedAt) ? 'skipped' : 'pending',
          ),
        );
      }
      const b = await db.batch([
        ...inserts,
        db.stmt('UPDATE users SET cursor_after = ? WHERE id = ?', cursor || null, userId),
        ...workStmts(db, userId),
      ]);
      work = b[b.length - 2].results as TrackRow[];
      for (const r of b[b.length - 1].results as ArtistRow[]) cache.set(r.id, fromRow(r));
    }
    // Adding is paused: new plays were just stored as skipped; songs from before the pause wait for the resume.
    if (user.adding_paused_at != null) work = [];

    // ---- Place songs, looking up uncached artists while the budget allows ----
    const userBuckets = playlists.filter((p) => p.slot < GENRE_SLOTS).map((p) => p.bucket);
    const bySlot = new Map(playlists.map((p) => [p.slot, p]));
    const canAdd = (slot: number) => {
      const p = bySlot.get(slot);
      return !!p?.spotify_id && p.item_count < PLAYLIST_CAP && p.paused_at == null;
    };
    const parsed = new Map(work.map((t) => [t.track_id, { ids: JSON.parse(t.artist_ids) as string[], names: JSON.parse(t.artist_names) as string[] }]));
    const place = (t: TrackRow): number | { id: string; name: string } => {
      const { ids, names } = parsed.get(t.track_id)!;
      for (let i = 0; i < ids.length; i++) {
        const artist = cache.get(ids[i]);
        if (!artist) {
          if (t.tries >= MAX_TRIES) continue; // gave up waiting on this artist
          return { id: ids[i], name: names[i] };
        }
        const slot = bestSlot(artistBuckets(artist), userBuckets);
        if (slot >= 0) return slot;
      }
      return MISC_SLOT;
    };

    const failed = new Set<string>();
    for (;;) {
      let need: { id: string; name: string } | null = null;
      for (const t of work) {
        if (t.status !== 'pending') continue;
        const r = place(t);
        if (typeof r === 'number') {
          // A song for a paused playlist is skipped, not sent to another one (it would flood Misc).
          t.status = skippedByPause(bySlot.get(r)?.paused_at ?? null, t.played_at) ? 'skipped' : 'queued';
          t.slot = r;
          dirty.set(t.track_id, t);
        } else if (!need && !failed.has(r.id)) need = r;
      }
      if (!need) break;
      // Keep enough budget to add the songs already placed (one call per playlist).
      const reserve = new Set(work.filter((t) => t.status === 'queued' && canAdd(t.slot!)).map((t) => t.slot)).size;
      if (budget.left - reserve < ARTIST_COST) {
        res.moreWork = true;
        break;
      }
      try {
        const artist = await resolveArtist(env, budget, spotify, need.id, need.name, undefined, ctx);
        cache.set(artist.id, artist);
        newArtists.push(artist);
      } catch (e) {
        if (!(e instanceof LastfmUnavailable)) throw e;
        failed.add(need.id);
        if (ctx.lastfmOk && e.rateLimited) extra.push(setMeta(db, 'lastfm_blocked_until', String(now + LASTFM_BACKOFF_MS)));
        ctx.lastfmOk = false;
      }
    }
    for (const t of work) {
      if (t.status !== 'pending') continue;
      const r = place(t);
      if (typeof r !== 'number' && failed.has(r.id)) {
        t.tries++;
        dirty.set(t.track_id, t);
      }
    }

    // ---- Add to Spotify, oldest first, ≤100 per request per playlist ----
    const queued = new Map<number, TrackRow[]>();
    for (const t of work) if (t.status === 'queued') queued.set(t.slot!, [...(queued.get(t.slot!) ?? []), t]);
    addLoop: for (const [slot, list] of queued) {
      const p = bySlot.get(slot)!;
      if (!p.spotify_id || p.paused_at != null) continue; // paused: songs from before the pause wait for the resume
      for (let i = 0; i < list.length; ) {
        const room = PLAYLIST_CAP - p.item_count;
        if (room <= 0) {
          for (const t of list.slice(i)) {
            t.status = 'full';
            dirty.set(t.track_id, t);
          }
          break;
        }
        if (db.left < 2) {
          res.moreWork = true; // out of D1 queries; these stay queued for the next run
          break addLoop;
        }
        const chunk = list.slice(i, i + Math.min(100, room));
        try {
          await spotify.addItems(p.spotify_id, chunk.map((t) => `spotify:track:${t.track_id}`));
        } catch (e) {
          if (!(e instanceof SpotifyError)) throw e;
          // A confirmed-deleted playlist is recreated next run; songs stay queued either way.
          if (e.status === 404 && !(await spotify.playlistExists(p.spotify_id))) ch.reset.add(slot);
          else slotErrors.push(`${p.bucket}: ${e.message}`);
          break; // one broken playlist doesn't block the others
        }
        // Save this chunk right away: if the invocation dies later, these songs must not be re-added.
        for (const t of chunk) {
          t.status = 'added';
          t.added_at = now;
          dirty.delete(t.track_id);
        }
        await db.batch([
          ...chunk.map((t) =>
            db.stmt("UPDATE tracks SET status = 'added', slot = ?, added_at = ? WHERE user_id = ? AND track_id = ?", slot, now, userId, t.track_id),
          ),
          db.stmt('UPDATE playlists SET item_count = item_count + ? WHERE user_id = ? AND slot = ?', chunk.length, userId, slot),
          db.stmt('UPDATE users SET total_added = total_added + ? WHERE id = ?', chunk.length, userId),
        ]);
        p.item_count += chunk.length;
        res.added += chunk.length;
        i += chunk.length;
      }
    }
    const pending = work.filter((t) => t.status === 'pending').length;
    res.message =
      user.adding_paused_at != null
        ? 'Adding is paused'
        : `Added ${res.added} song${res.added === 1 ? '' : 's'}` + (pending ? ` · ${pending} waiting for a genre lookup` : '');
    if (slotErrors.length) {
      ok = false;
      res.message += ` · ${slotErrors.join(' · ')}`.slice(0, 250);
    }
  } catch (e) {
    const added = res.added ? `Added ${res.added}; ` : '';
    if (e instanceof OutOfBudget) {
      res.outOfBudget = res.moreWork = true;
      res.message = `${added}run budget used up — continuing next run`;
    } else if (e instanceof RateLimited) {
      res.rateLimited = true;
      ok = false;
      res.message = `${added}Spotify is rate-limiting — retrying after ${new Date(e.until).toISOString().slice(11, 16)} UTC`;
      extra.push(setMeta(db, 'spotify_blocked_until', String(e.until)));
    } else if (e instanceof ReconnectNeeded) {
      status = 'needs_reconnect';
      ok = false;
      res.message = e.message;
    } else {
      ok = false;
      res.message = `${added}${e instanceof Error ? e.message : String(e)}`.slice(0, 300);
      console.log(`sync error for user ${userId}: ${res.message}`);
    }
  } finally {
    // Always save progress and release the lock.
    const continuation = !opts.fetchRecent;
    if (ctx.sawNoGenres) extra.push(noGenresStmt(db, now));
    await db.save([
      ...newArtists.map((x) => upsertArtist(db, x, now)),
      ...[...dirty.values()].map((t) =>
        db.stmt('UPDATE tracks SET status = ?, slot = ?, added_at = ?, tries = ? WHERE user_id = ? AND track_id = ?', t.status, t.slot, t.added_at, t.tries, userId, t.track_id),
      ),
      ...playlistStmts(db, playlists, ch),
      ...(spotify?.changed ? [tokenStmt(db, userId, spotify)] : []),
      // Only mark "needs reconnect" if the rejected token is still the stored one (not just reconnected).
      ...(status === 'needs_reconnect'
        ? [
            tok
              ? db.stmt(
                  "UPDATE users SET status = 'needs_reconnect' WHERE id = ? AND status = 'active' AND EXISTS (SELECT 1 FROM tokens WHERE user_id = ? AND refresh_token = ?)",
                  userId,
                  userId,
                  tok.refresh_token,
                )
              : db.stmt("UPDATE users SET status = 'needs_reconnect' WHERE id = ? AND status = 'active'", userId),
          ]
        : []),
      db.stmt(
        `UPDATE users SET lock_until = NULL, last_sync_at = ?, last_sync_ok = ?, last_sync_msg = ?,
           last_sync_added = CASE WHEN ? THEN last_sync_added + ? ELSE ? END
         WHERE id = ?`,
        now,
        ok ? 1 : 0,
        res.message,
        continuation ? 1 : 0,
        res.added,
        res.added,
        userId,
      ),
      ...extra,
    ]);
  }
  if (spotify && ok) res.spotify = spotify;
  return res;
}

/** "Sync now" for one user: gets the whole invocation budget. */
export function syncNow(env: Env, userId: string): Promise<SyncResult> {
  return syncUser(env, new Db(env.DB), new Budget(FETCH_BUDGET), userId, { fetchRecent: true });
}

// ---------- Cron: everyone, round-robin, one budget ----------

export async function runScheduled(env: Env): Promise<void> {
  const now = Date.now();
  const db = new Db(env.DB);
  const budget = new Budget(FETCH_BUDGET);
  const [u, m] = await db.batch([
    db.stmt("SELECT id FROM users WHERE status = 'active' ORDER BY created_at, id"),
    db.stmt('SELECT key, value FROM meta'),
  ]);
  const meta = Object.fromEntries((m.results as { key: string; value: string }[]).map((r) => [r.key, r.value]));
  const ids = (u.results as { id: string }[]).map((r) => r.id);
  const start = Math.max(0, ids.indexOf(meta.rr_next ?? ''));
  const order = [...ids.slice(start), ...ids.slice(0, start)];

  const summary = { at: now, users: order.length, synced: 0, added: 0, skipped: [] as string[], note: '' };
  let nextStart: string | undefined;
  let stopped = Number(meta.spotify_blocked_until ?? 0) > now;
  if (stopped) summary.note = 'Spotify rate limit';
  let reuse: SyncResult | undefined;
  const leftover: string[] = [];

  // Pass 1: each user gets an equal share of what's left (D1: 3 queries each, keep 1 for the summary).
  for (let i = 0; i < order.length && !stopped; i++) {
    const share = Math.floor(budget.left / (order.length - i));
    if (share < 2 || db.left < 4) {
      nextStart ??= order[i];
      summary.skipped.push(...order.slice(i));
      break;
    }
    let r: SyncResult;
    try {
      r = await syncUser(env, db, budget.sub(share), order[i], { fetchRecent: true });
    } catch (e) {
      // One user's failure (e.g. a D1 error) must not stop everyone else.
      console.log(`cron: sync failed for ${order[i]}: ${e instanceof Error ? e.message : e}`);
      continue;
    }
    if (r.ran) summary.synced++;
    summary.added += r.added;
    if (r.moreWork && !r.rateLimited) leftover.push(order[i]);
    if (r.spotify) reuse = r;
    if (r.rateLimited) {
      nextStart ??= order[i];
      stopped = true;
      summary.note = 'Spotify rate limit';
    }
  }

  // Pass 2: leftover budget goes to pending songs (D1: 2 queries each).
  for (const id of leftover) {
    if (stopped || budget.left < 2 || db.left < 3) break;
    try {
      const r = await syncUser(env, db, budget, id, { fetchRecent: false });
      summary.added += r.added;
      reuse = r.spotify ? r : reuse?.userId === id ? undefined : reuse;
      if (r.rateLimited) stopped = true;
    } catch (e) {
      console.log(`cron: pass 2 failed for ${id}: ${e instanceof Error ? e.message : e}`);
    }
  }

  // Pass 3: refresh a few stale artist cache entries with a token we already have fresh.
  if (!stopped && reuse?.spotify && budget.left >= ARTIST_COST && db.left >= 3) {
    reuse.spotify.budget = budget; // its own per-user share is likely used up
    try {
      await refreshStale(env, db, budget, reuse.userId, reuse.spotify, now, lookupCtx(meta, now));
    } catch (e) {
      console.log(`cron: stale refresh failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  // Start next run with whoever got skipped; if Spotify blocked us, keep the same order;
  // otherwise rotate by one so nobody always goes first.
  if (stopped) nextStart ??= order[0];
  nextStart ??= order[1] ?? order[0];
  summary.note ||= nextStart && summary.skipped.length ? `budget used up; next run starts with ${nextStart}` : '';
  const stats = { ...summary, fetches: budget.used, queries: db.queries + 1 };
  await db.batch([...(nextStart ? [setMeta(db, 'rr_next', nextStart)] : []), setMeta(db, 'last_cron', JSON.stringify(stats))]);
  console.log(`cron: ${JSON.stringify({ ...stats, skipped: stats.skipped.length })}`);
}

async function refreshStale(env: Env, db: Db, budget: Budget, userId: string, spotify: Spotify, now: number, ctx: LookupCtx) {
  const rows = await db.all<ArtistRow>('SELECT * FROM artists WHERE fetched_at < ? ORDER BY fetched_at LIMIT ?', now - ARTIST_MAX_AGE, STALE_PER_RUN);
  const stmts: D1PreparedStatement[] = [];
  for (const row of rows) {
    if (budget.left < ARTIST_COST) break;
    try {
      stmts.push(upsertArtist(db, await resolveArtist(env, budget, spotify, row.id, row.name, undefined, ctx), now));
    } catch (e) {
      // Keep the old cache entry; it's retried on a later run.
      if (e instanceof RateLimited) stmts.push(setMeta(db, 'spotify_blocked_until', String(e.until)));
      break;
    }
  }
  if (spotify.changed) stmts.push(tokenStmt(db, userId, spotify));
  if (ctx.sawNoGenres) stmts.push(noGenresStmt(db, now));
  await db.save(stmts);
}

// ---------- Push genre edits to Spotify (rename playlists) ----------

/** Create/rename playlists for one user right away. Returns false if it couldn't (will retry on next sync). */
export async function pushPlaylists(env: Env, userId: string): Promise<boolean> {
  const db = new Db(env.DB);
  const now = Date.now();
  const a = await db.batch([
    lockStmt(db, userId, now),
    db.stmt('SELECT * FROM tokens WHERE user_id = ?', userId),
    db.stmt('SELECT * FROM playlists WHERE user_id = ? ORDER BY slot', userId),
  ]);
  if (!a[0].meta.changes) return false;
  const tok = a[1].results[0] as TokenRow | undefined;
  const rows = a[2].results as PlaylistRow[];
  const ch = noChanges();
  const spotify = tok ? new Spotify(env, tok, new Budget(FETCH_BUDGET)) : null;
  let ok = !!spotify;
  try {
    if (spotify) await ensurePlaylists(env, spotify, rows, ch);
  } catch (e) {
    ok = false;
    console.log(`playlist update failed for ${userId}: ${e instanceof Error ? e.message : e}`);
  } finally {
    await db.save([
      ...playlistStmts(db, rows, ch),
      ...(spotify?.changed ? [tokenStmt(db, userId, spotify)] : []),
      db.stmt('UPDATE users SET lock_until = NULL WHERE id = ?', userId),
    ]);
  }
  return ok;
}

// ---------- New user setup (called from the OAuth callback) ----------

interface RankedArtist {
  id: string;
  name: string;
  genres?: string[]; // undefined = not asked Spotify yet
}

/**
 * Pick a new user's 6 buckets from /me/top/artists (medium_term, + long_term if needed).
 * Falls back to recently-played artists if top artists isn't available. Fills up from the
 * most popular buckets when there aren't 6 clear ones. Returns artists worth caching too.
 */
export async function pickGenres(
  env: Env,
  db: Db,
  budget: Budget,
  spotify: Spotify,
  ctx: LookupCtx,
): Promise<{ buckets: string[]; artists: Artist[] }> {
  let ranked: RankedArtist[] = [];
  const distinct = (list: RankedArtist[]) => new Set(list.flatMap((a) => bucketsFor(a.genres ?? []))).size;
  try {
    ranked = await spotify.topArtists('medium_term');
    if (distinct(ranked) < GENRE_SLOTS) {
      const seen = new Set(ranked.map((a) => a.id));
      ranked.push(...(await spotify.topArtists('long_term')).filter((a: SpotifyArtist) => !seen.has(a.id)));
    }
  } catch (e) {
    if (e instanceof OutOfBudget) throw e;
    console.log(`top artists unavailable: ${e instanceof Error ? e.message : e}`);
  }
  if (!ranked.length) {
    try {
      const seen = new Set<string>();
      for (const p of await spotify.recentlyPlayed(null)) {
        const a = p.track?.artists[0];
        if (a?.id && !seen.has(a.id)) {
          seen.add(a.id);
          ranked.push({ id: a.id, name: a.name });
        }
      }
    } catch (e) {
      if (e instanceof OutOfBudget) throw e;
    }
  }

  if (ranked.length && ranked.every((a) => !('genres' in a))) {
    ctx.sawNoGenres = true; // top artists came back without genres too: go straight to Last.fm
    ctx.useSpotify = false;
  }
  const cached = await loadArtists(db, ranked.map((a) => a.id));
  const toCache: Artist[] = [];
  // Look up artists Spotify gave no genres for, keeping 8 fetches for playlist creation.
  // Five at a time to stay polite with Last.fm's rate limit.
  let spare = budget.left - (MISC_SLOT + 1) - 1;
  const lookup = async (a: RankedArtist): Promise<string[]> => {
      if (a.genres?.length) {
        toCache.push({ id: a.id, name: a.name, genres: a.genres, source: 'spotify' });
        return a.genres;
      }
      const hit = cached.get(a.id);
      if (hit) return hit.genres;
      const cost = a.genres || !ctx.useSpotify ? 1 : ARTIST_COST;
      if (spare < cost) return [];
      spare -= cost;
      try {
        const r = await resolveArtist(env, budget, spotify, a.id, a.name, a.genres, ctx);
        toCache.push(r);
        return r.genres;
      } catch {
        return [];
      }
  };
  const genresByRank: string[][] = [];
  for (let i = 0; i < ranked.length; i += 5) genresByRank.push(...(await Promise.all(ranked.slice(i, i + 5).map(lookup))));
  return { buckets: pickTopBuckets(genresByRank, GENRE_SLOTS), artists: toCache };
}

export interface NewUser {
  id: string;
  accountId: string | null;
  name: string;
  tokens: Tokens;
  inviteHash: string | null;
  meta: Record<string, string>;
}

/** Store a new user and create their 7 playlists. Throws if the invite was used in the meantime. */
export async function createUser(env: Env, db: Db, budget: Budget, spotify: Spotify, u: NewUser): Promise<void> {
  const now = Date.now();
  const ctx = lookupCtx(u.meta, now);
  const { buckets, artists } = await pickGenres(env, db, budget, spotify, ctx);
  const rows = initialPlaylists(u.id, buckets);
  const t = spotify.tokens;
  const res = await db.batch([
    ...(u.inviteHash
      ? [db.stmt('UPDATE invites SET used_at = ?, used_by = ? WHERE code_hash = ? AND used_at IS NULL AND expires_at > ?', now, u.id, u.inviteHash, now)]
      : []),
    // Locked while we create playlists so a cron run can't create duplicates.
    db.stmt(
      "INSERT INTO users (id, account_id, display_name, status, created_at, lock_until) VALUES (?, ?, ?, 'active', ?, ?)",
      u.id,
      u.accountId,
      u.name,
      now,
      now + LOCK_MS,
    ),
    db.stmt('INSERT INTO tokens (user_id, access_token, refresh_token, expires_at) VALUES (?, ?, ?, ?)', u.id, t.access_token, t.refresh_token, t.expires_at),
    ...rows.map((p) => db.stmt('INSERT INTO playlists (user_id, slot, bucket) VALUES (?, ?, ?)', u.id, p.slot, p.bucket)),
    ...artists.map((x) => upsertArtist(db, x, now)),
  ]);
  if (u.inviteHash && !res[0].meta.changes) {
    await deleteUserData(db, u.id);
    throw new Error('This invite link was already used or has expired.');
  }

  const ch = noChanges();
  try {
    await ensurePlaylists(env, spotify, rows, ch);
  } catch (e) {
    // Anything not created now gets created by the next sync.
    console.log(`playlist creation incomplete for ${u.id}: ${e instanceof Error ? e.message : e}`);
  } finally {
    await db.save([
      ...playlistStmts(db, rows, ch),
      ...(spotify.changed ? [tokenStmt(db, u.id, spotify)] : []),
      db.stmt('UPDATE users SET lock_until = NULL WHERE id = ?', u.id),
      ...(ctx.sawNoGenres ? [noGenresStmt(db, now)] : []),
    ]);
  }
}

export function deleteUserData(db: Db, userId: string): Promise<D1Result[]> {
  return db.batch([
    db.stmt('DELETE FROM tracks WHERE user_id = ?', userId),
    db.stmt('DELETE FROM playlists WHERE user_id = ?', userId),
    db.stmt('DELETE FROM tokens WHERE user_id = ?', userId),
    db.stmt('DELETE FROM invites WHERE used_by = ?', userId),
    db.stmt('DELETE FROM users WHERE id = ?', userId),
  ]);
}

