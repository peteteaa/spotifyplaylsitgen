import type {
  AdminUserView,
  AdminView,
  GenresEditView,
  HomeView,
  PlaylistView,
  SyncInfo,
} from './types';

export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const APP = 'Autolist';
const REMINDER =
  "Also add this person's name and Spotify email in your Spotify Developer Dashboard → User Management, or their login will fail.";

const CSS = `
:root{--bg:#f5f6f5;--card:#fff;--text:#1a1f1c;--muted:#66706a;--line:#dde2de;--accent:#1a9e4b;--accent-text:#fff;--danger:#c62828;--warn-bg:#fff4d6;--warn:#8a5a00;--bad-bg:#fde7e7;--ok-bg:#e3f5e9}
@media(prefers-color-scheme:dark){:root{--bg:#111513;--card:#1a1f1c;--text:#e8ece9;--muted:#9aa49e;--line:#2b332e;--accent:#2ec866;--accent-text:#06210f;--danger:#ff6b6b;--warn-bg:#3a2f10;--warn:#f0c15a;--bad-bg:#3d1b1b;--ok-bg:#16301f}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:640px;margin:0 auto;padding:16px}
h1{font-size:1.4rem;margin:0}h2{font-size:1.05rem;margin:0 0 8px}
a{color:var(--accent)}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px;margin:0 0 14px;overflow-wrap:anywhere}
header.top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:8px;margin-bottom:14px}
header.top .who{display:flex;flex-wrap:wrap;align-items:center;gap:12px}
.muted{color:var(--muted);font-size:.9rem}
.row{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 18px;border-radius:10px;border:2px solid var(--accent);background:var(--accent);color:var(--accent-text);font:inherit;font-weight:600;text-decoration:none;cursor:pointer}
.btn.secondary{background:transparent;color:var(--accent)}
.btn.danger{background:transparent;border-color:var(--danger);color:var(--danger)}
.btn.big{width:100%;min-height:56px;font-size:1.15rem}
.btn[disabled]{opacity:.5;cursor:not-allowed}
.linkbtn{min-height:44px;display:inline-flex;align-items:center}
.alert,.banner,.callout{border-radius:10px;padding:12px 14px;margin:0 0 14px}
.alert{background:var(--bad-bg);color:var(--danger)}
.banner{background:var(--ok-bg)}
.banner.warn,.callout{background:var(--warn-bg);color:var(--warn)}
.badge{display:inline-block;padding:2px 10px;border-radius:99px;font-size:.8rem;font-weight:600;background:var(--ok-bg);color:var(--accent)}
.badge.paused{background:var(--warn-bg);color:var(--warn)}
.badge.needs_reconnect{background:var(--bad-bg);color:var(--danger)}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.chip{background:var(--bg);border:1px solid var(--line);border-radius:99px;padding:2px 10px;font-size:.85rem}
.pl{padding:10px 0;border-top:1px solid var(--line)}
.pl:first-of-type{border-top:0}
.pl .warn{color:var(--warn);font-size:.9rem}
ul.plain{list-style:none;margin:0;padding:0}ul.plain li{padding:8px 0;border-top:1px solid var(--line)}ul.plain li:first-child{border-top:0}
.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;align-items:center}.actions form{margin:0}
input[type=text],select{width:100%;min-height:44px;padding:0 10px;font:inherit;color:var(--text);background:var(--bg);border:1px solid var(--line);border-radius:10px}
label{display:block;font-weight:600;margin:12px 0 4px}
`;

const SCRIPT = `
document.querySelectorAll('[data-ts]').forEach(function(el){
  var d=new Date(Number(el.dataset.ts)),t=d.toLocaleTimeString([],{hour:'numeric',minute:'2-digit'});
  el.textContent=d.toDateString()===new Date().toDateString()?'Today '+t
    :d.toLocaleDateString([],{month:'short',day:'numeric'})+', '+t;
});`;

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>${CSS}</style></head>
<body><main>${body}</main>
<script>${SCRIPT}</script></body></html>`;
}

function time(ms: number | null | undefined): string {
  if (ms == null) return 'never';
  const iso = new Date(ms).toISOString();
  return `<time datetime="${iso}" data-ts="${Number(ms)}">${iso.slice(0, 16).replace('T', ' ')} UTC</time>`;
}

function flashBanner(flash?: string): string {
  return flash ? `<div class="banner" role="status">${esc(flash)}</div>` : '';
}

function alertBox(error?: string): string {
  return error ? `<div class="alert" role="alert">${esc(error)}</div>` : '';
}

function badge(status: SyncInfo['status']): string {
  const label = status === 'needs_reconnect' ? 'needs reconnect' : status;
  return `<span class="badge ${esc(status)}">${esc(label)}</span>`;
}

function syncResult(s: SyncInfo): string {
  if (s.lastSyncAt == null) return 'never';
  const ok = s.lastSyncOk === false ? '<strong>error</strong>' : 'ok';
  const msg = s.lastSyncMsg ? ` — ${esc(s.lastSyncMsg)}` : '';
  return `${time(s.lastSyncAt)} · ${ok}${msg}`;
}

function counts(s: SyncInfo): string {
  return `${s.lastSyncAdded} added last run · ${s.totalAdded} total · ${s.pending} pending`;
}

function playlistRows(pls: PlaylistView[]): string {
  return pls
    .map(
      (p) => `<div class="pl"><div class="row"><strong>${esc(p.name)}</strong><span class="muted">${p.count} songs</span></div>
