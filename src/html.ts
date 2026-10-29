import type {
  AdminUserView,
  AdminView,
  GenresEditView,
  HomeView,
  PictureView,
  PlaylistView,
  SyncInfo,
} from './types';
import { ART_CSS, BACKGROUND_ART } from './art';
import { pfpUrl } from './avatars';

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
/* Frutiger Aero: sky, water, glass and gloss (think Vista / Wii / early-2010s). */
:root{--text:#0b2c4d;--muted:#3d6185;--glass:rgba(255,255,255,.52);--glass-edge:rgba(255,255,255,.85);--line:rgba(255,255,255,.7);--link:#0a6fc2;
--sky1:#1e8ee6;--sky2:#7fd0ff;--sky3:#dff6ff;--hill1:#8be04e;--hill2:#3fae2a;--hill3:#a6e6a8;--hill4:#4fb57e;--grass1:#b8f574;--grass2:#4fbf2a;
--aqua1:#9be8ff;--aqua2:#33b6f2;--aqua3:#0b84d4;--green1:#b4f27a;--green2:#5ccc2e;--green3:#2f9a17;
--win-bg:#f0f0f0;--win-text:#1e1e1e;--box1:#c3f4ee;--box2:#f3fffd;--box-edge:#9aa9b3;--menu1:#fbfdff;--menu2:#e2ebf7;--menu-text:#14263a;
--danger:#d8341f;--warn:#7a4b00;--warn-bg:rgba(255,228,140,.6);--bad-bg:rgba(255,190,180,.6);--ok-bg:rgba(190,255,170,.55);--shadow:rgba(10,70,140,.25)}
@media(prefers-color-scheme:dark){:root{--text:#e9f7ff;--muted:#a9cde9;--glass:rgba(10,40,80,.5);--glass-edge:rgba(140,210,255,.45);--line:rgba(140,210,255,.25);--link:#7fd6ff;
--sky1:#020f2a;--sky2:#063a6e;--sky3:#0b6b8f;--hill3:#134d40;--hill4:#0a2e26;--grass1:#2f9a4c;--grass2:#145a2a;--win-bg:#1b2430;--win-text:#e6eef7;--box1:#143e4c;--box2:#17303c;--box-edge:#3d5566;--menu1:#2d3c4e;--menu2:#1e2a38;--menu-text:#dbe7f3;--hill1:#1f7a3a;--hill2:#0c4a22;--warn:#ffd77a;--warn-bg:rgba(120,90,10,.5);--bad-bg:rgba(130,30,30,.5);--ok-bg:rgba(30,110,50,.45);--shadow:rgba(0,0,0,.45)}}
*{box-sizing:border-box}
html{background:var(--sky1)}
body{margin:0;min-height:100vh;color:var(--text);font:16px/1.45 "Nunito","Segoe UI","Frutiger",system-ui,sans-serif;overflow-x:hidden}
.aero{position:fixed;inset:0;z-index:-1;overflow:hidden;pointer-events:none;
background:radial-gradient(60% 40% at 80% 0%,rgba(255,255,255,.55),transparent 70%),
linear-gradient(180deg,var(--sky1) 0%,var(--sky2) 55%,var(--sky3) 78%)}
.aero::after{content:"";position:absolute;inset:-20% -10% auto;height:60%;-webkit-mask-image:linear-gradient(#000 40%,transparent);mask-image:linear-gradient(#000 40%,transparent);background:conic-gradient(from 200deg at 85% 0%,transparent 0 20deg,rgba(255,255,255,.18) 25deg,transparent 35deg,rgba(255,255,255,.12) 45deg,transparent 55deg)}
.aero i{position:absolute;bottom:-80px;border-radius:50%;background:radial-gradient(circle at 32% 28%,rgba(255,255,255,.95) 0 8%,rgba(255,255,255,.25) 22%,rgba(160,230,255,.12) 55%,rgba(255,255,255,.5) 72%,transparent 74%);box-shadow:inset 0 0 12px rgba(255,255,255,.35);animation:rise linear infinite}
.aero i:nth-of-type(1){left:6%;width:46px;height:46px;animation-duration:19s}
.aero i:nth-of-type(2){left:22%;width:22px;height:22px;animation-duration:13s;animation-delay:-6s}
.aero i:nth-of-type(3){left:41%;width:70px;height:70px;animation-duration:26s;animation-delay:-14s}
.aero i:nth-of-type(4){left:63%;width:30px;height:30px;animation-duration:16s;animation-delay:-3s}
.aero i:nth-of-type(5){left:78%;width:54px;height:54px;animation-duration:22s;animation-delay:-10s}
.aero i:nth-of-type(6){left:91%;width:18px;height:18px;animation-duration:12s;animation-delay:-8s}
@keyframes rise{from{transform:translate(0,0)}50%{transform:translate(14px,-55vh)}to{transform:translate(-8px,-115vh)}}
@media(prefers-reduced-motion:reduce){.aero i{animation:none;bottom:auto;top:calc(20% + var(--y,0px))}}
main{max-width:640px;margin:0 auto;padding:16px}
h1{font-size:1.6rem;margin:0;font-weight:800;letter-spacing:.01em;color:#fff;text-shadow:0 1px 0 rgba(0,60,120,.5),0 0 18px rgba(255,255,255,.6)}
h2{font-size:1.05rem;margin:0 0 8px;font-weight:600}
main>h1{margin:6px 0 14px}
main>p,main>p a,main>a,main>.muted{color:#fff;text-shadow:0 1px 2px rgba(0,50,100,.65)}
a{color:var(--link)}
.muted{color:var(--muted);font-size:.9rem}
.row{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}
.btn{position:relative;overflow:hidden;display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 22px;border-radius:999px;font:inherit;font-weight:700;text-decoration:none;cursor:pointer;color:#fff;text-shadow:0 1px 1px rgba(0,40,90,.55);
border:1px solid var(--green3);background:linear-gradient(180deg,var(--green1),var(--green2) 50%,var(--green3) 51%,var(--green2));
box-shadow:inset 0 1px 0 rgba(255,255,255,.8),inset 0 -2px 6px rgba(255,255,255,.35),0 3px 10px var(--shadow)}
.btn::before{content:"";position:absolute;left:8%;right:8%;top:2px;height:45%;border-radius:999px;background:linear-gradient(rgba(255,255,255,.85),rgba(255,255,255,.1));pointer-events:none}
.btn:hover{filter:brightness(1.08) saturate(1.1)}.btn:active{filter:brightness(.95);transform:translateY(1px)}
.btn:focus-visible,input:focus-visible,select:focus-visible{outline:none;box-shadow:0 0 0 3px rgba(80,200,255,.7),0 0 14px rgba(80,200,255,.8)}
.btn.secondary{color:#fff;border-color:var(--aqua3);background:linear-gradient(180deg,var(--aqua1),var(--aqua2) 50%,var(--aqua3) 51%,var(--aqua2))}
.btn.danger{color:#fff;border-color:#a3200f;background:linear-gradient(180deg,#ffb09a,#f05a3c 50%,#c9301a 51%,#ef5b3d)}
.btn.big{width:100%;min-height:58px;font-size:1.2rem}
.btn.small{min-height:36px;padding:0 16px;font-size:.9rem}
.btn[disabled]{filter:grayscale(.8);opacity:.6;cursor:not-allowed}
.linkbtn{min-height:44px;display:inline-flex;align-items:center;font-weight:600}
.alert,.banner,.callout{border-radius:14px;padding:12px 14px;margin:0 0 14px;border:1px solid var(--glass-edge);box-shadow:inset 0 1px 0 rgba(255,255,255,.7);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.alert{background:var(--bad-bg);color:var(--danger);font-weight:600}
.banner{background:var(--ok-bg)}
.banner.warn,.callout{background:var(--warn-bg);color:var(--warn)}
.badge{display:inline-block;padding:2px 12px;border-radius:99px;font-size:.8rem;font-weight:700;color:#fff;text-shadow:0 1px 1px rgba(0,0,0,.35);border:1px solid var(--green3);background:linear-gradient(180deg,var(--green1),var(--green2) 50%,var(--green3) 51%,var(--green2));box-shadow:inset 0 1px 0 rgba(255,255,255,.7)}
.badge.paused{border-color:#b07a00;background:linear-gradient(180deg,#ffe58a,#ffc21a 50%,#e09a00 51%,#ffc21a)}
.badge.needs_reconnect{border-color:#a3200f;background:linear-gradient(180deg,#ffb09a,#f05a3c 50%,#c9301a 51%,#ef5b3d)}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}
.chip{background:linear-gradient(180deg,rgba(255,255,255,.9),rgba(200,235,255,.6));border:1px solid var(--glass-edge);border-radius:99px;padding:2px 12px;font-size:.85rem;color:#0b4a80;box-shadow:inset 0 1px 0 #fff,0 1px 3px var(--shadow)}
.pl{padding:10px 0;border-top:1px solid var(--line)}
.pl:first-of-type{border-top:0}
.pl .warn{color:var(--warn);font-size:.9rem;font-weight:600}
ul.plain{list-style:none;margin:0;padding:0}ul.plain li{padding:8px 0;border-top:1px solid var(--line)}ul.plain li:first-child{border-top:0}
.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;align-items:center}.actions form{margin:0}
input[type=text],select{width:100%;min-height:44px;padding:0 14px;font:inherit;color:#0b2c4d;background:linear-gradient(180deg,#e9f6ff,#fff 40%);border:1px solid #8cc6ec;border-radius:12px;box-shadow:inset 0 2px 4px rgba(10,80,150,.15)}
label{display:block;font-weight:600;margin:12px 0 4px}
/* Windows 7 Aero windows, like frutiger-aero.org: glass frame, title bar, caption buttons, grey body. */
.win{position:relative;margin:0 0 16px;padding:0 6px 6px;border:1px solid rgba(0,20,50,.7);border-radius:8px 8px 6px 6px;
background:linear-gradient(180deg,rgba(190,218,242,.9),rgba(135,180,224,.82) 29px,rgba(150,192,232,.8));
box-shadow:inset 0 0 0 1px rgba(255,255,255,.7),0 8px 26px rgba(0,30,70,.45);-webkit-backdrop-filter:blur(10px) saturate(1.5);backdrop-filter:blur(10px) saturate(1.5)}
.win::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:linear-gradient(110deg,transparent 0 16%,rgba(255,255,255,.3) 21%,transparent 29%,transparent 56%,rgba(255,255,255,.2) 61%,transparent 67%)}
.win>*{position:relative}
.win-title{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;min-height:30px}
.win-title h1,.win-title h2{margin:0;padding:6px 2px 0;font-size:.9rem;font-weight:600;letter-spacing:0;color:#0a1a2a;text-shadow:0 0 6px #fff,0 0 10px #fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.caption{display:flex;flex:none;margin-top:-1px;border:1px solid rgba(0,20,50,.7);border-top:0;border-radius:0 0 6px 6px;overflow:hidden;box-shadow:0 1px 0 rgba(255,255,255,.6)}
.caption i{position:relative;display:block;width:27px;height:19px;border-left:1px solid rgba(0,20,50,.45);background:linear-gradient(180deg,#e8f1fb,#c6daef 45%,#a2bfe2 50%,#c4ddf6);box-shadow:inset 0 0 0 1px rgba(255,255,255,.55)}
.caption i:first-child{border-left:0}
.caption i.close{width:45px;background:linear-gradient(180deg,#f3b9a8,#de7c62 45%,#c8432a 50%,#e2694c)}
.caption i::after{content:"";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)}
.caption i.min::after{width:9px;height:3px;margin-top:3px;background:#fff;box-shadow:0 0 0 1px rgba(0,30,70,.6)}
.caption i.max::after{width:7px;height:5px;border:1px solid #fff;border-top-width:2px;box-shadow:0 0 0 1px rgba(0,30,70,.6)}
.caption i.close::after{content:"✕";font:700 12px/1 sans-serif;color:#fff;text-shadow:0 0 2px rgba(90,0,0,.9),0 0 1px #000}
.win-body{background:var(--win-bg);color:var(--win-text);border:1px solid rgba(0,20,50,.55);border-radius:3px;padding:14px;overflow-wrap:anywhere;box-shadow:inset 0 1px 2px rgba(0,0,0,.08)}
.win-body>:first-child{margin-top:0}.win-body>:last-child{margin-bottom:0}
.menubar{display:flex;flex-wrap:wrap;align-items:center;gap:0 14px;padding:2px 10px;margin:0 0 4px;background:linear-gradient(180deg,var(--menu1),var(--menu2));border:1px solid rgba(0,20,50,.5);border-radius:3px;font-size:.9rem}
.menubar a,.menubar button{color:var(--menu-text);text-decoration:none;background:none;border:0;padding:0 2px;min-height:36px;display:inline-flex;align-items:center;font:inherit;cursor:pointer}
.menubar a:hover,.menubar button:hover{color:var(--link);text-decoration:underline}
.menubar form{margin:0}.menubar .me{margin-left:auto;color:var(--menu-text);opacity:.75}
.hero{position:relative;overflow:hidden;display:flex;align-items:center;gap:16px;min-height:100px;padding:14px 18px;border:1px solid rgba(0,20,50,.55);border-radius:3px;
background:linear-gradient(180deg,#d8f7ff 0%,#93def3 30%,#42b4dd 49%,#0b6fa9 51%,#1b94c9 76%,#62d4f0 100%)}
.hero::after{content:"";position:absolute;inset:0 0 50% 0;background:linear-gradient(rgba(255,255,255,.5),rgba(255,255,255,.04));pointer-events:none}
.hero .orb{position:relative;z-index:1;flex:none;width:60px;height:60px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff 0 6%,#a6f3ff 14%,#33b8ef 40%,#0b60ae 70%,#063a75);box-shadow:0 4px 10px rgba(0,30,70,.5),inset 0 -8px 14px rgba(120,255,170,.5)}
.hero span{position:relative;z-index:1;font-size:clamp(1.45rem,6.5vw,2.2rem);font-weight:400;line-height:1.1;color:#fff;text-shadow:0 2px 6px rgba(0,40,80,.55);overflow-wrap:anywhere}
@media(max-width:480px){.menubar .me{display:none}.hero{min-height:84px;gap:12px}.hero .orb{width:46px;height:46px}}
.tile{display:inline-block;flex:none;position:relative;z-index:1;padding:4px;border-radius:12px;line-height:0;background:linear-gradient(180deg,#fff,#d6eaf8 48%,#a9cbe8 52%,#e6f3fc);border:1px solid rgba(0,30,70,.55);box-shadow:0 3px 8px rgba(0,30,70,.4),inset 0 0 0 1px #fff}
.tile img{width:var(--s,60px);height:var(--s,60px);border-radius:9px}
a.tile:hover{box-shadow:0 0 0 3px rgba(80,200,255,.7),0 3px 10px rgba(0,30,70,.5)}
.who-row{display:flex;align-items:center;gap:12px;margin-bottom:8px}.who-row .grow{flex:1;min-width:0}
.pfp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(88px,1fr));gap:10px;margin:12px 0}
.pick{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 4px;border:1px solid transparent;border-radius:6px;cursor:pointer;font-size:.85rem;text-align:center}
.pick input{position:absolute;opacity:0;pointer-events:none}
.pick:hover{background:linear-gradient(180deg,#f2f9ff,#dceefb);border-color:#a8cdea}
.pick:has(input:checked){background:linear-gradient(180deg,#e4f4ff,#c4e2f8);border-color:#5ea9de;box-shadow:inset 0 0 0 1px #fff}
.pick input:checked+.tile{box-shadow:0 0 0 3px #3fb6ff,0 0 14px #7fd6ff}
.pick input:focus-visible+.tile{outline:2px solid #0a6fc2;outline-offset:3px}
.current{display:flex;align-items:center;gap:14px}
@media(prefers-color-scheme:dark){.pick:hover,.pick:has(input:checked){background:linear-gradient(180deg,#22405a,#1a3148);border-color:#3d7fb0}}
.win-body .pl{margin:8px 0 0;padding:8px 12px;border:1px solid var(--box-edge);border-radius:2px;background:linear-gradient(180deg,var(--box1),var(--box2))}
.win-body .pl:first-of-type{border-top:1px solid var(--box-edge)}
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
<meta name="theme-color" content="#1e8ee6">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap">
<title>${esc(title)}</title>
<style>${CSS}${ART_CSS}</style></head>
<body>${BACKGROUND_ART}<main>${body}</main>
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

/** `controls`: the owner's Pause/Resume button per playlist (home page only). */
function playlistRows(pls: PlaylistView[], controls = false): string {
  return pls
    .map((p) => {
      const open = p.url ? `<a class="linkbtn" href="${esc(p.url)}" target="_blank" rel="noopener">Open in Spotify</a>` : '<span class="muted">not created yet</span>';
      const toggle = controls
        ? `<form method="post" action="/playlist/${p.paused ? 'resume' : 'pause'}"><input type="hidden" name="slot" value="${p.slot}"><button class="btn secondary small" type="submit">${p.paused ? 'Resume' : 'Pause'}</button></form>`
        : '';
      return `<div class="pl"><div class="row"><strong>${esc(p.name)}</strong><span class="muted">${p.count} songs</span></div>
<div class="row">${open}${toggle}</div>
${p.paused ? '<div class="warn">Paused — songs for this playlist are skipped</div>' : ''}
${p.full ? '<div class="warn">Full (9,900+) — no longer receiving songs</div>' : ''}</div>`;
    })
    .join('');
}

const CAPTION = '<span class="caption" aria-hidden="true"><i class="min"></i><i class="max"></i><i class="close"></i></span>';

/** A Windows 7-style window. `title` must already be escaped. */
function win(title: string, body: string, opts: { h1?: boolean; menu?: string; bodyHtml?: string } = {}): string {
  const h = opts.h1 ? 'h1' : 'h2';
  return `<section class="win"><div class="win-title"><${h}>${title}</${h}>${CAPTION}</div>${opts.menu ?? ''}${
    opts.bodyHtml ?? `<div class="win-body">${body}</div>`
  }</section>`;
}

/** The big top window: title bar, menu bar and the glossy "Welcome" banner. */
function pfp(id: string, size = 60, alt = ''): string {
  return `<img src="${esc(pfpUrl(id))}" alt="${esc(alt)}" width="${size}" height="${size}" style="--s:${size}px">`;
}

function topWindow(title: string, banner: string, menu = '', avatar?: string): string {
  const art = avatar
    ? `<a class="tile" href="/picture" title="Change your picture">${pfp(avatar, 60, 'Your picture (change)')}</a>`
    : '<div class="orb" aria-hidden="true"></div>';
  return win(title, '', {
    h1: true,
    menu: menu ? `<nav class="menubar">${menu}</nav>` : '',
    bodyHtml: `<div class="hero">${art}<span>${banner}</span></div>`,
  });
}

const LOGOUT = '<form method="post" action="/logout"><button type="submit">Log out</button></form>';

export function landingPage(opts: { error?: string; invitedAs?: string; loginHref?: string }): string {
  return layout(
    APP,
    `${topWindow(APP, 'Welcome')}
${opts.invitedAs ? `<div class="banner">You've been invited (as ${esc(opts.invitedAs)})</div>` : ''}
${alertBox(opts.error)}
${win(
  'Get started',
  `<p>${APP} sorts what you listen to into 6 genre playlists + Misc, every 15 minutes.</p>
<a class="btn big" href="${esc(opts.loginHref ?? '/login')}">Connect Spotify</a>`,
)}`,
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
        : s.addingPaused
          ? `<div class="banner warn">Adding is paused. Songs you play now are skipped until you resume.</div>`
          : '';
  const recent = v.recent.length
    ? `<ul class="plain">${v.recent
        .map(
          (r) =>
            `<li>${esc(r.name)} — ${esc(r.artists)} → ${esc(r.playlistName)} <span class="muted">${time(r.addedAt)}</span></li>`,
        )
        .join('')}</ul>`
    : '<p class="muted">Nothing added yet. New songs show up here after the next sync.</p>';
  const menu = `<a href="/">Home</a>${v.isAdmin ? '<a href="/admin">Admin</a>' : ''}
<a href="/genres?user=${encodeURIComponent(v.userId)}">My genres</a><a href="/picture">Picture</a>${LOGOUT}<span class="me">${esc(v.userName)}</span>`;
  return layout(
    APP,
    `${topWindow(APP, `Welcome, ${esc(v.userName)}`, menu, v.avatar)}
${flashBanner(v.flash)}${banner}
${win(
  'Sync',
  `<div>Last sync: ${syncResult(s)}</div>
<div class="muted">${counts(s)}</div>
<div class="actions">${
    paused
      ? '<span class="muted">Sync now is unavailable while paused.</span>'
      : s.addingPaused
        ? '<form method="post" action="/resume"><button class="btn" type="submit">Resume adding</button></form>'
        : `<form method="post" action="/sync"><button class="btn" type="submit">Sync now</button></form>
<form method="post" action="/pause"><button class="btn secondary" type="submit">Pause adding</button></form>`
  }</div>`,
)}
${win('Playlists', playlistRows(v.playlists, !paused))}
${win('Recent adds', recent)}`,
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
  return win(
    esc(u.name),
    `<div class="who-row"><span class="tile">${pfp(u.avatar, 44)}</span><div class="grow"><div class="row"><strong>${esc(u.name)}</strong><span>${badge(s.status)}${s.addingPaused ? ' <span class="badge paused">adding paused</span>' : ''}</span></div>
<div>Last sync: ${syncResult(s)}</div></div></div>
<div class="muted">${counts(s)}</div>
<div class="chips">${u.genres.map((g) => `<span class="chip">${esc(g)}</span>`).join('')}</div>
${playlistRows(u.playlists)}
<div class="actions">${toggle}
<a class="btn secondary" href="/genres?user=${encodeURIComponent(u.id)}">Edit genres</a>${remove}</div>`,
  );
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
    `${topWindow('Admin', 'Admin', `<a href="/">Home</a><a href="/admin">Admin</a>${LOGOUT}`)}
${flashBanner(v.flash)}
${win('Seats', `<div>${v.seatsUsed} / ${v.maxUsers} users</div>
<div class="muted">Seats = users + pending invites.</div>`)}
${win(
  'Invite someone',
  `<div class="callout">${esc(REMINDER)}</div>
${v.canInvite ? '' : `<p class="muted">All ${v.maxUsers} seats are taken. Remove a user or revoke an invite to free one.</p>`}
<form method="post" action="/admin/invite">
<input type="text" name="label" required maxlength="60" placeholder="Friend's name" aria-label="Friend's name"${v.canInvite ? '' : ' disabled'}>
<div class="actions"><button class="btn" type="submit"${v.canInvite ? '' : ' disabled'}>Create invite link</button></div></form>`,
)}
${win('Pending invites', invites)}
${v.users.map(adminUserCard).join('')}`,
  );
}

export function inviteCreatedPage(o: { link: string; label: string; expiresAt: number }): string {
  return layout(
    'Invite created',
    `${win(
      `Invite for ${esc(o.label)}`,
      `<p>Send this link. It's shown once — copy it now.</p>
<input type="text" id="link" readonly value="${esc(o.link)}" onclick="this.select()">
<div class="actions"><button class="btn" type="button" id="copy">Copy</button><a class="btn secondary" href="/admin">Back to admin</a></div>
<p class="muted">Expires ${time(o.expiresAt)}</p>
<div class="callout">${esc(REMINDER)}</div>`,
      { h1: true },
    )}
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
    `${alertBox(v.error)}
${win(
  `Genres for ${esc(v.userName)}`,
  `<p class="muted">Higher slots win when a song fits several. Changing a genre renames its Spotify playlist; songs already added stay where they are. Each genre can be used once.</p>
<form method="post" action="/genres"><input type="hidden" name="user" value="${esc(v.userId)}">
${selects}
<div class="actions"><button class="btn" type="submit">Save</button><a class="btn secondary" href="${esc(v.backUrl)}">Cancel</a></div></form>`,
  { h1: true },
)}`,
  );
}

export function picturePage(v: PictureView): string {
  const name = v.options.find((o) => o.id === v.current)?.name ?? '';
  const picks = v.options
    .map(
      (o) =>
        `<label class="pick"><input type="radio" name="avatar" value="${esc(o.id)}"${o.id === v.current ? ' checked' : ''}><span class="tile">${pfp(o.id, 64)}</span><span>${esc(o.name)}</span></label>`,
    )
    .join('');
  return layout(
    'Choose your picture',
    win(
      'Choose your picture',
      `<div class="current"><span class="tile">${pfp(v.current, 72, 'Current picture')}</span><div><strong>Your current picture</strong><div class="muted">${esc(name)}</div></div></div>
<p class="muted">Pick a new picture. It shows on your home page and to the admin.</p>
<form method="post" action="/picture"><div class="pfp-grid">${picks}</div>
<div class="actions"><button class="btn" type="submit">Change picture</button><a class="btn secondary" href="/">Cancel</a></div></form>`,
      { h1: true },
    ),
  );
}

export function messagePage(
  title: string,
  message: string,
  link?: { href: string; text: string },
): string {
  return layout(
    title,
    win(esc(title), `<p>${esc(message)}</p>${link ? `<a class="btn" href="${esc(link.href)}">${esc(link.text)}</a>` : ''}`, { h1: true }),
  );
}
