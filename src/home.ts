// Home dashboard and the genre editor (used by both a user for themselves and the admin).
import { html } from './auth';
import { Db } from './budget';
import { AVATARS, avatarFor } from './avatars';
import { BUCKETS } from './genres';
import { genresEditPage, homePage, messagePage, picturePage } from './html';
import { playlistName, pushPlaylists } from './sync';
import { Env, GENRE_SLOTS, MISC_SLOT, PLAYLIST_CAP, PlaylistRow, PlaylistView, SyncInfo, UserRow } from './types';

export const FLASH: Record<string, (n: number) => string> = {
  welcome: () => "You're connected and your 7 playlists are ready. Songs get sorted every 15 minutes, or press Sync now.",
  synced: (n) => `Sync finished: ${n} song${n === 1 ? '' : 's'} added.`,
  busy: () => 'A sync is already running. Try again in a minute.',
  limited: () => "Spotify is rate-limiting the app right now. Syncing resumes automatically.",
  genres: () => 'Genres saved and playlists renamed. New songs follow the new genres.',
  genres_later: () => "Genres saved. Spotify playlist names will update on the next sync.",
  paused: () => 'User paused.',
  resumed: () => 'User resumed.',
  removed: () => 'User removed. Their playlists stay in their Spotify account but no longer update.',
  revoked: () => 'Invite revoked.',
  picture: () => 'Picture updated.',
  adding_resumed: () => 'Adding resumed. New songs get sorted again.',
  playlist_paused: () => 'Playlist paused. Songs that would go to it are skipped until you resume it.',
  playlist_resumed: () => 'Playlist resumed.',
};

export function flashText(url: URL): string | undefined {
  const f = FLASH[url.searchParams.get('flash') ?? ''];
  return f?.(Number(url.searchParams.get('n') ?? 0));
}

export function syncInfo(u: UserRow, pending: number): SyncInfo {
  return {
    status: u.status,
    lastSyncAt: u.last_sync_at,
    lastSyncOk: u.last_sync_ok === null ? null : !!u.last_sync_ok,
    lastSyncMsg: u.last_sync_msg,
    lastSyncAdded: u.last_sync_added,
    totalAdded: u.total_added,
    pending,
    addingPaused: u.adding_paused_at != null,
  };
}

export function playlistViews(env: Env, rows: PlaylistRow[]): PlaylistView[] {
  return rows.map((p) => ({
    slot: p.slot,
    bucket: p.bucket,
    name: playlistName(env, p.bucket),
    url: p.spotify_id ? `https://open.spotify.com/playlist/${p.spotify_id}` : null,
    count: p.item_count,
    full: p.item_count >= PLAYLIST_CAP,
    paused: p.paused_at != null,
  }));
}

export async function homeResponse(env: Env, db: Db, user: UserRow, isAdmin: boolean, flash?: string): Promise<Response> {
  const [pl, recent, pending] = await db.batch([
    db.stmt('SELECT * FROM playlists WHERE user_id = ? ORDER BY slot', user.id),
    db.stmt(
      "SELECT name, artist_names, slot, added_at FROM tracks WHERE user_id = ? AND status = 'added' ORDER BY added_at DESC, played_at DESC LIMIT 10",
      user.id,
    ),
    db.stmt("SELECT COUNT(*) AS n FROM tracks WHERE user_id = ? AND status IN ('pending', 'queued')", user.id),
  ]);
  const playlists = playlistViews(env, pl.results as PlaylistRow[]);
  const nameOf = new Map(playlists.map((p) => [p.slot, p.name]));
  return html(
    homePage({
      userId: user.id,
      userName: user.display_name,
      avatar: avatarFor(user),
      isAdmin,
      sync: syncInfo(user, (pending.results[0] as { n: number }).n),
      playlists,
      recent: (recent.results as { name: string; artist_names: string; slot: number; added_at: number }[]).map((r) => ({
        name: r.name,
        artists: (JSON.parse(r.artist_names) as string[]).join(', '),
        playlistName: nameOf.get(r.slot) ?? '',
        addedAt: r.added_at,
      })),
      flash,
    }),
  );
}

// ---------- Profile picture ----------

export function pictureForm(user: UserRow): Response {
  return html(picturePage({ current: avatarFor(user), options: AVATARS }));
}