${p.url ? `<a class="linkbtn" href="${esc(p.url)}" target="_blank" rel="noopener">Open in Spotify</a>` : '<div class="muted">not created yet</div>'}
${p.full ? '<div class="warn">Full (9,900+) — no longer receiving songs</div>' : ''}</div>`,
    )
    .join('');
}

export function landingPage(opts: { error?: string; invitedAs?: string; loginHref?: string }): string {
  return layout(
    APP,
    `<h1>${APP}</h1>
<p class="muted">${APP} sorts what you listen to into 6 genre playlists + Misc, every 15 minutes.</p>
${opts.invitedAs ? `<div class="banner">You've been invited (as ${esc(opts.invitedAs)})</div>` : ''}
${alertBox(opts.error)}
<div class="card"><a class="btn big" href="${esc(opts.loginHref ?? '/login')}">Connect Spotify</a></div>`,
  );
}

export function homePage(v: HomeView): string {
  const s = v.sync;
  const paused = s.status === 'paused';
  const banner =
    s.status === 'needs_reconnect'
      ? `<div class="banner warn">Spotify access expired — <a href="/login">Reconnect</a></div>`
      : paused
        ? `<div class="banner warn">Syncing is paused by the admin</div>`
        : '';
  const recent = v.recent.length
    ? `<ul class="plain">${v.recent
        .map(
          (r) =>
            `<li>${esc(r.name)} — ${esc(r.artists)} → ${esc(r.playlistName)} <span class="muted">${time(r.addedAt)}</span></li>`,
        )
        .join('')}</ul>`
    : '<p class="muted">Nothing added yet. New songs show up here after the next sync.</p>';
  return layout(
    APP,
    `<header class="top"><h1>${APP}</h1><div class="who"><span>${esc(v.userName)}</span>
${v.isAdmin ? '<a class="linkbtn" href="/admin">Admin</a>' : ''}
<form method="post" action="/logout" style="margin:0"><button class="btn secondary" type="submit">Log out</button></form></div></header>
${flashBanner(v.flash)}${banner}
<div class="card"><h2>Sync</h2>
<div>Last sync: ${syncResult(s)}</div>
<div class="muted">${counts(s)}</div>
<div class="actions">${
      paused
        ? '<span class="muted">Sync now is unavailable while paused.</span>'
        : '<form method="post" action="/sync"><button class="btn" type="submit">Sync now</button></form>'
    }</div></div>
<div class="card"><h2>Playlists</h2>${playlistRows(v.playlists)}</div>
<div class="card"><h2>Recent adds</h2>${recent}</div>
<p><a class="linkbtn" href="/genres?user=${encodeURIComponent(v.userId)}">Edit my genres</a></p>`,
  );
}

function adminUserCard(u: AdminUserView): string {
  const s = u.sync;
  const hidden = `<input type="hidden" name="user" value="${esc(u.id)}">`;
  const confirmMsg = `Remove ${u.name}? Their Spotify playlists stay in their account but stop updating. Their tokens and Autolist data are deleted.`;
  const toggle =
    s.status === 'active'
      ? `<form method="post" action="/admin/user/pause">${hidden}<button class="btn secondary" type="submit">Pause</button></form>`
      : s.status === 'paused'
        ? `<form method="post" action="/admin/user/resume">${hidden}<button class="btn secondary" type="submit">Resume</button></form>`
        : '<span class="muted">they need to log in again</span>';
  const remove = u.isSelf
    ? ''
    : `<form method="post" action="/admin/user/remove" data-confirm="${esc(confirmMsg)}" onsubmit="return confirm(this.dataset.confirm)">${hidden}<button class="btn danger" type="submit">Remove</button></form>`;
  return `<div class="card"><div class="row"><h2>${esc(u.name)}</h2>${badge(s.status)}</div>
