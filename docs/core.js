/* Shared helpers for all manual tabs: animation loop, canvas sizing, the synthetic
   scan patch, and the 3D layer stack. Exposed as window.Manual. */
(() => {
'use strict';

/* ================================================================ helpers */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const SVGNS = 'http://www.w3.org/2000/svg';
/* Safari ignores var(--x) in SVG presentation attributes (fill="var(--mesh)") and paints
   them black. Move such values into inline style, which every browser resolves. */
const VAR_ATTRS = ['fill', 'stroke', 'stop-color', 'color'];
const setAttr = (e, k, v) => {
  if (VAR_ATTRS.includes(k) && typeof v === 'string' && v.includes('var(')) e.style.setProperty(k, v);
  else e.setAttribute(k, v);
};
const fixVars = (root = document) => {
  const sel = VAR_ATTRS.map(a => `[${a}*="var("]`).join(',');
  root.querySelectorAll(sel).forEach(e => VAR_ATTRS.forEach(a => {
    const v = e.getAttribute(a);
    if (v && v.includes('var(')) { e.style.setProperty(a, v); e.removeAttribute(a); }
  }));
};
const svgEl = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) setAttr(e, k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
};
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const TAU = Math.PI * 2;
const motionOK = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const parseHex = h => {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(h);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [200, 120, 40];
};
const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

const themeListeners = [];
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => themeListeners.forEach(f => f()));

/* One shared animation loop. A ticker only runs while its element is on screen. */
const tickers = [];
function visibility(elm) {
  const s = { visible: false, seen: false };
  new IntersectionObserver(es => {
    s.visible = es[0].isIntersecting;
    if (s.visible) s.seen = true;
  }, { rootMargin: '60px' }).observe(elm);
  return s;
}
function addTicker(vis, fn) { tickers.push({ vis, fn }); }
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  for (const t of tickers) if (t.vis.visible) t.fn(dt, now / 1000);
  requestAnimationFrame(frame);
fixVars(document);
}
requestAnimationFrame(frame);

/* Size a canvas to its CSS box and return a ctx in CSS pixels. */
function sizeCanvas(c) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const r = c.getBoundingClientRect();
  const w = Math.max(1, Math.round(r.width));
  const h = Math.max(1, Math.round(r.height));
  if (c.width !== w * dpr || c.height !== h * dpr) { c.width = w * dpr; c.height = h * dpr; }
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}
function onResize(elm, fn) { new ResizeObserver(() => fn()).observe(elm); }

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ================================================================ synthetic scene
   A made-up patch of scroll: wavy layers that get denser toward the bottom.
   w(x, y) is the winding number at a point. Everything else derives from it. */
const SW = 640, SH = 400;
const warp = x => 26 * Math.sin(x / 110 + 0.6) + 9 * Math.sin(x / 41 + 2.0);
const dwarp = x => (26 / 110) * Math.cos(x / 110 + 0.6) + (9 / 41) * Math.cos(x / 41 + 2.0);
const wf = (x, y) => { const t = (y + warp(x)) / SH; return 10.5 * t + 3.5 * t * t; };
const wgrad = (x, y) => { const t = (y + warp(x)) / SH; const d = (10.5 + 7 * t) / SH; return [d * dwarp(x), d]; };
function yOfWinding(x, k) {
  let lo = -300, hi = 800;
  for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; if (wf(x, m) < k) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
function valueNoise(cell, seed) {
  const r = rng(seed);
  const gw = Math.ceil(SW / cell) + 3, gh = Math.ceil(SH / cell) + 3;
  const g = new Float32Array(gw * gh);
  for (let i = 0; i < g.length; i++) g[i] = r();
  return (x, y) => {
    const fx = clamp(x, 0, SW - 1) / cell, fy = clamp(y, 0, SH - 1) / cell;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = smooth(fx - ix), ty = smooth(fy - iy);
    const a = g[iy * gw + ix], b = g[iy * gw + ix + 1], c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1];
    return lerp(lerp(a, b, tx), lerp(c, d, tx), ty);
  };
}
function hsl2rgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  const f = n => {
    const k = (n + h * 12) % 12, a = s * Math.min(l, 1 - l);
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0) * 255, f(8) * 255, f(4) * 255];
}

