// Profile pictures: a few photos (public/pfp/<id>.webp, served as static assets) plus
// original Frutiger Aero tiles drawn as SVG and served from /pfp/<id>.svg.
// To add a photo: put a square <id>.webp in public/pfp/ and list it in PHOTOS.

export interface Avatar {
  id: string;
  name: string;
}

/** Bump when the artwork changes so browsers fetch the new files. */
export const PFP_VERSION = 1;

/** Photo pictures in public/pfp/, shown first in the picker. */
const PHOTOS: Record<string, string> = {
  plane: 'Bubble jet',
  bluescreen: 'Blue screen',
  clownfish: 'Clownfish',
  bliss: 'Bliss',
};

type Stop = [number, string, number?];
const stops = (s: Stop[]) => s.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a === undefined ? '' : ` stop-opacity="${a}"`}/>`).join('');
const lg = (id: string, s: Stop[], x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops(s)}</linearGradient>`;
const rg = (id: string, s: Stop[], cx = 0.5, cy = 0.5, r = 0.5) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops(s)}</radialGradient>`;
const BUBBLE = rg('bub', [[0, '#fff', 0.95], [0.12, '#fff', 0.4], [0.6, '#bff4ff', 0.12], [0.85, '#fff', 0.55], [1, '#fff', 0]], 0.35, 0.3, 0.6);
const bubble = (x: number, y: number, r: number) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#bub)"/>`;
const ring = (n: number, f: (i: number) => string) => Array.from({ length: n }, (_, i) => f(i)).join('');

