// Worker entry: pages + OAuth (fetch) and the 15-minute sync for everyone (scheduled).
import { createInvite, adminResponse, removeUser, revokeInvite, setPaused } from './admin';
import { callback, html, invitePage, isAdmin, login, logoutCookie, sessionUserId } from './auth';
import { Db } from './budget';
import { avatarSvg } from './avatars';
import { flashText, genresForm, homeResponse, pictureForm, redirect, savePicture, saveGenres } from './home';
import { landingPage, messagePage } from './html';
import { runScheduled, syncNow } from './sync';
import { Env, UserRow } from './types';

async function currentUser(env: Env, db: Db, req: Request) {
  const uid = await sessionUserId(env, req);
  if (!uid) return null;
  const [u, m] = await db.batch([
    db.stmt('SELECT * FROM users WHERE id = ?', uid),
    db.stmt("SELECT key, value FROM meta WHERE key = 'admin_id'"),
  ]);
  const user = u.results[0] as UserRow | undefined;
  if (!user) return null; // removed users lose access immediately
  const meta = Object.fromEntries((m.results as { key: string; value: string }[]).map((r) => [r.key, r.value]));
  return { user, admin: isAdmin(env, meta, user) };
}

async function route(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = req.method;

  if (method === 'GET' && path === '/login') return login(env, req);
  if (method === 'GET' && path === '/callback') return callback(env, req);
  if (method === 'GET' && path.startsWith('/invite/')) return invitePage(env, req, decodeURIComponent(path.slice(8)));
  if (path === '/favicon.ico') return new Response(null, { status: 204 });
  if (method === 'GET' && path.startsWith('/pfp/') && path.endsWith('.svg')) {
    const svg = avatarSvg(decodeURIComponent(path.slice(5, -4)));
    if (!svg) return new Response('Not found', { status: 404 });
    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
      },
    });
  }

  if (method === 'POST') {
    // SameSite=Lax already blocks cross-site POSTs carrying our cookie; this is a second check.
    const origin = req.headers.get('Origin');
    if (origin && origin !== url.origin) return html(messagePage('Blocked', 'Cross-site request refused.'), 403);
  } else if (method !== 'GET' && method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 });
  }

  const db = new Db(env.DB);
  const me = await currentUser(env, db, req);
  if (!me) {
    if (method === 'GET' && path === '/') return html(landingPage({}));
    if (method === 'POST') return html(messagePage('Logged out', 'Please log in again.', { href: '/', text: 'Home' }), 401);
    return redirect('/');
  }
  const { user, admin } = me;

  if (method === 'GET' && path === '/') return homeResponse(env, db, user, admin, flashText(url));

  if (method === 'POST' && path === '/logout') {
    return new Response(null, { status: 303, headers: { Location: '/', 'Set-Cookie': logoutCookie(req) } });
  }

  if (method === 'POST' && path === '/sync') {
    if (user.status !== 'active') return redirect('/');
    const r = await syncNow(env, user.id);
    return redirect(r.rateLimited ? '/?flash=limited' : r.ran ? `/?flash=synced&n=${r.added}` : '/?flash=busy');
  }

  if (path === '/picture') return method === 'POST' ? savePicture(db, user, await req.formData()) : pictureForm(user);

  if (path === '/genres') {
    const form = method === 'POST' ? await req.formData() : null;
    const target = String(form?.get('user') ?? url.searchParams.get('user') ?? user.id);
    if (target !== user.id && !admin) return html(messagePage('Not allowed', 'You can only edit your own genres.', { href: '/', text: 'Home' }), 403);
    const back = target === user.id ? '/' : '/admin';
    return form ? saveGenres(env, db, target, form, back) : genresForm(db, target, back);
  }

  if (path === '/admin' || path.startsWith('/admin/')) {
    if (!admin) return html(messagePage('Admins only', 'This page is for the Autolist admin.', { href: '/', text: 'Home' }), 403);
    if (method === 'GET' && path === '/admin') return adminResponse(env, db, user.id, flashText(url));
    if (method === 'POST') {
      const form = await req.formData();
      switch (path) {
        case '/admin/invite':
          return createInvite(db, url.origin, form);
        case '/admin/invite/revoke':
          return revokeInvite(db, form);
        case '/admin/user/remove':
          return removeUser(db, user.id, form);
        case '/admin/user/pause':
          return setPaused(db, form, true);
        case '/admin/user/resume':
          return setPaused(db, form, false);
      }
    }
  }

  return html(messagePage('Not found', "There's nothing here.", { href: '/', text: 'Home' }), 404);
}

export default {
  async fetch(req, env, ctx): Promise<Response> {
    // Keep running if the browser disconnects mid-request (e.g. tab closed during "Sync now" or
    // login), so a sync or playlist setup always reaches its save step.
    const work = route(req, env);
    ctx.waitUntil(work.catch(() => undefined));
    try {
      return await work;
    } catch (e) {
      console.log(`request error on ${new URL(req.url).pathname}: ${e instanceof Error ? e.message : e}`);
      return html(messagePage('Something went wrong', 'Please try again in a moment.', { href: '/', text: 'Home' }), 500);
    }
  },

  async scheduled(_controller, env): Promise<void> {
    await runScheduled(env);
  },
} satisfies ExportedHandler<Env>;