function renderScene() {
  const nBig = valueNoise(60, 1), nMid = valueNoise(14, 2), nFine = valueNoise(3, 3);
  const mk = () => {
    const c = document.createElement('canvas'); c.width = SW; c.height = SH;
    const x = c.getContext('2d'); const id = x.createImageData(SW, SH);
    return { c, x, id, d: id.data };
  };
  const S = { scan: mk(), cos: mk(), dens: mk(), dir: mk() };
  const amber = [240, 177, 58], amberBg = [24, 20, 14];
  const tealHi = [94, 224, 223], tealLo = [16, 32, 31];
  for (let y = 0; y < SH; y++) {
    for (let x = 0; x < SW; x++) {
      const i = (y * SW + x) * 4;
      const w = wf(x, y), c = 0.5 + 0.5 * Math.cos(TAU * w);
      const [gx, gy] = wgrad(x, y), m = Math.hypot(gx, gy), phi = Math.atan2(gy, gx);

      // scan: bright windings, grain, and one blurry damaged spot
      let v = 0.09 + 0.80 * Math.pow(c, 2.2) * (0.7 + 0.3 * nBig(x, y)) + (nMid(x, y) - 0.5) * 0.10;
      const b = Math.exp(-(((x - 440) ** 2) + ((y - 135) ** 2)) / (2 * 46 * 46));
      v = lerp(v, 0.42 + 0.10 * nMid(x + 99, y), b * 0.9);
      v += (nFine(x, y) - 0.5) * 0.12;
      const g8 = clamp(v, 0, 1) * 255;
      S.scan.d[i] = g8; S.scan.d[i + 1] = g8; S.scan.d[i + 2] = g8; S.scan.d[i + 3] = 255;

      // cos
      const cc = mix(amberBg, amber, c);
      S.cos.d[i] = cc[0]; S.cos.d[i + 1] = cc[1]; S.cos.d[i + 2] = cc[2]; S.cos.d[i + 3] = 255;

      // density
      const dc = mix(tealLo, tealHi, clamp((m - 0.024) / (0.052 - 0.024), 0, 1));
      S.dens.d[i] = dc[0]; S.dens.d[i + 1] = dc[1]; S.dens.d[i + 2] = dc[2]; S.dens.d[i + 3] = 255;

      // direction (double angle, so up and down get the same color)
      const rc = hsl2rgb(((2 * phi) % TAU) / TAU * 360, 0.62, 0.52);
      S.dir.d[i] = rc[0]; S.dir.d[i + 1] = rc[1]; S.dir.d[i + 2] = rc[2]; S.dir.d[i + 3] = 255;
    }
  }
  for (const k in S) S[k].x.putImageData(S[k].id, 0, 0);
  return { scan: S.scan.c, cos: S.cos.c, dens: S.dens.c, dir: S.dir.c };
}
const scene = renderScene();

function paintLayerCanvases(root, attr) {
  $$('canvas.layer', root).forEach(c => {
    c.width = SW; c.height = SH;
    c.getContext('2d').drawImage(scene[c.dataset[attr]], 0, 0);
  });
}
function segSwitch(root, attr, onChange) {
  const btns = $$('.seg button[data-' + attr + ']', root);
  btns.forEach(b => b.addEventListener('click', () => {
    btns.forEach(x => x.classList.toggle('on', x === b));
    $$('canvas.layer', root).forEach(c => c.classList.toggle('on', c.dataset[attr] === b.dataset[attr]));
    if (onChange) onChange(b.dataset[attr]);
  }));
}

