// Sessions (HMAC-signed cookies), Spotify OAuth (Authorization Code flow), invites, admin role.
import { Budget, Db, FETCH_BUDGET, getMeta } from './budget';
import { landingPage, messagePage } from './html';
import { RateLimited, Spotify, SpotifyError, authorizeUrl, exchangeCode } from './spotify';
import { createUser } from './sync';
import { Env, InviteRow, MAX_USERS, UserRow } from './types';

const SESSION_COOKIE = 'al_session';
const OAUTH_COOKIE = 'al_oauth';
const SESSION_DAYS = 30;
export const INVITE_DAYS = 7;

// ---------- Small crypto helpers ----------

const enc = new TextEncoder();

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function randomToken(bytes = 16): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function sha256(s: string): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacKey(env: Env): Promise<CryptoKey> {
  if (!env.SESSION_SECRET) throw new Error('SESSION_SECRET is not set');
  return crypto.subtle.importKey('raw', enc.encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

/** "value.signature" — value must not contain secrets; it's only tamper-proof, not hidden. */
async function sign(env: Env, value: string): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(env), enc.encode(value));
  return `${value}.${b64url(sig)}`;
}

async function unsign(env: Env, signed: string | undefined): Promise<string | null> {
  if (!signed) return null;
  const i = signed.lastIndexOf('.');
  if (i < 0) return null;
  const value = signed.slice(0, i);
  let sig: Uint8Array;
  try {
    sig = Uint8Array.from(atob(signed.slice(i + 1).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
  // crypto.subtle.verify compares in constant time.
  return (await crypto.subtle.verify('HMAC', await hmacKey(env), sig, enc.encode(value))) ? value : null;
}

// ---------- Cookies ----------

export function getCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.get('Cookie') ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

function cookie(req: Request, name: string, value: string, maxAge: number): string {
  // Secure everywhere except plain-http local dev (http://127.0.0.1:8787).
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

// ---------- Sessions ----------

export async function sessionUserId(env: Env, req: Request): Promise<string | null> {
  const v = await unsign(env, getCookie(req, SESSION_COOKIE));
  if (!v) return null;
  const [uid, exp] = v.split('|');
  return uid && Number(exp) > Date.now() ? uid : null;
}

async function sessionCookie(env: Env, req: Request, userId: string): Promise<string> {
  const exp = Date.now() + SESSION_DAYS * 86400_000;
  return cookie(req, SESSION_COOKIE, await sign(env, `${userId}|${exp}`), SESSION_DAYS * 86400);
}

export function logoutCookie(req: Request): string {
  return cookie(req, SESSION_COOKIE, '', 0);
}

// ---------- Admin role ----------

/** The admin is ADMIN_SPOTIFY_ID if set (matched against id or account_id), else the first account to connect. */
export function isAdmin(env: Env, meta: Record<string, string>, user: Pick<UserRow, 'id' | 'account_id'>): boolean {
  const configured = env.ADMIN_SPOTIFY_ID?.trim();
  if (configured) return user.id === configured || user.account_id === configured;
  return meta.admin_id === user.id;
}

// ---------- Invites ----------

/** An unused, unexpired invite, while there's still a free seat. */
export async function findInvite(db: Db, code: string): Promise<InviteRow | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(code)) return null;
  const now = Date.now();
  const [inv, users] = await db.batch([
    db.stmt('SELECT * FROM invites WHERE code_hash = ? AND used_at IS NULL AND expires_at > ?', await sha256(code), now),
    db.stmt('SELECT COUNT(*) AS n FROM users'),
  ]);
  const row = inv.results[0] as InviteRow | undefined;
  const n = (users.results[0] as { n: number }).n;
  return row && n < MAX_USERS ? row : null;
}

export async function invitePage(env: Env, req: Request, code: string): Promise<Response> {
  const inv = await findInvite(new Db(env.DB), code);
  if (!inv) return html(messagePage('Invite not valid', 'This invite link has expired, was already used, or Autolist is full. Ask the admin for a new one.'), 404);
  return html(landingPage({ invitedAs: inv.label, loginHref: `/login?invite=${encodeURIComponent(code)}` }));
}

// ---------- OAuth ----------

function redirectUri(req: Request): string {
  return `${new URL(req.url).origin}/callback`;
}

export async function login(env: Env, req: Request): Promise<Response> {
  const invite = new URL(req.url).searchParams.get('invite') ?? '';
  const state = randomToken();
  // The state (and invite code, if any) ride in a short-lived signed cookie; /callback checks both.
  const value = await sign(env, `${state}|${invite}|${Date.now() + 10 * 60_000}`);
  return new Response(null, {
    status: 302,
    headers: { Location: authorizeUrl(env, redirectUri(req), state), 'Set-Cookie': cookie(req, OAUTH_COOKIE, value, 600) },
  });
}

export async function callback(env: Env, req: Request): Promise<Response> {
  const url = new URL(req.url);
  const clearOauth = cookie(req, OAUTH_COOKIE, '', 0);
  const fail = (title: string, msg: string, status = 400) => {
    const r = html(messagePage(title, msg, { href: '/', text: 'Back' }), status);
    r.headers.append('Set-Cookie', clearOauth);
    return r;
  };

  if (url.searchParams.get('error')) return fail('Spotify login cancelled', 'Spotify said: ' + url.searchParams.get('error'));
  const saved = await unsign(env, getCookie(req, OAUTH_COOKIE));
  const [state, inviteCode, exp] = (saved ?? '').split('|');
  if (!saved || !state || state !== url.searchParams.get('state') || Number(exp) < Date.now())
    return fail('Login expired', 'That login attempt expired or came from another browser. Please try again.');
  const code = url.searchParams.get('code');
  if (!code) return fail('Login failed', 'Spotify did not return a code.');

  const db = new Db(env.DB);
  const budget = new Budget(FETCH_BUDGET);
  try {
    const tokens = await exchangeCode(env, budget, code, redirectUri(req));
    const spotify = new Spotify(env, tokens, budget);
    let me: Awaited<ReturnType<Spotify['me']>>;
    try {
      me = await spotify.me();
    } catch (e) {
      if (e instanceof SpotifyError && e.status === 403)
        return fail(
          "Spotify didn't let you in",
          'This app is in Spotify development mode. Ask the admin to add your name and Spotify email in the Spotify Developer Dashboard → User Management, then try again.',
          403,
        );
      throw e;
    }
    const name = me.display_name || me.id;
    const accountId = me.account_id ?? null;

    const [existingR, countR] = await db.batch([
      db.stmt('SELECT * FROM users WHERE id = ?', me.id),
      db.stmt('SELECT COUNT(*) AS n FROM users'),
    ]);
    const meta = await getMeta(db);
    const existing = existingR.results[0] as UserRow | undefined;
    const userCount = (countR.results[0] as { n: number }).n;

    if (existing) {
      // Reconnect / log in again: store fresh tokens, clear "needs reconnect" (paused stays paused).
      await db.batch([
        db.stmt(
          `INSERT INTO tokens (user_id, access_token, refresh_token, expires_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(user_id) DO UPDATE SET access_token = excluded.access_token,
             refresh_token = excluded.refresh_token, expires_at = excluded.expires_at`,
          me.id,
          spotify.tokens.access_token,
          spotify.tokens.refresh_token,
          spotify.tokens.expires_at,
        ),
        db.stmt(
          "UPDATE users SET display_name = ?, account_id = ?, status = CASE WHEN status = 'needs_reconnect' THEN 'active' ELSE status END WHERE id = ?",
          name,
          accountId,
          me.id,
        ),
      ]);
    } else {
      const configured = env.ADMIN_SPOTIFY_ID?.trim();
      const becomesAdmin = configured ? isAdmin(env, meta, { id: me.id, account_id: accountId }) : !meta.admin_id && userCount === 0;
      let inviteHash: string | null = null;
      if (!becomesAdmin) {
        const inv = inviteCode ? await findInvite(db, inviteCode) : null;
        if (!inv) return fail('Invite only', 'Autolist is invite-only. Ask the admin for an invite link, then open it to connect.', 403);
        inviteHash = inv.code_hash;
      }
      if (userCount >= MAX_USERS) return fail('Autolist is full', `Spotify development mode allows ${MAX_USERS} users and they're all taken.`, 403);
      await createUser(env, db, budget, spotify, { id: me.id, accountId, name, tokens, inviteHash, meta });
      // First one wins: never replace an admin that's already recorded.
      if (becomesAdmin && !configured) await db.run("INSERT OR IGNORE INTO meta (key, value) VALUES ('admin_id', ?)", me.id);
    }

    const res = new Response(null, { status: 302, headers: { Location: existing ? '/' : '/?flash=welcome' } });
    res.headers.append('Set-Cookie', await sessionCookie(env, req, me.id));
    res.headers.append('Set-Cookie', clearOauth);
    return res;
  } catch (e) {
    if (e instanceof RateLimited) return fail('Spotify is busy', 'Spotify is rate-limiting this app right now. Try again in a few minutes.', 503);
    console.log(`callback error: ${e instanceof Error ? e.message : e}`);
    return fail('Login failed', e instanceof Error ? e.message : 'Something went wrong talking to Spotify.', 500);
  }
}

export function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin',
    },
  });
}
