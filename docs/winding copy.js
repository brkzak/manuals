/* Winding model tab: a ray and its phase, then many rays that have to agree. */
(() => {
'use strict';
const { $, svgEl, clamp, lerp, TAU, motionOK, cssVar, themeListeners, visibility, addTicker,
  SW, SH, wf, wgrad, yOfWinding, valueNoise, rng, scene } = window.Manual;

const SEED_W = 8, N0 = 40;                         // winding number of the seed in the scene, and its "absolute" label

/* follow the surface normal through (x0, y0), until the winding changes by `span` or the picture ends */
function streamline(x0, y0, w0, span) {
  const walk = dir => {
    let x = x0, y = y0, s = 0; const out = [];
    for (let i = 0; i < 600; i++) {
      const [gx, gy] = wgrad(x, y), m = Math.hypot(gx, gy);
      x += dir * gx / m * 2; y += dir * gy / m * 2; s += dir * 2;
      const w = wf(x, y);
      if (x < 2 || x > SW - 2 || y < 2 || y > SH - 2 || Math.abs(w - w0) > span) break;
      out.push({ x, y, s, w });
    }
    return out;
  };
  return [...walk(-1).reverse(), { x: x0, y: y0, s: 0, w: w0 }, ...walk(1)];
}
/* positions where a quantity q(i) passes an integer */
function crossings(pts, q) {
  const out = [];
  for (let i = 1; i < pts.length; i++) {
    const a = q(i - 1), b = q(i);
    for (let k = Math.floor(a) + 1; k <= Math.floor(b); k++) {
      const t = (k - a) / (b - a);
      out.push({ k, x: lerp(pts[i - 1].x, pts[i].x, t), y: lerp(pts[i - 1].y, pts[i].y, t), s: lerp(pts[i - 1].s, pts[i].s, t) });
    }
  }
  return out;
}
const hue = n => `hsl(${(((n % 6) + 6) % 6) * 60 + 8} 80% 62%)`;

/* ---------------------------------------------------------------- one ray */
(() => {
  const canvas = $('#wmCanvas'), svg = $('#wmSvg'), plot = $('#wmPlot'), noise = $('#wmNoise'), rawChk = $('#wmShift'), meter = $('#wmMeter');
  canvas.width = SW; canvas.height = SH;
  canvas.getContext('2d').drawImage(scene.scan, 0, 0);
  const err1d = valueNoise(26, 31);
  const OFFSET = 3.37;                              // the unknown shift of the raw phase
  const gRay = svgEl('g', {}, svg);
  const state = { x: 300, tx: 300, hold: 0 };

  function draw() {
    const x0 = state.x, y0 = yOfWinding(x0, SEED_W);
    const pts = streamline(x0, y0, SEED_W, 4.6);
    const amp = noise.value / 100 * 0.32;
    const si = pts.findIndex(p => p.s === 0);
    let prev = -1e9;
    const phi = pts.map((p, i) => {
      let v = p.w + OFFSET + amp * (err1d(i * 2.3, 60 + x0 * 0.05) - 0.5) * 2;
      v = Math.max(v, prev + 1e-4); prev = v; return v;
    });
    const raw = rawChk.checked;
    const shift = phi[si] - N0;
    const q = i => (raw ? phi[i] : phi[i] - shift);
    const cr = crossings(pts, q);
    gRay.textContent = '';
    svgEl('path', { d: pts.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(''), fill: 'none', stroke: '#fff', 'stroke-width': 1.6, 'stroke-dasharray': '5 4', opacity: 0.9 }, gRay);
    const trueCr = crossings(pts, i => pts[i].w);
    let maxErr = 0;
    cr.forEach(c => {
      if (!raw) {
        const truth = trueCr.find(t => t.k === SEED_W + (c.k - N0));
        if (truth) maxErr = Math.max(maxErr, Math.abs(truth.s - c.s));
      }
      svgEl('circle', { cx: c.x, cy: c.y, r: 5, fill: raw ? '#ff8a8a' : hue(c.k), stroke: '#000', 'stroke-width': 1.2 }, gRay);
      if (!raw) { const t = svgEl('text', { x: c.x + 9, y: c.y + 4, class: 'lab' }, gRay); t.textContent = c.k; }
    });
    svgEl('circle', { cx: x0, cy: y0, r: 11, fill: 'none', stroke: '#fff', 'stroke-width': 2.4 }, gRay);

    // phase plot: position along the ray (down) against phase (right)
    plot.textContent = '';
    const sMin = pts[0].s, sMax = pts[pts.length - 1].s;
    const vMin = q(0), vMax = q(pts.length - 1);
    const Y = s => 14 + (s - sMin) / (sMax - sMin) * 372, X = v => 14 + (v - vMin) / (vMax - vMin) * 118;
    svgEl('rect', { x: 0, y: 0, width: 150, height: 400, fill: 'none' }, plot);
    cr.forEach(c => svgEl('line', { x1: 0, x2: 150, y1: Y(c.s), y2: Y(c.s), stroke: '#4a4237', 'stroke-width': 1 }, plot));
    svgEl('path', { d: pts.map((p, i) => (i ? 'L' : 'M') + X(q(i)).toFixed(1) + ' ' + Y(p.s).toFixed(1)).join(''), fill: 'none', stroke: cssVar('--cos'), 'stroke-width': 2.4 }, plot);
    cr.forEach(c => {
      svgEl('circle', { cx: X(c.k), cy: Y(c.s), r: 3.6, fill: raw ? '#ff8a8a' : hue(c.k), stroke: '#000', 'stroke-width': 1 }, plot);
    });
    svgEl('circle', { cx: X(q(si)), cy: Y(0), r: 7, fill: 'none', stroke: '#fff', 'stroke-width': 2 }, plot);
    const tt = svgEl('text', { x: 6, y: 394, class: 'axis' }, plot); tt.textContent = 'phase →';
    if (raw) meter.innerHTML = 'Raw phase: it passes whole numbers <b>' + (OFFSET % 1).toFixed(2) + '</b> of a winding away from the true crossings (red dots). The seed fixes that shift.';
    else meter.innerHTML = 'Seed winding <b>' + N0 + '</b> at the ring · <b>' + cr.length + '</b> crossings, numbered <b>' + cr[0].k + '</b> to <b>' + cr[cr.length - 1].k + '</b> · largest distance from the true crossing <b>' + maxErr.toFixed(1) + ' px</b>';
  }

  function toViewBox(e) { const r = svg.getBoundingClientRect(); return (e.clientX - r.left) / r.width * 640; }
  svg.addEventListener('pointermove', e => { state.tx = clamp(toViewBox(e), 40, 600); state.hold = 3; });
  svg.addEventListener('pointerdown', e => { state.tx = clamp(toViewBox(e), 40, 600); state.hold = 3; });
  svg.tabIndex = 0;
  svg.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { state.tx = clamp(state.tx - 12, 40, 600); state.hold = 6; e.preventDefault(); }
    if (e.key === 'ArrowRight') { state.tx = clamp(state.tx + 12, 40, 600); state.hold = 6; e.preventDefault(); }
  });
  [noise, rawChk].forEach(c => c.addEventListener('input', draw));
  const vis = visibility(svg);
  addTicker(vis, (dt, now) => {
    if (state.hold > 0) state.hold -= dt; else if (motionOK()) state.tx = 320 + 220 * Math.sin(now * 0.35);
    const nx = lerp(state.x, state.tx, 1 - Math.exp(-dt * 8));
    if (Math.abs(nx - state.x) > 0.05) { state.x = nx; draw(); }
  });
  themeListeners.push(draw);
  draw();
})();