/* ================================================================ 3D layer stack */
function Stack3D(canvas, o = {}) {
  const C = 16, R = 8;
  const S = { n: o.n || 7, explode: o.explode || 0, ang: o.ang ?? 0.5, tilt: 0.36, sel: -1, auto: o.auto !== false && motionOK() };
  let ang0 = S.ang, phase = 0;
  let dirty = true, W = 1, H = 1, scale = 1, ctx = null, col = null;
  const loadColors = () => { col = { a: parseHex(cssVar('--cos')), b: parseHex(cssVar('--mesh')) }; };
  loadColors();
  themeListeners.push(() => { loadColors(); dirty = true; });

  const spacing = ex => 19 * (1 + 1.6 * ex);
  function point(d, u, v, ex = S.explode) {
    const a = (-40 + 80 * u) * Math.PI / 180;
    const z = -52 + 104 * v;
    const r = 150 + d * spacing(ex) + 4 * Math.sin(2.6 * a + d * 0.9) + 3 * Math.sin(z / 22 + d * 1.7);
    const cx = 0.92 * (150 + (S.n - 1) * spacing(ex) / 2);
    return [r * Math.cos(a) - cx, r * Math.sin(a), z];
  }
  function project(p) {
    const c = Math.cos(S.ang), s = Math.sin(S.ang);
    const x = p[0] * c - p[1] * s, y = p[0] * s + p[1] * c, z = p[2];
    const ct = Math.cos(S.tilt), st = Math.sin(S.tilt);
    return [W / 2 + x * scale, H / 2 + (-z * ct + y * st) * scale, y * ct + z * st];
  }
  function drawLayer(d) {
    const t = S.n > 1 ? d / (S.n - 1) : 0;
    const rgb = mix(col.a, col.b, t);
    const sel = S.sel === d, dim = S.sel >= 0 && !sel;
    const P = [];
    for (let j = 0; j <= R; j++) { const row = []; for (let i = 0; i <= C; i++) row.push(project(point(d, i / C, j / R))); P.push(row); }
    ctx.beginPath();
    for (let i = 0; i <= C; i++) ctx.lineTo(P[0][i][0], P[0][i][1]);
    for (let j = 0; j <= R; j++) ctx.lineTo(P[j][C][0], P[j][C][1]);
    for (let i = C; i >= 0; i--) ctx.lineTo(P[R][i][0], P[R][i][1]);
    for (let j = R; j >= 0; j--) ctx.lineTo(P[j][0][0], P[j][0][1]);
    ctx.closePath();
    ctx.fillStyle = rgba(rgb, sel ? 0.45 : dim ? 0.08 : 0.18);
    ctx.fill();
    ctx.strokeStyle = rgba(rgb, dim ? 0.4 : 0.95);
    ctx.lineWidth = sel ? 1.4 : 0.9;
    ctx.beginPath();
    for (let j = 1; j < R; j++) { ctx.moveTo(P[j][0][0], P[j][0][1]); for (let i = 1; i <= C; i++) ctx.lineTo(P[j][i][0], P[j][i][1]); }
    for (let i = 1; i < C; i++) { ctx.moveTo(P[0][i][0], P[0][i][1]); for (let j = 1; j <= R; j++) ctx.lineTo(P[j][i][0], P[j][i][1]); }
    ctx.stroke();
    ctx.lineWidth = sel ? 2.8 : 1.6;
    ctx.beginPath();
    for (let i = 0; i <= C; i++) ctx[i ? 'lineTo' : 'moveTo'](P[0][i][0], P[0][i][1]);
    for (let j = 1; j <= R; j++) ctx.lineTo(P[j][C][0], P[j][C][1]);
    for (let i = C - 1; i >= 0; i--) ctx.lineTo(P[R][i][0], P[R][i][1]);
    for (let j = R - 1; j >= 0; j--) ctx.lineTo(P[j][0][0], P[j][0][1]);
    ctx.stroke();
  }
  function draw() {
    const g = sizeCanvas(canvas); ctx = g.ctx; W = g.w; H = g.h;
    ctx.clearRect(0, 0, W, H);
    const half = (S.n - 1) * spacing(S.explode) / 2;
    scale = 0.46 * Math.min(W, H * 1.15) / Math.hypot(half + 20, 96, 56);
    const order = [];
    for (let d = 0; d < S.n; d++) order.push({ d, depth: project(point(d, 0.5, 0.5))[2] });
    order.sort((a, b) => a.depth - b.depth);
    for (const { d } of order) drawLayer(d);
    dirty = false;
  }

  // drag to rotate
  let drag = null;
  canvas.style.touchAction = 'pan-y';
  canvas.style.cursor = 'grab';
  canvas.addEventListener('pointerdown', e => { drag = e.clientX; S.auto = false; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; });
  canvas.addEventListener('pointermove', e => { if (drag === null) return; S.ang += (e.clientX - drag) * 0.012; drag = e.clientX; dirty = true; });
  const end = () => { drag = null; canvas.style.cursor = 'grab'; };
  canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
  canvas.tabIndex = 0;
  canvas.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { S.ang -= 0.1; S.auto = false; dirty = true; e.preventDefault(); }
    if (e.key === 'ArrowRight') { S.ang += 0.1; S.auto = false; dirty = true; e.preventDefault(); }
  });

  const vis = visibility(canvas);
  addTicker(vis, dt => { if (S.auto) { phase += dt * 0.45; S.ang = ang0 + 0.8 * Math.sin(phase); dirty = true; } if (dirty) draw(); });
  onResize(canvas, () => { dirty = true; });

  return {
    S, vis, point,
    set(p) { Object.assign(S, p); dirty = true; },
    redraw() { dirty = true; },
  };
}

/* ================================================================ spiral geometry
   An Archimedean spiral and a made-up smooth "crush" of the plane, used by several tabs. */
const SPIRAL = { cx: 320, cy: 200, pitch: 26, r0: 14, thetaMax: (185 - 14) / 26 * TAU };
const idealPoint = th => {
  const r = SPIRAL.r0 + SPIRAL.pitch * th / TAU;
  return [SPIRAL.cx + r * Math.cos(th), SPIRAL.cy + r * Math.sin(th)];
};
const crush = (p, t = 1) => {
  const dx = p[0] - SPIRAL.cx, dy = p[1] - SPIRAL.cy;
  return [
    SPIRAL.cx + dx * (1 + 0.25 * t) + 14 * t * Math.sin(p[1] / 37),
    SPIRAL.cy + dy * (1 - 0.28 * t) + 0.12 * t * dx + 12 * t * Math.sin(p[0] / 45),
  ];
};
const spiralPts = (a, b, t = 1, step = 0.12) => {
  const pts = [];
  for (let th = a; th < b; th += step) pts.push(crush(idealPoint(th), t));
  pts.push(crush(idealPoint(b), t));
  return pts;
};
const ptsToPath = pts => pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');

window.Manual = {
  $, $$, svgEl, fixVars, clamp, lerp, smooth, ease, TAU, motionOK, cssVar, parseHex, mix, rgba,
  themeListeners, visibility, addTicker, sizeCanvas, onResize, rng,
  SW, SH, warp, dwarp, wf, wgrad, yOfWinding, valueNoise, hsl2rgb,
  scene, paintLayerCanvases, segSwitch, Stack3D,
  SPIRAL, idealPoint, crush, spiralPts, ptsToPath,
};
})();
