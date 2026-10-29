// Decorative Frutiger Aero background: sun + lens flares, clouds, Vista-style light ribbons,
// glossy hills with grass and daisies, leaves with dewdrops, butterflies and sparkles.
// Inline SVG + CSS only (no image files). Built once per isolate; purely decorative.

/** Small deterministic random generator so the grass looks the same on every page. */
function rng(seed: number): () => number {
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
}

const r0 = (n: number) => Math.round(n);

// Hill crests in a 1440 x 320 viewBox (y grows downward; 320 is the bottom edge).
const front = (x: number) => 250 - 95 * Math.exp(-(((x - 760) / 560) ** 2));
const back = (x: number) => 210 - 85 * Math.exp(-(((x - 250) / 330) ** 2)) - 70 * Math.exp(-(((x - 1230) / 360) ** 2));

function hillPath(f: (x: number) => number): string {
  let d = 'M-20 320';
  for (let x = -20; x <= 1460; x += 30) d += `L${x} ${r0(f(x))}`;
  return `${d}L1460 320Z`;
}

function crestLine(f: (x: number) => number, dy: number): string {
  let d = '';
  for (let x = -20; x <= 1460; x += 30) d += `${d ? 'L' : 'M'}${x} ${r0(f(x) + dy)}`;
  return d;
}

function grass(): string {
  const r = rng(7);
  let d = '';
  for (let x = -10; x < 1450; x += 9 + r() * 8) {
    const y = front(x) + 4;
    const h = 9 + r() * 15;
    const w = 2.5 + r() * 2;
    const lean = (r() - 0.5) * 12;
    d += `M${r0(x - w)} ${r0(y)}Q${r0(x - w / 2 + lean / 3)} ${r0(y - h / 2)} ${r0(x + lean)} ${r0(y - h)}Q${r0(x + w / 2 + lean / 3)} ${r0(y - h / 2)} ${r0(x + w)} ${r0(y)}Z`;
  }
  return d;
}

function daisies(): string {
  return [310, 520, 640, 905, 1010, 1180]
    .map((x, i) => {
      const y = r0(front(x) + 12 + (i % 3) * 6);
      return `<circle cx="${x}" cy="${y}" r="4.5" fill="#fff"/><circle cx="${x}" cy="${y}" r="1.8" fill="#ffd23a"/>`;
    })
    .join('');
}

function sunRays(cx: number, cy: number): string {
  let out = '';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const L = i % 2 ? 230 : 320;
    const p = (ang: number) => `${r0(cx + L * Math.cos(ang))},${r0(cy + L * Math.sin(ang))}`;
    out += `<polygon points="${cx},${cy} ${p(a - 0.035)} ${p(a + 0.035)}"/>`;
  }
  return out;
}

function flares(cx: number, cy: number): string {
  const to = [60, 500];
  const at = (t: number) => [r0(cx + (to[0] - cx) * t), r0(cy + (to[1] - cy) * t)];
  const spots: [number, number, string, number, boolean][] = [
    [0.28, 14, '#ffffff', 0.4, false],
    [0.42, 34, '#aef7ff', 0.3, true],
    [0.52, 8, '#ffffff', 0.65, false],
    [0.7, 44, '#d7ffb0', 0.09, false],
    [0.88, 22, '#b8d8ff', 0.3, true],
  ];
  return spots
    .map(([t, r, c, o, ring]) => {
      const [x, y] = at(t);
      return ring
        ? `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${c}" stroke-width="3" opacity="${o}"/>`
        : `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="${o}"/>`;
    })
    .join('');
}

const cloud = (tx: number, ty: number, s: number) =>
  `<g transform="translate(${tx} ${ty}) scale(${s})"><ellipse cx="0" cy="40" rx="135" ry="30"/><circle cx="-60" cy="22" r="40"/><circle cx="-10" cy="0" r="60"/><circle cx="55" cy="14" r="46"/><circle cx="100" cy="32" r="30"/></g>`;

const RIBBONS = [
  ['M-60 900C220 720 480 820 1060 470', 2.2, 0.95],
  ['M-60 930C260 760 520 860 1060 520', 1.2, 0.8],
  ['M-60 870C200 690 470 780 1060 430', 3.6, 0.75],
  ['M-60 960C300 800 600 880 1060 600', 1, 0.7],
  ['M-60 845C180 670 450 750 1060 395', 0.8, 0.6],
] as const;

const WING =
  '<path d="M0 0C-6-16-22-18-20-4C-19 4-8 4 0 0Z"/><path d="M0 0C-4 10-14 16-15 8C-15 3-6 1 0 0Z"/><path class="gloss" d="M-3-3C-7-12-16-14-17-7C-12-9-7-7-3-3Z"/>';

function butterfly(cls: string, grad: string): string {
  const wing = `<g class="w" fill="url(#${grad})">${WING}</g>`;
  return `<svg class="bfly ${cls}" viewBox="-24 -18 48 36">${wing}<g transform="scale(-1 1)">${wing}</g><ellipse rx="1.6" ry="8" fill="#12385c"/></svg>`;
}