/* ---------------------------------------------------------------- many rays, one numbering */
(() => {
  const canvas = $('#wmmCanvas'), svg = $('#wmmSvg'), sync = $('#wmSync'), regen = $('#wmRegen'), meter = $('#wmmMeter');
  canvas.width = SW; canvas.height = SH;
  canvas.getContext('2d').drawImage(scene.scan, 0, 0);
  const XS = Array.from({ length: 9 }, (_, i) => 38 + i * 70);
  const SEEDS = [5, 8, 11];
  let rays = [], seedNo = 3;

  function build() {
    const r = rng(seedNo * 101 + 7);
    rays = [];
    XS.forEach((x, xi) => SEEDS.forEach((ws, si) => {
      const pts = streamline(x, yOfWinding(x, ws), ws, 3.5);
      const cr = crossings(pts, i => pts[i].w);
      const bad = r() < 0.15 ? (r() < 0.5 ? -1 : 1) : 0;       // how far this ray's seed number is off
      rays.push({ x, xi, si, ws, pts, cr, bad, off: 0 });
    }));
  }
  const label = (ray, c) => N0 + (c.k - SEED_W) + ray.bad;     // number the ray reports for a crossing at winding c.k
  function solve() {
    rays.forEach(r => { r.off = 0; });
    const nb = rays.map(a => rays.filter(b => b !== a && Math.abs(a.xi - b.xi) <= 1 && a.cr.some(c => b.cr.some(d => d.k === c.k))));
    for (let it = 0; it < 25; it++) {
      const next = rays.map((a, i) => {
        const props = [];
        nb[i].forEach(b => a.cr.forEach(c => {
          if (b.cr.some(d => d.k === c.k)) props.push((label(a, c) - a.off) - (label(b, c) - b.off) + a.off);
        }));
        if (!props.length) return a.off;
        props.sort((p, q) => p - q);
        return props[Math.floor(props.length / 2)];
      });
      rays.forEach((a, i) => { a.off = next[i]; });
    }
  }
  function draw() {
    svg.textContent = '';
    if (sync.checked) solve(); else rays.forEach(r => { r.off = 0; });
    let wrong = 0, total = 0;
    rays.forEach(r => {
      svgEl('path', { d: r.pts.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(''), fill: 'none', stroke: '#fff', 'stroke-width': 1, opacity: 0.35 }, svg);
    });
    rays.forEach(r => {
      r.cr.forEach(c => {
        const lab = label(r, c) - r.off, truth = N0 + (c.k - SEED_W);
        total++; if (lab !== truth) wrong++;
        svgEl('circle', { cx: c.x, cy: c.y, r: 3.8, fill: hue(lab), stroke: '#000', 'stroke-width': 0.9 }, svg);
      });
      svgEl('circle', { cx: r.x, cy: yOfWinding(r.x, r.ws), r: 6.5, fill: 'none', stroke: '#fff', 'stroke-width': 1.6 }, svg);
    });
    const nbad = rays.filter(r => r.bad).length;
    meter.innerHTML = '<b>' + rays.length + '</b> rays, <b>' + nbad + '</b> with a seed number that is off by one · dots with the wrong number: <b>' + wrong + '</b> of ' + total;
  }
  sync.addEventListener('change', draw);
  regen.addEventListener('click', () => { seedNo++; build(); draw(); });
  build(); draw();
  themeListeners.push(draw);
})();
})();
