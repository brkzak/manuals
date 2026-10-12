/* Spiral tab: an ideal spiral, a smooth deformation, and a toy fit to sparse evidence. */
(() => {
'use strict';
const { $, svgEl, clamp, lerp, ease, smooth, TAU, motionOK, cssVar, themeListeners, visibility, addTicker,
  SPIRAL, idealPoint, crush, spiralPts, ptsToPath } = window.Manual;

const TH = SPIRAL.thetaMax;
const TURNS = Math.floor(TH / TAU);            // windings 0 .. TURNS (the last one is partial)
const turnHue = k => `hsl(${(k * 47 + 18) % 360} 72% 62%)`;

/* ---------------------------------------------------------------- ideal spiral -> crushed spiral */
(() => {
  const svg = $('#spmSvg'), range = $('#spmT'), play = $('#spmPlay'), read = $('#spmRead');
  const ghost = svgEl('path', { d: ptsToPath(spiralPts(0, TH, 0)), fill: 'none', stroke: '#6b6256', 'stroke-width': 1.4, 'stroke-dasharray': '4 5', opacity: 0.8 }, svg);
  const gSp = svgEl('g', {}, svg);
  const turnPaths = [];
  for (let k = 0; k <= TURNS; k++) turnPaths.push(svgEl('path', { fill: 'none', stroke: turnHue(k), 'stroke-width': 4.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, gSp));
  const link = svgEl('line', { stroke: '#fff', 'stroke-width': 1.3, 'stroke-dasharray': '4 4', opacity: 0 }, svg);
  const mIdeal = svgEl('circle', { r: 5, fill: 'none', stroke: '#fff', 'stroke-width': 1.8, opacity: 0 }, svg);
  const mNow = svgEl('circle', { r: 6, fill: '#fff', stroke: '#000', 'stroke-width': 1.5, opacity: 0 }, svg);

  let t = 0, anim = false, hover = null;
  const samples = [];
  for (let th = 0; th <= TH; th += 0.05) samples.push(th);

  function draw() {
    for (let k = 0; k <= TURNS; k++) {
      const a = k * TAU, b = Math.min(TH, (k + 1) * TAU);
      turnPaths[k].setAttribute('d', ptsToPath(spiralPts(a, b, t)));
    }
    ghost.style.opacity = String(1 - t * 0.7);
    updateHover();
  }
  function updateHover() {
    if (!hover) { [link, mIdeal, mNow].forEach(e => e.setAttribute('opacity', 0)); return; }
    let best = 0, bd = 1e12;
    for (let i = 0; i < samples.length; i++) {
      const p = crush(idealPoint(samples[i]), t), d = (p[0] - hover[0]) ** 2 + (p[1] - hover[1]) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    const th = samples[best], p = crush(idealPoint(th), t), q = idealPoint(th);
    if (Math.sqrt(bd) > 40) { [link, mIdeal, mNow].forEach(e => e.setAttribute('opacity', 0)); read.textContent = 'Move the pointer over the spiral.'; return; }
    mNow.setAttribute('cx', p[0]); mNow.setAttribute('cy', p[1]); mNow.setAttribute('opacity', 1);
    mIdeal.setAttribute('cx', q[0]); mIdeal.setAttribute('cy', q[1]); mIdeal.setAttribute('opacity', 1);
    link.setAttribute('x1', p[0]); link.setAttribute('y1', p[1]); link.setAttribute('x2', q[0]); link.setAttribute('y2', q[1]); link.setAttribute('opacity', 0.8);
    const k = Math.floor(th / TAU), deg = Math.round((th % TAU) * 180 / Math.PI);
    read.innerHTML = 'This point is on winding <b>' + k + '</b>, <b>' + deg + '°</b> around the center. On the ideal sheet it sits <b>' + (th / TAU).toFixed(2) + '</b> turns along from the middle (the ring).';
  }
  function setT(v) { t = clamp(v, 0, 1); range.value = String(Math.round(t * 100)); draw(); }
  range.addEventListener('input', () => { anim = false; play.textContent = 'Play'; t = range.value / 100; draw(); });
  play.addEventListener('click', () => { if (anim) { anim = false; play.textContent = 'Play'; } else { if (t >= 1) setT(0); anim = true; play.textContent = 'Pause'; } });
  svg.addEventListener('pointermove', e => {
    const r = svg.getBoundingClientRect();
    hover = [(e.clientX - r.left) / r.width * 640, (e.clientY - r.top) / r.height * 400]; updateHover();
  });
  svg.addEventListener('pointerleave', () => { hover = null; updateHover(); read.textContent = 'Move the pointer over the spiral.'; });
  const vis = visibility(svg);
  let auto = false;
  addTicker(vis, dt => {
    if (!auto && vis.seen) { auto = true; if (motionOK()) setTimeout(() => { anim = true; play.textContent = 'Pause'; }, 500); }
    if (!anim) return;
    setT(t + dt / 3.2);
    if (t >= 1) { anim = false; play.textContent = 'Replay'; }
  });
  draw();
})();

/* ---------------------------------------------------------------- toy fit to sparse evidence */
(() => {
  const svg = $('#spfSvg'), play = $('#spfPlay'), resetBtn = $('#spfReset'), cov = $('#spfCov'), truthChk = $('#spfTruth'), meter = $('#spfMeter');
  const M = 64;                                                   // samples per winding on the fitted spiral
  const C = [SPIRAL.cx, SPIRAL.cy];

  // deformation model: an affine map plus a smooth displacement field on a coarse grid
  const NX = 6, NY = 6, SIG = 58;
  const nodes = [];
  for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) nodes.push([135 + i * 74, 15 + j * 74]);
  const NN = nodes.length;
  const W = p => {                     // normalised Gaussian weights at an ideal-space point
    const w = new Float64Array(NN); let s = 0;
    for (let n = 0; n < NN; n++) { const dx = p[0] - nodes[n][0], dy = p[1] - nodes[n][1]; w[n] = Math.exp(-(dx * dx + dy * dy) / (2 * SIG * SIG)); s += w[n]; }
    for (let n = 0; n < NN; n++) w[n] /= s;
    return w;
  };

  // parameters: M (2x2), b (2), u (NN x 2)
  let par, adam, iter = 0, running = false;
  function resetParams() {
    par = { M: [1, 0, 0, 1], b: [0, 0], u: new Float64Array(NN * 2) };
    const zeros = () => ({ M: new Float64Array(4), b: new Float64Array(2), u: new Float64Array(NN * 2) });
    adam = { m: zeros(), v: zeros(), t: 0 };
    iter = 0;
  }
  function deform(p, w) {
    const dx = p[0] - C[0], dy = p[1] - C[1];
    let x = C[0] + par.M[0] * dx + par.M[1] * dy + par.b[0], y = C[1] + par.M[2] * dx + par.M[3] * dy + par.b[1];
    for (let n = 0; n < NN; n++) { x += w[n] * par.u[2 * n]; y += w[n] * par.u[2 * n + 1]; }
    return [x, y];
  }

  // the sampled ideal spiral: M+1 points per winding, with their weights
  const ideal = [];
  for (let k = 0; k <= TURNS; k++) {
    const row = [];
    for (let s = 0; s <= M; s++) { const th = Math.min(TH, k * TAU + TAU * s / M), p = idealPoint(th); row.push({ th, p, w: W(p) }); }
    ideal.push(row);
  }

  // evidence pieces: each is a stretch of one winding, known to be on that winding
  const pieces = [];
  for (let i = 0; i < 24; i++) {
    const k = (i * 3) % (TURNS + 1);
    const a0 = (i * 2.399 + 0.5) % TAU, len = 0.55 + 0.55 * ((i * 0.618) % 1);
    const th0 = k * TAU + a0, th1 = Math.min(TH, th0 + len);
    if (th0 >= TH) { pieces.push(null); continue; }
    const pts = [];
    for (let s = 0; s <= 6; s++) { const th = lerp(th0, th1, s / 6); pts.push({ k: Math.floor(th / TAU), q: crush(idealPoint(th), 1), th }); }
    pieces.push({ k, th0, th1, pts });
  }
  const live = () => pieces.slice(0, +cov.value).filter(Boolean);

  const truth = ptsToPath(spiralPts(0, TH, 1));
  const gTruth = svgEl('path', { d: truth, fill: 'none', stroke: '#8d8374', 'stroke-width': 5, opacity: 0.5, 'stroke-linecap': 'round' }, svg);
  const gEv = svgEl('g', {}, svg);
  const turnPaths = [];
  for (let k = 0; k <= TURNS; k++) turnPaths.push(svgEl('path', { fill: 'none', 'stroke-width': 3.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, svg));

  function drawEvidence() {
    gEv.textContent = '';
    live().forEach(pc => {
      svgEl('path', { d: ptsToPath(pc.pts.map(p => p.q)), fill: 'none', stroke: turnHue(pc.k), 'stroke-width': 7, 'stroke-linecap': 'round' }, gEv);
    });
  }

  // nearest point on the fitted spiral of winding k for each evidence point (closest segment)
  function assign(deformed, pts) {
    return pts.map(ev => {
      const row = deformed[ev.k], idl = ideal[ev.k];
      let best = null, bd = 1e18;
      for (let s = 0; s < M; s++) {
        const a = row[s], b = row[s + 1], vx = b[0] - a[0], vy = b[1] - a[1];
        const l2 = vx * vx + vy * vy || 1e-9;
        const u = clamp(((ev.q[0] - a[0]) * vx + (ev.q[1] - a[1]) * vy) / l2, 0, 1);
        const px = a[0] + u * vx, py = a[1] + u * vy, d = (px - ev.q[0]) ** 2 + (py - ev.q[1]) ** 2;
        if (d < bd) { bd = d; best = { s, u, rx: px - ev.q[0], ry: py - ev.q[1] }; }
      }
      const A = idl[best.s], B = idl[best.s + 1];
      const w = new Float64Array(NN);
      for (let n = 0; n < NN; n++) w[n] = lerp(A.w[n], B.w[n], best.u);
      return { ...best, P: [lerp(A.p[0], B.p[0], best.u), lerp(A.p[1], B.p[1], best.u)], w };
    });
  }
  function deformedAll() { return ideal.map(row => row.map(o => deform(o.p, o.w))); }

  const LR = { M: 0.0004, b: 0.18, u: 0.3 }, LAM_U = 0.0004, LAM_M = 60, LAM_S = 0.004;
  function step() {
    const def = deformedAll(), ev = live().flatMap(pc => pc.pts);
    if (!ev.length) { iter++; return; }
    const hits = assign(def, ev), n = hits.length;
    const g = { M: new Float64Array(4), b: new Float64Array(2), u: new Float64Array(NN * 2) };
    hits.forEach(h => {
      const dx = h.P[0] - C[0], dy = h.P[1] - C[1], f = 2 / n;
      g.M[0] += f * h.rx * dx; g.M[1] += f * h.rx * dy; g.M[2] += f * h.ry * dx; g.M[3] += f * h.ry * dy;
      g.b[0] += f * h.rx; g.b[1] += f * h.ry;
      for (let k = 0; k < NN; k++) { g.u[2 * k] += f * h.w[k] * h.rx; g.u[2 * k + 1] += f * h.w[k] * h.ry; }
    });
    // regularisation: keep the affine part near identity, the field small and smooth
    const I = [1, 0, 0, 1];
    for (let i = 0; i < 4; i++) g.M[i] += 2 * LAM_M * (par.M[i] - I[i]) / 1000;
    for (let k = 0; k < NN * 2; k++) g.u[k] += 2 * LAM_U * par.u[k];
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      const a = j * NX + i;
      [[i + 1, j], [i, j + 1]].forEach(([ii, jj]) => {
        if (ii >= NX || jj >= NY) return;
        const bb = jj * NX + ii;
        for (let c = 0; c < 2; c++) { const d = par.u[2 * a + c] - par.u[2 * bb + c]; g.u[2 * a + c] += 2 * LAM_S * d; g.u[2 * bb + c] -= 2 * LAM_S * d; }
      });
    }
    // Adam
    adam.t++;
    const b1 = 0.9, b2 = 0.999, c1 = 1 - Math.pow(b1, adam.t), c2 = 1 - Math.pow(b2, adam.t);
    const upd = (name, arr, lr) => {
      for (let i = 0; i < arr.length; i++) {
        adam.m[name][i] = b1 * adam.m[name][i] + (1 - b1) * g[name][i];
        adam.v[name][i] = b2 * adam.v[name][i] + (1 - b2) * g[name][i] ** 2;
        arr[i] -= lr * (adam.m[name][i] / c1) / (Math.sqrt(adam.v[name][i] / c2) + 1e-8);
      }
    };
    const Mx = par.M, bx = par.b;
    upd('M', Mx, LR.M); upd('b', bx, LR.b); upd('u', par.u, LR.u);
    iter++;
  }

  // distance from each winding of the fitted spiral to the same winding of the truth
  const tp = [];
  for (let k = 0; k <= TURNS; k++) {
    const row = [];
    for (let th = k * TAU; th <= Math.min(TH, (k + 1) * TAU) + 1e-9; th += 0.05) row.push(crush(idealPoint(th), 1));
    tp.push(row);
  }
  function miss(def) {
    let s = 0, c = 0;
    def.forEach((row, k) => row.forEach((p, i) => {
      if (i % 2) return;
      let bd = 1e18; for (let q = 0; q < tp[k].length; q++) { const d = (tp[k][q][0] - p[0]) ** 2 + (tp[k][q][1] - p[1]) ** 2; if (d < bd) bd = d; }
      s += Math.sqrt(bd); c++;
    }));
    return s / c;
  }

  let lastMiss = NaN;
  function draw(full = true) {
    const def = deformedAll();
    for (let k = 0; k <= TURNS; k++) {
      turnPaths[k].setAttribute('d', ptsToPath(def[k]));
      turnPaths[k].setAttribute('stroke', cssVar('--mesh'));
    }
    if (full || iter % 8 === 0) lastMiss = miss(def);
    const nPieces = live().length;
    meter.innerHTML = 'Step <b>' + iter + '</b> · ' + nPieces + ' evidence pieces · average distance from the true windings <b>' + lastMiss.toFixed(1) + ' px</b>';
  }
  gTruth.style.display = '';
  truthChk.addEventListener('change', () => { gTruth.style.display = truthChk.checked ? '' : 'none'; });
  cov.addEventListener('input', () => { drawEvidence(); draw(true); });
  function setRunning(r) { running = r; play.textContent = r ? 'Pause' : 'Play'; }
  play.addEventListener('click', () => setRunning(!running));
  resetBtn.addEventListener('click', () => { resetParams(); draw(true); });
  const vis = visibility(svg);
  let auto = false;
  addTicker(vis, () => {
    if (!auto && vis.seen) { auto = true; if (motionOK()) setTimeout(() => setRunning(true), 700); }
    if (!running) return;
    step(); draw(false);
  });
  themeListeners.push(() => draw(false));
  resetParams(); drawEvidence(); draw(true);
})();
})();