const LEAVES = `<path d="M20 250C40 140 140 70 250 60C210 150 130 230 20 250Z" fill="url(#a-leaf)"/>
<path d="M20 250Q140 150 250 60" fill="none" stroke="#eaffc4" stroke-width="2" opacity=".7"/>
<path d="M40 225C70 150 150 95 235 72C160 110 95 160 40 225Z" fill="#fff" opacity=".22"/>
<path d="M5 255C-5 180 30 110 95 70C85 140 55 210 5 255Z" fill="url(#a-leaf)" opacity=".9"/>
<path d="M5 255Q45 160 95 70" fill="none" stroke="#eaffc4" stroke-width="1.5" opacity=".6"/>
<circle cx="150" cy="148" r="9" fill="url(#a-drop)"/><circle cx="118" cy="182" r="5" fill="url(#a-drop)"/>`;

const DEFS = `<defs>
<radialGradient id="a-sun"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".12" stop-color="#fffbe0" stop-opacity=".85"/><stop offset=".35" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<linearGradient id="a-rib" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1000" y2="0"><stop offset="0" stop-color="#eaff9c" stop-opacity="0"/><stop offset=".2" stop-color="#b7ff6a"/><stop offset=".55" stop-color="#5ff0c8"/><stop offset=".85" stop-color="#6fd8ff" stop-opacity=".8"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="a-hf" x1="0" y1="0" x2="0" y2="1"><stop class="h1" offset="0"/><stop class="h2" offset="1"/></linearGradient>
<linearGradient id="a-hb" x1="0" y1="0" x2="0" y2="1"><stop class="h3" offset="0"/><stop class="h4" offset="1"/></linearGradient>
<linearGradient id="a-grass" x1="0" y1="0" x2="0" y2="1"><stop class="g1" offset="0"/><stop class="g2" offset="1"/></linearGradient>
<radialGradient id="a-shine" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<linearGradient id="a-leaf" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#2b8a1a"/><stop offset=".55" stop-color="#55c22e"/><stop offset="1" stop-color="#c6f56a"/></linearGradient>
<radialGradient id="a-drop" cx=".35" cy=".3" r=".7"><stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="#fff" stop-opacity=".4"/><stop offset=".7" stop-color="#bff4ff" stop-opacity=".15"/><stop offset="1" stop-color="#0b5a2a" stop-opacity=".45"/></radialGradient>
<linearGradient id="a-wing1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9ff4ff"/><stop offset=".6" stop-color="#2f9cf2"/><stop offset="1" stop-color="#1a5fc8"/></linearGradient>
<linearGradient id="a-wing2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e2ff8a"/><stop offset=".6" stop-color="#3fd28e"/><stop offset="1" stop-color="#1b8f6a"/></linearGradient>
<filter id="a-soft" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>
<filter id="a-glow" x="-10%" y="-50%" width="120%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
</defs>`;

/** The full background layer, placed first inside <body>. */
export const BACKGROUND_ART = `<div class="aero" aria-hidden="true">
<svg class="defs" width="0" height="0">${DEFS}</svg>
<svg class="sun" viewBox="0 0 600 520"><circle cx="480" cy="95" r="300" fill="url(#a-sun)"/><g class="rays" fill="#fff" opacity=".13">${sunRays(480, 95)}</g><g class="flares">${flares(480, 95)}</g></svg>
<svg class="clouds" viewBox="0 0 800 300"><g fill="#fff" filter="url(#a-soft)">${cloud(190, 110, 1)}${cloud(600, 210, 0.62)}</g></svg>
<svg class="ribbons" viewBox="0 0 1000 1000" preserveAspectRatio="none">
<path d="${RIBBONS[0][0]}" fill="none" stroke="url(#a-rib)" stroke-width="48" opacity=".22" filter="url(#a-glow)" vector-effect="non-scaling-stroke"/>
${RIBBONS.map(([d, w, o]) => `<path d="${d}" fill="none" stroke="url(#a-rib)" stroke-width="${w}" opacity="${o}" vector-effect="non-scaling-stroke"/>`).join('')}
<path d="${RIBBONS[0][0]}" fill="none" stroke="#fff" stroke-width=".6" opacity=".8" vector-effect="non-scaling-stroke"/>
</svg>
<svg class="hills" viewBox="0 0 1440 320" preserveAspectRatio="xMidYMax slice">
<path d="${hillPath(back)}" fill="url(#a-hb)"/>
<path d="${crestLine(back, 3)}" fill="none" stroke="#fff" stroke-width="3" opacity=".35"/>
<path d="${hillPath(front)}" fill="url(#a-hf)"/>
<ellipse class="shine" cx="760" cy="200" rx="430" ry="42" fill="url(#a-shine)"/>
<path d="${crestLine(front, 6)}" fill="none" stroke="#fff" stroke-width="4" opacity=".4"/>
<path d="${grass()}" fill="url(#a-grass)"/>${daisies()}
</svg>
<svg class="leaf leaf-l" viewBox="0 0 300 260">${LEAVES}</svg>
<svg class="leaf leaf-r" viewBox="0 0 300 260">${LEAVES}</svg>
${butterfly('b1', 'a-wing1')}${butterfly('b2', 'a-wing2')}
<i></i><i></i><i></i><i></i><i></i><i></i>
<b></b><b></b><b></b><b></b><b></b><b></b><b></b><b></b>
</div>`;