/** Common frame: rounded clip, artwork, Windows 7 gloss across the top, thin light edge. */
function tile(defs: string, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><clipPath id="clip"><rect width="96" height="96" rx="14"/></clipPath>${lg('gloss', [[0, '#fff', 0.8], [1, '#fff', 0]])}${defs}</defs><g clip-path="url(#clip)">${body}<path d="M0 0H96V30Q48 46 0 34Z" fill="url(#gloss)" opacity=".6"/></g><rect x=".5" y=".5" width="95" height="95" rx="13.5" fill="none" stroke="#fff" stroke-opacity=".7"/></svg>`;
}

const ART: Record<string, [string, () => string]> = {
  gerbera: [
    'Gerbera',
    () =>
      tile(
        lg('sky', [[0, '#3aa8f0'], [0.65, '#c4ecff'], [0.66, '#8fdc5c'], [1, '#3e9f2a']]) +
          lg('pet', [[0, '#ffc462'], [1, '#ff5a00']]) +
          lg('pet2', [[0, '#ff8a1a'], [1, '#d63c00']]) +
          rg('eye', [[0, '#6a3400'], [1, '#2a1200']]),
        `<rect width="96" height="96" fill="url(#sky)"/><path d="M48 70V96" stroke="#2f8a1f" stroke-width="4"/>
${ring(16, (i) => `<ellipse cx="48" cy="37" rx="6" ry="15" fill="url(#pet)" transform="rotate(${i * 22.5} 48 54)"/>`)}
${ring(16, (i) => `<ellipse cx="48" cy="43" rx="4" ry="9" fill="url(#pet2)" transform="rotate(${i * 22.5 + 11.25} 48 54)"/>`)}
<circle cx="48" cy="54" r="10.5" fill="#ffcc33"/><circle cx="48" cy="54" r="7.5" fill="url(#eye)"/><circle cx="45.5" cy="51.5" r="2.2" fill="#fff" opacity=".45"/>`,
      ),
  ],
  goldfish: [
    'Goldfish',
    () =>
      tile(
        lg('sea', [[0, '#3fc2f5'], [1, '#0a4c99']]) + lg('fish', [[0, '#ffd77a'], [0.5, '#ff7a1a'], [1, '#d84400']]) + BUBBLE,
        `<rect width="96" height="96" fill="url(#sea)"/><g fill="#fff" opacity=".12"><path d="M20 0H34L18 96H4Z"/><path d="M52 0H60L50 96H40Z"/><path d="M78 0H90L84 96H70Z"/></g>
<path d="M30 52C16 36 6 40 11 52C6 64 16 68 30 52Z" fill="url(#fish)" opacity=".9"/>
<path d="M38 40C44 26 58 28 62 38Z" fill="#ff8a2a"/><ellipse cx="48" cy="52" rx="21" ry="13.5" fill="url(#fish)"/>
<path d="M44 62C48 72 56 70 56 63Z" fill="#ff8a2a"/><ellipse cx="46" cy="46" rx="13" ry="4.5" fill="#fff" opacity=".35"/>
<circle cx="60" cy="48" r="3.4" fill="#fff"/><circle cx="61" cy="48" r="1.8" fill="#14243a"/><path d="M68 54Q66 56 64 55" stroke="#a83200" stroke-width="1.4" fill="none"/>
${bubble(76, 36, 5)}${bubble(80, 23, 3.4)}${bubble(74, 13, 2.4)}`,
      ),
  ],
  duck: [
    'Rubber duck',
    () =>
      tile(
        lg('bg', [[0, '#c9f3ff'], [0.62, '#8fe0ff'], [0.63, '#3cc4ef'], [1, '#0b7fc8']]) + lg('yel', [[0, '#fff590'], [0.55, '#ffd21f'], [1, '#f0a000']]),
        `<rect width="96" height="96" fill="url(#bg)"/><ellipse cx="46" cy="80" rx="30" ry="5" fill="#055a92" opacity=".35"/>
<path d="M20 56L26 46L32 56Z" fill="url(#yel)"/><ellipse cx="46" cy="64" rx="26" ry="15" fill="url(#yel)"/>
<circle cx="60" cy="41" r="13" fill="url(#yel)"/><path d="M71 39Q86 41 73 47Q69 44 71 39Z" fill="#ff8a1f"/>
<circle cx="63" cy="37" r="2.3" fill="#1a1a1a"/><circle cx="63.8" cy="36.2" r=".8" fill="#fff"/>
<path d="M36 60Q46 54 54 62Q46 70 36 60Z" fill="#f0b000" opacity=".7"/><ellipse cx="54" cy="34" rx="6" ry="3" fill="#fff" opacity=".55"/>
<path d="M0 70Q12 66 24 70T48 70T72 70T96 70V96H0Z" fill="#fff" opacity=".18"/>`,
      ),
  ],
  butterfly: [
    'Butterfly',
    () => {
      const wing = '<path d="M0 0C-6-16-22-18-20-4C-19 4-8 4 0 0Z"/><path d="M0 0C-4 10-14 16-15 8C-15 3-6 1 0 0Z"/>';
      const w = `<g fill="url(#wing)" stroke="#0b4d8c" stroke-width=".6">${wing}</g><path d="M-3-3C-7-12-16-14-17-7C-12-9-7-7-3-3Z" fill="#fff" opacity=".55"/>`;
      return tile(
        lg('bg', [[0, '#d4f79a'], [1, '#3fae32']]) + lg('wing', [[0, '#a6f5ff'], [0.6, '#2f9cf2'], [1, '#1a5fc8']], 1, 1),
        `<rect width="96" height="96" fill="url(#bg)"/><g fill="#fff" opacity=".25"><circle cx="16" cy="20" r="10"/><circle cx="80" cy="72" r="14"/><circle cx="76" cy="16" r="6"/><circle cx="14" cy="78" r="7"/></g>
<g transform="translate(48 50) scale(1.9)">${w}<g transform="scale(-1 1)">${w}</g><ellipse rx="1.6" ry="8" fill="#12385c"/><path d="M-1-7Q-4-14-7-15M1-7Q4-14 7-15" stroke="#12385c" stroke-width=".7" fill="none"/></g>`,
      );
    },
  ],
  globe: [
    'Globe',
    () =>
      tile(
        rg('bg', [[0, '#5cc8ff'], [1, '#06347a']]) +
          rg('sea', [[0, '#9ff0ff'], [0.45, '#1f95e3'], [1, '#08398a']], 0.35, 0.3, 0.75) +
          lg('land', [[0, '#c2f574'], [1, '#2f9a24']]) +
          '<clipPath id="orb"><circle cx="48" cy="48" r="32"/></clipPath>',
        `<rect width="96" height="96" fill="url(#bg)"/><circle cx="48" cy="50" r="33" fill="#021c44" opacity=".35"/><circle cx="48" cy="48" r="32" fill="url(#sea)"/>
<g clip-path="url(#orb)" fill="url(#land)"><path d="M26 34C34 22 48 26 50 35C52 44 44 46 40 55C36 62 28 58 27 48Z"/><path d="M56 52C62 46 74 50 72 62C68 72 58 72 56 62Z"/><path d="M58 24C66 20 76 28 70 35C64 38 57 33 58 24Z"/></g>
<ellipse cx="38" cy="30" rx="15" ry="8" fill="#fff" opacity=".5" transform="rotate(-25 38 30)"/><circle cx="48" cy="48" r="32" fill="none" stroke="#c9f6ff" stroke-opacity=".6"/>`,
      ),
  ],
  dewdrop: [
    'Dewdrop',
    () =>
      tile(
        lg('leaf', [[0, '#b2ef6a'], [1, '#2a8a1c']], 1, 1) +
          rg('drop', [[0, '#fff', 0.15], [0.7, '#d6ffd0', 0.2], [0.92, '#1d6b14', 0.45], [1, '#fff', 0.7]], 0.45, 0.6, 0.55),
        `<rect width="96" height="96" fill="url(#leaf)"/><g stroke="#eaffc4" stroke-opacity=".35" fill="none"><path d="M-6 96L96 -6" stroke-width="3"/><path d="M14 60L34 54M30 76L52 70M44 40L62 34M60 24L74 18" stroke-width="1.5"/></g>
<path d="M48 18C60 36 70 47 70 60A22 22 0 0 1 26 60C26 47 36 36 48 18Z" fill="url(#drop)"/>
<ellipse cx="40" cy="52" rx="5" ry="9" fill="#fff" opacity=".8" transform="rotate(20 40 52)"/><ellipse cx="58" cy="70" rx="6" ry="3" fill="#fff" opacity=".5"/>`,
      ),
  ],
  aurora: [
    'Aurora',
    () =>
      tile(
        lg('night', [[0, '#031a40'], [1, '#0b5a96']]) + lg('rib', [[0, '#b7ff6a'], [0.5, '#5ff0c8'], [1, '#6fd8ff']], 1, 0) + '<filter id="glow"><feGaussianBlur stdDeviation="3"/></filter>',
        `<rect width="96" height="96" fill="url(#night)"/><g fill="#fff">${[[14, 14], [30, 26], [70, 10], [84, 30], [56, 20], [8, 40]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1"/>`).join('')}</g>
<path d="M-10 74C20 50 50 72 106 34" stroke="url(#rib)" stroke-width="14" fill="none" opacity=".5" filter="url(#glow)"/>
<path d="M-10 74C20 50 50 72 106 34" stroke="url(#rib)" stroke-width="4" fill="none"/><path d="M-10 82C24 60 54 80 106 46" stroke="url(#rib)" stroke-width="2" fill="none" opacity=".8"/>
<path d="M-10 66C18 44 48 62 106 24" stroke="url(#rib)" stroke-width="1.2" fill="none" opacity=".7"/><path d="M-10 74C20 50 50 72 106 34" stroke="#fff" stroke-width=".8" fill="none" opacity=".8"/>`,
      ),
  ],
  bubbles: [
    'Bubbles',
    () =>
      tile(
        lg('bg', [[0, '#9cecff'], [1, '#1593dc']]) + BUBBLE,
        `<rect width="96" height="96" fill="url(#bg)"/>${bubble(42, 54, 23)}${bubble(70, 28, 12)}${bubble(72, 68, 9)}${bubble(22, 24, 7)}${bubble(84, 48, 5)}${bubble(16, 80, 4)}`,
      ),
  ],
  hills: [
    'Green hills',
    () =>
      tile(
        lg('sky', [[0, '#2f8fe8'], [1, '#bfe9ff']]) + lg('hill', [[0, '#9be85a'], [1, '#2f9a1c']]) + lg('hill2', [[0, '#b9efb0'], [1, '#58b87a']]) + rg('sun', [[0, '#fff'], [0.3, '#fffbe0', 0.8], [1, '#fff', 0]]),
        `<rect width="96" height="96" fill="url(#sky)"/><circle cx="76" cy="20" r="22" fill="url(#sun)"/>
<g fill="#fff" opacity=".9"><ellipse cx="26" cy="30" rx="16" ry="6"/><circle cx="22" cy="26" r="7"/><circle cx="31" cy="25" r="8"/></g>
<path d="M0 66Q30 48 60 60T96 56V96H0Z" fill="url(#hill2)"/><path d="M0 76Q44 50 96 72V96H0Z" fill="url(#hill)"/><path d="M8 74Q44 54 88 70" stroke="#fff" stroke-opacity=".45" stroke-width="2" fill="none"/>`,
      ),
  ],
  note: [
    'Music',
    () =>
      tile(
        lg('bg', [[0, '#6ff0d8'], [1, '#1584c8']], 1, 1) + lg('w', [[0, '#fff'], [1, '#cfefff']]),
        `<rect width="96" height="96" fill="url(#bg)"/><g fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="3"><circle cx="48" cy="50" r="18"/><circle cx="48" cy="50" r="30"/><circle cx="48" cy="50" r="42"/></g>
<g transform="translate(2 3)" fill="#0b4d8c" opacity=".35"><path d="M41 22L73 14V58H67V26L47 31V66H41Z"/><ellipse cx="35" cy="66" rx="9.5" ry="7" transform="rotate(-20 35 66)"/><ellipse cx="61" cy="58" rx="9.5" ry="7" transform="rotate(-20 61 58)"/></g>
<g fill="url(#w)"><path d="M41 22L73 14V58H67V26L47 31V66H41Z"/><ellipse cx="35" cy="66" rx="9.5" ry="7" transform="rotate(-20 35 66)"/><ellipse cx="61" cy="58" rx="9.5" ry="7" transform="rotate(-20 61 58)"/></g>`,
      ),
  ],
  snowflake: [
    'Snowflake',
    () => {
      let d = '';
      for (let k = 0; k < 6; k++) {
        const a = (k * Math.PI) / 3;
        const p = (r: number, off = 0) => `${(48 + r * Math.cos(a + off)).toFixed(1)} ${(48 + r * Math.sin(a + off)).toFixed(1)}`;
        const branch = (r: number, len: number) => {
          const bx = 48 + r * Math.cos(a), by = 48 + r * Math.sin(a);
          return [-1, 1].map((s) => `M${bx.toFixed(1)} ${by.toFixed(1)}L${(bx + len * Math.cos(a + (s * Math.PI) / 4)).toFixed(1)} ${(by + len * Math.sin(a + (s * Math.PI) / 4)).toFixed(1)}`).join('');
        };
        d += `M48 48L${p(31)}${branch(15, 9)}${branch(23, 6)}`;
      }
      return tile(
        lg('ice', [[0, '#e4f8ff'], [0.5, '#8ad6f7'], [1, '#2f93dc']]),
        `<rect width="96" height="96" fill="url(#ice)"/><path d="${d}" stroke="#1d6fb0" stroke-opacity=".35" stroke-width="6" stroke-linecap="round" transform="translate(1 2)" fill="none"/>
<path d="${d}" stroke="#fff" stroke-width="3.5" stroke-linecap="round" fill="none"/><circle cx="48" cy="48" r="4" fill="#fff"/>`,
      );
    },
  ],
  heart: [
    'Heart',
    () =>
      tile(
        lg('bg', [[0, '#c4f1ff'], [1, '#3aa8f0']]) + lg('h', [[0, '#ffa8da'], [0.55, '#ff4f9a'], [1, '#d81f6c']]),
        `<rect width="96" height="96" fill="url(#bg)"/><g fill="#fff" opacity=".3"><circle cx="18" cy="18" r="6"/><circle cx="80" cy="78" r="9"/><circle cx="82" cy="20" r="3"/></g>
<path d="M48 82C20 62 12 44 20 31C28 19 43 22 48 33C53 22 68 19 76 31C84 44 76 62 48 82Z" fill="#8a0f3f" opacity=".25" transform="translate(1 3)"/>
<path d="M48 80C20 60 13 44 21 31C29 19 43 22 48 33C53 22 67 19 75 31C83 44 76 60 48 80Z" fill="url(#h)"/>
<path d="M27 34C31 26 40 26 44 33C38 30 32 31 27 38Z" fill="#fff" opacity=".7"/><ellipse cx="62" cy="34" rx="7" ry="3.5" fill="#fff" opacity=".45" transform="rotate(20 62 34)"/>`,
      ),
  ],
};

export const AVATARS: Avatar[] = [
  ...Object.entries(PHOTOS).map(([id, name]) => ({ id, name })),
  ...Object.entries(ART).map(([id, [name]]) => ({ id, name })),
];

const isAvatar = (id: string) => !!(PHOTOS[id] || ART[id]);

const cache = new Map<string, string>();

/** The SVG file for one picture, or null if there's no such picture. */
export function avatarSvg(id: string): string | null {
  if (!ART[id]) return null;
  if (!cache.has(id)) cache.set(id, ART[id][1]());
  return cache.get(id)!;
}

export function pfpUrl(id: string): string {
  return `/pfp/${encodeURIComponent(id)}.${PHOTOS[id] ? 'webp' : 'svg'}?v=${PFP_VERSION}`;
}

/** The user's chosen picture, or a stable default picked from their id so people don't all match. */
export function avatarFor(user: { id: string; avatar?: string | null }): string {
  if (user.avatar && isAvatar(user.avatar)) return user.avatar;
  let h = 0;
  for (const c of user.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATARS[h % AVATARS.length].id;
}