export async function savePicture(db: Db, user: UserRow, form: FormData): Promise<Response> {
  const id = String(form.get('avatar') ?? '');
  if (!AVATARS.some((a) => a.id === id)) return pictureForm(user);
  await db.run('UPDATE users SET avatar = ? WHERE id = ?', id, user.id);
  return redirect('/?flash=picture');
}

// ---------- Pausing (the user's own; the admin's pause is users.status) ----------

/** Pause or resume adding to all of the user's playlists. Pausing twice keeps the first start time. */
export async function setAddingPaused(db: Db, user: UserRow, paused: boolean): Promise<Response> {
  await db.run('UPDATE users SET adding_paused_at = CASE WHEN ? THEN COALESCE(adding_paused_at, ?) END WHERE id = ?', paused ? 1 : 0, Date.now(), user.id);
  return redirect(paused ? '/' : '/?flash=adding_resumed'); // paused: the home page's banner says so
}

/** Pause or resume adding to one of the user's playlists (form field `slot`, 0-6). */
export async function setPlaylistPaused(db: Db, user: UserRow, form: FormData, paused: boolean): Promise<Response> {
  const slot = Number(form.get('slot'));
  if (!Number.isInteger(slot) || slot < 0 || slot > MISC_SLOT) return redirect('/');
  await db.run(
    'UPDATE playlists SET paused_at = CASE WHEN ? THEN COALESCE(paused_at, ?) END WHERE user_id = ? AND slot = ?',
    paused ? 1 : 0,
    Date.now(),
    user.id,
    slot,
  );
  return redirect(`/?flash=${paused ? 'playlist_paused' : 'playlist_resumed'}`);
}

// ---------- Genre editor ----------

async function loadTarget(db: Db, targetId: string) {
  const [u, pl] = await db.batch([
    db.stmt('SELECT * FROM users WHERE id = ?', targetId),
    db.stmt('SELECT * FROM playlists WHERE user_id = ? AND slot < ? ORDER BY slot', targetId, GENRE_SLOTS),
  ]);
  return { user: u.results[0] as UserRow | undefined, rows: pl.results as PlaylistRow[] };
}

export async function genresForm(db: Db, targetId: string, backUrl: string, error?: string, slots?: string[]): Promise<Response> {
  const { user, rows } = await loadTarget(db, targetId);
  if (!user) return html(messagePage('Not found', 'That user no longer exists.', { href: backUrl, text: 'Back' }), 404);
  return html(
    genresEditPage({
      userId: user.id,
      userName: user.display_name,
      slots: slots ?? rows.map((r) => r.bucket),
      options: BUCKETS,
      backUrl,
      error,
    }),
    error ? 400 : 200,
  );
}

/** Save new buckets; changed slots get renamed on Spotify now (or on the next sync if that fails). */
export async function saveGenres(env: Env, db: Db, targetId: string, form: FormData, backUrl: string): Promise<Response> {
  const picked = Array.from({ length: GENRE_SLOTS }, (_, i) => String(form.get(`slot${i}`) ?? ''));
  if (picked.some((b) => !BUCKETS.includes(b))) return genresForm(db, targetId, backUrl, 'Pick a genre for every slot.', picked);
  if (new Set(picked).size !== picked.length) return genresForm(db, targetId, backUrl, 'Each genre can only be used once.', picked);

  const { user, rows } = await loadTarget(db, targetId);
  if (!user) return html(messagePage('Not found', 'That user no longer exists.', { href: backUrl, text: 'Back' }), 404);
  const changed = rows.filter((r) => r.bucket !== picked[r.slot]);
  if (changed.length) {
    await db.batch([
      ...changed.map((r) =>
        db.stmt('UPDATE playlists SET bucket = ?, name_synced = 0 WHERE user_id = ? AND slot = ?', picked[r.slot], targetId, r.slot),
      ),
      // Songs placed but not yet added get re-sorted under the new genres.
      db.stmt("UPDATE tracks SET status = 'pending', slot = NULL WHERE user_id = ? AND status = 'queued'", targetId),
    ]);
  }
  const ok = !changed.length || (await pushPlaylists(env, targetId));
  return redirect(`${backUrl}?flash=${ok ? 'genres' : 'genres_later'}`);
}

export function redirect(location: string): Response {
  return new Response(null, { status: 303, headers: { Location: location } });
}