export const ART_CSS = `
.aero svg{position:absolute;display:block}
.aero .defs{width:0;height:0}
.aero .sun{top:0;right:0;width:min(115vw,720px)}
.aero .rays{transform-box:view-box;transform-origin:480px 95px;animation:spin 120s linear infinite}
.aero .clouds{top:6vh;left:-60px;width:min(115vw,780px);opacity:.92;animation:drift 50s ease-in-out infinite alternate}
.aero .ribbons{inset:0;width:100%;height:100%;animation:sway 22s ease-in-out infinite alternate}
.aero .hills{left:0;bottom:0;width:100%;height:36vh;min-height:200px}
.aero .h1{stop-color:var(--hill1)}.aero .h2{stop-color:var(--hill2)}.aero .h3{stop-color:var(--hill3)}.aero .h4{stop-color:var(--hill4)}
.aero .g1{stop-color:var(--grass1)}.aero .g2{stop-color:var(--grass2)}
.aero .leaf{bottom:-24px;width:min(44vw,300px)}
.aero .leaf-l{left:-34px}.aero .leaf-r{right:-34px;transform:scaleX(-1)}
.aero .bfly{top:0;left:0;width:44px;animation:fly1 38s ease-in-out infinite}
.aero .bfly.b2{width:34px;animation:fly2 46s ease-in-out infinite;animation-delay:-18s}
.aero .bfly .w{transform-box:view-box;transform-origin:0 0;animation:flap .28s ease-in-out infinite alternate}
.aero .bfly path{stroke:#0b4d8c;stroke-width:.7}.aero .bfly .gloss{fill:#fff;opacity:.55;stroke:none}
.aero b{position:absolute;width:16px;height:16px;background:radial-gradient(circle,#fff 0 30%,rgba(255,255,255,.4) 60%,transparent 70%);clip-path:polygon(50% 0,60% 40%,100% 50%,60% 60%,50% 100%,40% 60%,0 50%,40% 40%);animation:twinkle 3.6s ease-in-out infinite}
.aero b:nth-of-type(1){top:9%;left:12%}.aero b:nth-of-type(2){top:22%;left:46%;animation-delay:-1.2s}
.aero b:nth-of-type(3){top:14%;left:78%;animation-delay:-2.1s}.aero b:nth-of-type(4){top:38%;left:8%;animation-delay:-.6s;width:10px;height:10px}
.aero b:nth-of-type(5){top:31%;left:66%;animation-delay:-2.8s;width:12px;height:12px}.aero b:nth-of-type(6){top:47%;left:88%;animation-delay:-1.7s}
.aero b:nth-of-type(7){top:5%;left:58%;animation-delay:-3.2s;width:10px;height:10px}.aero b:nth-of-type(8){top:52%;left:30%;animation-delay:-.9s;width:12px;height:12px}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes drift{from{transform:translateX(-20px)}to{transform:translateX(40px)}}
@keyframes sway{from{transform:translate(-2%,1%)}to{transform:translate(2%,-1%)}}
@keyframes flap{from{transform:scaleX(1)}to{transform:scaleX(.25)}}
@keyframes twinkle{0%,100%{opacity:.15;transform:scale(.55)}50%{opacity:1;transform:scale(1) rotate(45deg)}}
@keyframes fly1{0%{transform:translate(-12vw,64vh) rotate(10deg)}25%{transform:translate(22vw,52vh) rotate(-8deg)}50%{transform:translate(52vw,60vh) rotate(6deg)}75%{transform:translate(80vw,46vh) rotate(-10deg)}100%{transform:translate(112vw,56vh) rotate(4deg)}}
@keyframes fly2{0%{transform:translate(110vw,40vh) rotate(-8deg)}30%{transform:translate(70vw,50vh) rotate(6deg)}60%{transform:translate(34vw,42vh) rotate(-6deg)}100%{transform:translate(-12vw,54vh) rotate(8deg)}}
@media(prefers-color-scheme:dark){
.aero .sun{opacity:.28}.aero .flares{display:none}.aero .shine{opacity:.3}.aero .clouds{opacity:.14}
.aero .leaf{filter:brightness(.5) saturate(1.2)}.aero .bfly{display:none}
.aero b{background:radial-gradient(circle,#fff 0 35%,rgba(200,240,255,.5) 60%,transparent 70%)}}
@media(prefers-reduced-motion:reduce){.aero *{animation:none!important}.aero .bfly{display:none}.aero b{opacity:.7}}
`;
