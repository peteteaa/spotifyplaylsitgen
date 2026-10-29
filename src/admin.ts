// Admin page and actions. Callers must have checked the admin role server-side.
import { INVITE_DAYS, html, randomToken, sha256 } from './auth';
import { Db } from './budget';
import { adminPage, inviteCreatedPage, messagePage } from './html';
import { playlistViews, redirect, syncInfo } from './home';
import { deleteUserData } from './sync';
import { Env, GENRE_SLOTS, InviteRow, MAX_USERS, PlaylistRow, UserRow } from './types';

async function seats(db: Db) {
  const now = Date.now();
  const [u, i] = await db.batch([
    db.stmt('SELECT * FROM users ORDER BY created_at'),
    db.stmt('SELECT * FROM invites WHERE used_at IS NULL AND expires_at > ? ORDER BY created_at', now),
  ]);
  const users = u.results as UserRow[];
  const invites = i.results as InviteRow[];
  return { users, invites, used: users.length + invites.length };
}

export async function adminResponse(env: Env, db: Db, adminId: string, flash?: string): Promise<Response> {
  const { users, invites, used } = await seats(db);
  const [pl, pend] = await db.batch([
    db.stmt('SELECT * FROM playlists ORDER BY user_id, slot'),
    db.stmt("SELECT user_id, COUNT(*) AS n FROM tracks WHERE status IN ('pending', 'queued') GROUP BY user_id"),
  ]);
  const playlists = pl.results as PlaylistRow[];
  const pending = new Map((pend.results as { user_id: string; n: number }[]).map((r) => [r.user_id, r.n]));
  return html(
    adminPage({
      users: users.map((u) => {
        const mine = playlists.filter((p) => p.user_id === u.id);
        return {
          id: u.id,
          name: u.display_name,
          isSelf: u.id === adminId,
          sync: syncInfo(u, pending.get(u.id) ?? 0),
          genres: mine.filter((p) => p.slot < GENRE_SLOTS).map((p) => p.bucket),
          playlists: playlistViews(env, mine),
        };
      }),
      invites: invites.map((i) => ({ codeHash: i.code_hash, label: i.label, createdAt: i.created_at, expiresAt: i.expires_at })),
      seatsUsed: used,
      maxUsers: MAX_USERS,
      canInvite: used < MAX_USERS,
      flash,
    }),
  );
}

export async function createInvite(db: Db, origin: string, form: FormData): Promise<Response> {
  const label = String(form.get('label') ?? '').trim().slice(0, 60);
  if (!label) return html(messagePage('Name needed', "Give the invite a name so you know who it's for.", { href: '/admin', text: 'Back' }), 400);
  const code = randomToken(18);
  const now = Date.now();
  const expiresAt = now + INVITE_DAYS * 86400_000;
  // The seat check is part of the insert, so a double-submit can't go over the limit.
  const r = await db.run(
    `INSERT INTO invites (code_hash, label, created_at, expires_at)
     SELECT ?, ?, ?, ? WHERE (SELECT COUNT(*) FROM users)
       + (SELECT COUNT(*) FROM invites WHERE used_at IS NULL AND expires_at > ?) < ?`,
    await sha256(code),
    label,
    now,
    expiresAt,
    now,
    MAX_USERS,
  );
  if (!r.meta.changes)
    return html(messagePage('No seats left', `Spotify development mode allows ${MAX_USERS} users, counting you and pending invites.`, { href: '/admin', text: 'Back' }), 400);
  return html(inviteCreatedPage({ link: `${origin}/invite/${code}`, label, expiresAt }));
}

export async function revokeInvite(db: Db, form: FormData): Promise<Response> {
  await db.run('DELETE FROM invites WHERE code_hash = ? AND used_at IS NULL', String(form.get('code_hash') ?? ''));
  return redirect('/admin?flash=revoked');
}

export async function removeUser(db: Db, adminId: string, form: FormData): Promise<Response> {
  const id = String(form.get('user') ?? '');
  if (id === adminId) return html(messagePage("Can't remove yourself", 'The admin account stays connected.', { href: '/admin', text: 'Back' }), 400);
  await deleteUserData(db, id);
  return redirect('/admin?flash=removed');
}

export async function setPaused(db: Db, form: FormData, paused: boolean): Promise<Response> {
  const id = String(form.get('user') ?? '');
  if (paused) await db.run("UPDATE users SET status = 'paused' WHERE id = ? AND status = 'active'", id);
  else await db.run("UPDATE users SET status = 'active' WHERE id = ? AND status = 'paused'", id);
  return redirect(`/admin?flash=${paused ? 'paused' : 'resumed'}`);
}