<div>Last sync: ${syncResult(s)}</div>
<div class="muted">${counts(s)}</div>
<div class="chips">${u.genres.map((g) => `<span class="chip">${esc(g)}</span>`).join('')}</div>
${playlistRows(u.playlists)}
<div class="actions">${toggle}
<a class="btn secondary" href="/genres?user=${encodeURIComponent(u.id)}">Edit genres</a>${remove}</div></div>`;
}

export function adminPage(v: AdminView): string {
  const invites = v.invites.length
    ? `<ul class="plain">${v.invites
        .map(
          (i) => `<li><div class="row"><div><strong>${esc(i.label)}</strong><div class="muted">expires ${time(i.expiresAt)}</div></div>
<form method="post" action="/admin/invite/revoke" style="margin:0"><input type="hidden" name="code_hash" value="${esc(i.codeHash)}"><button class="btn danger" type="submit">Revoke</button></form></div></li>`,
        )
        .join('')}</ul>`
    : '<p class="muted">No pending invites.</p>';
  return layout(
    'Admin',
    `<header class="top"><h1>Admin</h1><a class="linkbtn" href="/">← Back</a></header>
${flashBanner(v.flash)}
<div class="card"><h2>Seats</h2><div>${v.seatsUsed} / ${v.maxUsers} users</div>
<div class="muted">Seats = users + pending invites.</div></div>
<div class="card"><h2>Invite someone</h2>
<div class="callout">${esc(REMINDER)}</div>
${v.canInvite ? '' : `<p class="muted">All ${v.maxUsers} seats are taken. Remove a user or revoke an invite to free one.</p>`}
<form method="post" action="/admin/invite">
<input type="text" name="label" required maxlength="60" placeholder="Friend's name" aria-label="Friend's name"${v.canInvite ? '' : ' disabled'}>
<div class="actions"><button class="btn" type="submit"${v.canInvite ? '' : ' disabled'}>Create invite link</button></div></form></div>
<div class="card"><h2>Pending invites</h2>${invites}</div>
${v.users.map(adminUserCard).join('')}`,
  );
}

export function inviteCreatedPage(o: { link: string; label: string; expiresAt: number }): string {
  return layout(
    'Invite created',
    `<h1>Invite for ${esc(o.label)}</h1>
<div class="card"><p>Send this link. It's shown once — copy it now.</p>
<input type="text" id="link" readonly value="${esc(o.link)}" onclick="this.select()">
<div class="actions"><button class="btn" type="button" id="copy">Copy</button></div>
<p class="muted">Expires ${time(o.expiresAt)}</p></div>
<div class="callout">${esc(REMINDER)}</div>
<p><a class="linkbtn" href="/admin">← Back to admin</a></p>
<script>
document.getElementById('copy').addEventListener('click',function(){
  var i=document.getElementById('link'),b=this;i.select();
  (navigator.clipboard?navigator.clipboard.writeText(i.value):Promise.reject()).catch(function(){document.execCommand('copy')})
    .then(function(){b.textContent='Copied';});
});
</script>`,
  );
}

export function genresEditPage(v: GenresEditView): string {
  const selects = v.slots
    .map((cur, i) => {
      const opts = v.options
        .map((o) => `<option value="${esc(o)}"${o === cur ? ' selected' : ''}>${esc(o)}</option>`)
        .join('');
      return `<label for="slot${i}">#${i + 1}</label><select id="slot${i}" name="slot${i}">${opts}</select>`;
    })
    .join('');
  return layout(
    'Edit genres',
    `<h1>Genres for ${esc(v.userName)}</h1>
${alertBox(v.error)}
<p class="muted">Higher slots win when a song fits several. Changing a genre renames its Spotify playlist; songs already added stay where they are. Each genre can be used once.</p>
<form class="card" method="post" action="/genres"><input type="hidden" name="user" value="${esc(v.userId)}">
${selects}
<div class="actions"><button class="btn" type="submit">Save</button><a class="btn secondary" href="${esc(v.backUrl)}">Cancel</a></div></form>`,
  );
}

export function messagePage(
  title: string,
  message: string,
  link?: { href: string; text: string },
): string {
  return layout(
    title,
    `<h1>${esc(title)}</h1><div class="card"><p>${esc(message)}</p>${
      link ? `<a class="btn" href="${esc(link.href)}">${esc(link.text)}</a>` : ''
    }</div>`,
  );
}
