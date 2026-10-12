/* ThaumatoAnakalyptor tab: derivative-based surface points, and the sheet stitching problem. */
(() => {
'use strict';
const { $, svgEl, clamp, lerp, TAU, motionOK, cssVar, themeListeners, visibility, addTicker, valueNoise,
  SPIRAL, idealPoint, crush } = window.Manual;

/* ---------------------------------------------------------------- derivatives along a normal */
(() => {
  const svg = $('#thpSvg'), range = $('#thpThr'), out = $('#thpOut');
  const N = 290, X0 = 44, X1 = 624;
  const noise = valueNoise(5, 17);
  const peaks = [[88, 0.85], [205, 0.55]];                 // position (samples) and strength of two sheets
  const raw = Array.from({ length: N }, (_, i) => {
    let v = 0.12;
    peaks.forEach(([c, a]) => { v += a * Math.exp(-((i - c) ** 2) / (2 * 7 * 7)); });
    return v + (noise(i * 2.2, 40) - 0.5) * 0.07;
  });
  const blur = (a, r) => a.map((_, i) => { let s = 0, w = 0; for (let k = -Math.ceil(r * 3); k <= Math.ceil(r * 3); k++) { const j = i + k; if (j < 0 || j >= a.length) continue; const g = Math.exp(-(k * k) / (2 * r * r)); s += a[j] * g; w += g; } return s / w; });
  const I = blur(raw, 2.5);
  const d1 = I.map((_, i) => (i === 0 || i === N - 1 ? 0 : (I[i + 1] - I[i - 1]) / 2));
  const d2 = I.map((_, i) => (i === 0 || i === N - 1 ? 0 : I[i + 1] - 2 * I[i] + I[i - 1]));
  const d2max = Math.max(...d2.map(v => -v));
  const d1max = Math.max(...d1.map(Math.abs));
  const PX = i => X0 + i / (N - 1) * (X1 - X0);
  const rows = [
    { y0: 8, h: 100, label: 'brightness', color: 'var(--cos)', v: I, lo: 0, hi: 1.05 },
    { y0: 118, h: 78, label: 'first derivative', color: 'var(--dens)', v: d1, lo: -d1max * 1.1, hi: d1max * 1.1 },
    { y0: 206, h: 84, label: 'second derivative', color: 'var(--dir)', v: d2, lo: -d2max * 1.1, hi: d2max * 0.6 },
  ];
  const gBase = svgEl('g', {}, svg), gMark = svgEl('g', {}, svg);
  const Y = (r, v) => r.y0 + r.h - (v - r.lo) / (r.hi - r.lo) * r.h;
  function base() {
    gBase.textContent = '';
    rows.forEach(r => {
      svgEl('rect', { x: X0, y: r.y0, width: X1 - X0, height: r.h, fill: 'none', stroke: 'var(--line)' }, gBase);
      svgEl('path', { d: r.v.map((v, i) => (i ? 'L' : 'M') + PX(i).toFixed(1) + ' ' + Y(r, v).toFixed(1)).join(''), fill: 'none', stroke: r.color, 'stroke-width': 2 }, gBase);
      const t = svgEl('text', { x: X0 + 6, y: r.y0 + 14, class: 'cap' }, gBase); t.textContent = r.label;
    });
    svgEl('line', { x1: X0, x2: X1, y1: Y(rows[1], 0), y2: Y(rows[1], 0), stroke: 'var(--muted)', 'stroke-dasharray': '3 4', opacity: 0.6 }, gBase);
  }
  function mark() {
    gMark.textContent = '';
    const thr = range.value / 100; out.textContent = range.value + '%';
    const lim = -thr * d2max;
    svgEl('line', { x1: X0, x2: X1, y1: Y(rows[2], lim), y2: Y(rows[2], lim), stroke: 'var(--mesh)', 'stroke-width': 1.6, 'stroke-dasharray': '5 4' }, gMark);
    let n = 0;
    for (let i = 1; i < N - 1; i++) {
      if (d1[i - 1] > 0 && d1[i] <= 0 && d2[i] < lim) {
        n++;
        svgEl('line', { x1: PX(i), x2: PX(i), y1: rows[0].y0, y2: rows[2].y0 + rows[2].h, stroke: 'var(--mesh)', 'stroke-width': 1, opacity: 0.6, 'stroke-dasharray': '3 3' }, gMark);
        rows.forEach(r => svgEl('circle', { cx: PX(i), cy: Y(r, r.v[i]), r: 4.5, fill: 'var(--mesh)', stroke: '#000', 'stroke-width': 1 }, gMark));
      }
    }
    const t = svgEl('text', { x: X1 - 4, y: 24, class: 'cap', 'text-anchor': 'end', style: 'fill:var(--mesh)' }, gMark);
    t.textContent = n + ' surface point' + (n === 1 ? '' : 's') + ' found (there are 2 sheets)';
  }
  range.addEventListener('input', mark);
  themeListeners.push(() => { base(); mark(); });
  base(); mark();
})();

/* ---------------------------------------------------------------- sheet stitching */
(() => {
  const svg = $('#thgSvg'), play = $('#thgPlay'), resetBtn = $('#thgReset'), meter = $('#thgMeter');
  const D = 0.42, NN = Math.floor(SPIRAL.thetaMax / D);
  const hop = Math.round(TAU / D);                          // nodes per turn
  const trueTurn = i => Math.floor(i * D / TAU);
  const pos = [];
  for (let i = 0; i < NN; i++) pos.push(crush(idealPoint(i * D), 1));

  // edges: [u, v, hint] says "angle(v) - angle(u) is about hint"
  const edges = [], bad = new Set();
  for (let i = 0; i < NN - 1; i++) edges.push({ u: i, v: i + 1, d: D, kind: 'along' });
  for (let i = 0; i + hop < NN; i += 3) edges.push({ u: i, v: i + hop, d: TAU, kind: 'across' });
  [12, 40, 53, 68].forEach(i => { if (i + 2 * hop < NN) { edges.push({ u: i, v: i + 2 * hop, d: TAU, kind: 'wrong' }); } });   // skips a sheet, hint says one
  const nbr = Array.from({ length: NN }, () => []);
  edges.forEach((e, k) => { nbr[e.u].push(k); nbr[e.v].push(k); });

  const gE = svgEl('g', {}, svg), gN = svgEl('g', {}, svg);
  edges.forEach(e => {
    const a = pos[e.u], b = pos[e.v];
    if (e.kind === 'along') svgEl('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: '#8d8374', 'stroke-width': 1, opacity: 0.5 }, gE);
    else if (e.kind === 'across') svgEl('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: '#8d8374', 'stroke-width': 0.8, opacity: 0.3 }, gE);
    else svgEl('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: '#ff5a5a', 'stroke-width': 2, 'stroke-dasharray': '5 4' }, gE);
  });
  const dots = pos.map(p => {
    const ring = svgEl('circle', { cx: p[0], cy: p[1], r: 8, fill: 'none', stroke: '#fff', 'stroke-width': 2, opacity: 0 }, gN);
    const c = svgEl('circle', { cx: p[0], cy: p[1], r: 4.6, stroke: '#000', 'stroke-width': 0.8 }, gN);
    return { ring, c };
  });
  const hue = k => `hsl(${(((k % 7) + 7) % 7) * 51 + 12} 72% 62%)`;

  let a, iter = 0, solving = false, acc = 0;
  function initial() {                                       // spread out from node 0 along the shortest paths
    a = new Array(NN).fill(null); a[0] = 0;
    let q = [0];
    while (q.length) {
      const next = [];
      q.forEach(i => nbr[i].forEach(k => {
        const e = edges[k], j = e.u === i ? e.v : e.u;
        if (a[j] === null) { a[j] = e.u === i ? a[i] + e.d : a[i] - e.d; next.push(j); }
      }));
      q = next;
    }
    iter = 0;
  }
  function relax() {
    const nx = a.map((v, i) => {
      if (i === 0) return 0;
      const props = nbr[i].map(k => { const e = edges[k]; return e.u === i ? a[e.v] - e.d : a[e.u] + e.d; }).sort((p, q) => p - q);
      return props[Math.floor(props.length / 2)];
    });
    a = nx; iter++;
  }
  function draw() {
    let wrong = 0;
    a.forEach((v, i) => {
      const k = Math.floor((v + 1e-6) / TAU), ok = k === trueTurn(i);
      if (!ok) wrong++;
      dots[i].c.setAttribute('fill', hue(k));
      dots[i].ring.setAttribute('opacity', ok ? 0 : 1);
    });
    meter.innerHTML = 'Round <b>' + iter + '</b> · patches on the wrong winding: <b>' + wrong + '</b> of ' + NN;
    return wrong;
  }
  function setSolving(s) { solving = s; play.textContent = s ? 'Pause' : (iter >= 16 ? 'Again' : 'Solve'); }
  play.addEventListener('click', () => {
    if (!solving && iter >= 16) { initial(); draw(); }
    if (!motionOK()) { while (iter < 16) relax(); draw(); setSolving(false); return; }
    setSolving(!solving);
  });
  resetBtn.addEventListener('click', () => { initial(); draw(); setSolving(false); });
  const vis = visibility(svg);
  addTicker(vis, dt => {
    if (!solving) return;
    acc += dt;
    if (acc > 0.5) { acc = 0; relax(); draw(); if (iter >= 16) setSolving(false); }
  });
  initial(); draw();
})();
})();
