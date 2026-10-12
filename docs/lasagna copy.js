/* Lasagna tab: the four-step walkthrough. */
(() => {
'use strict';
const { $, $$, svgEl, clamp, lerp, smooth, ease, TAU, motionOK, cssVar, themeListeners, visibility, addTicker,
  sizeCanvas, onResize, SW, SH, wf, wgrad, yOfWinding, valueNoise, scene, paintLayerCanvases, segSwitch, Stack3D } = window.Manual;

/* ================================================================ hero */
const hero = Stack3D($('#heroStack'), { n: 8, explode: 0.4, ang: 0.45 });
if (motionOK()) addTicker(hero.vis, (dt, t) => hero.set({ explode: 0.45 + 0.25 * Math.sin(t * 0.6) }));

/* ================================================================ idea: zoom into a scroll */
(() => {
  const canvas = $('#zoomCanvas'), range = $('#zoomRange'), play = $('#zoomPlay'), labels = $('#zoomLabels');
  const LW = 720, LH = 420, CX = 360, CY = 232, A0 = 12, PITCH = 15, B = PITCH / TAU, ZMAX = 9;
  const thetaMax = (205 - A0) / B;
  // patch sits where the spiral crosses the top of the scroll, so the layers run left to right
  const m0 = 10, thPatch = -Math.PI / 2 + TAU * m0;
  const rPatch = A0 + B * thPatch, patchX = CX, patchY = CY - rPatch;
  let t = 0, anim = null;

  // labels
  const g = svgEl('g', { id: 'zl' }, labels);
  [['winding n + 2', 11], ['winding n + 1', 10], ['winding n', 9]].forEach(([txt, m]) => {
    const r = A0 + B * (-Math.PI / 2 + TAU * m);
    const sy = 210 + ((CY - r) - patchY) * ZMAX;
    svgEl('line', { x1: 560, x2: 606, y1: sy, y2: sy }, g);
    const tx = svgEl('text', { x: 614, y: sy + 5 }, g); tx.textContent = txt;
  });
  const brace = svgEl('text', { x: 24, y: 40, 'font-size': 13, 'font-weight': 500 }, g);
  brace.textContent = 'Each band is one winding. Together they form a stack of layers.';
  const patch = svgEl('rect', { class: 'patch', rx: 2 }, labels);

  function view(tt) {
    const e = smooth(tt);
    return { z: Math.exp(lerp(0, Math.log(ZMAX), e)), cx: lerp(CX, patchX, e), cy: lerp(CY, patchY, e), e };
  }
  function draw() {
    const { ctx, w, h } = sizeCanvas(canvas);
    const v = view(t);
    ctx.fillStyle = '#14110d'; ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.scale(w / LW, h / LH);
    ctx.translate(LW / 2, LH / 2); ctx.scale(v.z, v.z); ctx.translate(-v.cx, -v.cy);
    ctx.lineCap = 'round';
    let px = CX + A0, py = CY;
    for (let th = 0.06; th < thetaMax; th += 0.06) {
      const r = A0 + B * th, x = CX + r * Math.cos(th), y = CY + r * Math.sin(th);
      ctx.strokeStyle = `rgba(${196 + 14 * Math.sin(th * 0.7) | 0},${160 + 12 * Math.sin(th * 0.5) | 0},${104 | 0},0.92)`;
      ctx.lineWidth = 5.4 + 1.0 * Math.sin(th * 0.9);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
      px = x; py = y;
    }
    ctx.restore();
    // marked square: its size is what the view shows at full zoom
    const pw = LW / ZMAX, ph = LH / ZMAX;
    const sx = LW / 2 + (patchX - pw / 2 - v.cx) * v.z, sy = LH / 2 + (patchY - ph / 2 - v.cy) * v.z;
    patch.setAttribute('x', sx); patch.setAttribute('y', sy);
    patch.setAttribute('width', pw * v.z); patch.setAttribute('height', ph * v.z);
    patch.style.opacity = String(clamp(1 - v.e * 1.6, 0, 1));
    g.style.opacity = String(clamp((v.e - 0.72) / 0.28, 0, 1));
  }
  function setT(tt) { t = clamp(tt, 0, 1); range.value = String(Math.round(t * 100)); draw(); }
  range.addEventListener('input', () => { anim = null; t = range.value / 100; play.textContent = t >= 1 ? 'Replay' : 'Play'; draw(); });
  function start() { anim = { t0: null }; setT(t >= 1 ? 0 : t); play.textContent = 'Pause'; }
  play.addEventListener('click', () => {
    if (anim) { anim = null; play.textContent = 'Play'; } else start();
  });
  const vis = visibility(canvas);
  let auto = false;
  addTicker(vis, (dt) => {
    if (!auto && vis.seen) { auto = true; if (motionOK()) setTimeout(start, 500); }
    if (!anim) return;
    t = clamp(t + dt / 3.6, 0, 1);
    setT(t);
    if (t >= 1) { anim = null; play.textContent = 'Replay'; }
  });
  onResize(canvas, draw);
  themeListeners.push(draw);
  draw();
})();

/* ================================================================ step 1: hint fields + probe */
(() => {
  const fig = $('#figHints'), svg = $('#probeSvg'), prof = $('#profileSvg');
  paintLayerCanvases(fig, 'view');
  const ticks = svgEl('g', { class: 'ticks', style: 'display:none' }, svg);
  for (let y = 20; y < SH; y += 40) for (let x = 20; x < SW; x += 40) {
    const [gx, gy] = wgrad(x, y), m = Math.hypot(gx, gy), nx = gx / m, ny = gy / m;
    svgEl('line', { x1: x - nx * 11, y1: y - ny * 11, x2: x + nx * 11, y2: y + ny * 11, stroke: '#fff', 'stroke-width': 2, 'stroke-linecap': 'round', opacity: 0.9 }, ticks);
    svgEl('circle', { cx: x, cy: y, r: 2.4, fill: '#fff' }, ticks);
  }
  segSwitch(fig, 'view', v => { ticks.style.display = v === 'dir' ? '' : 'none'; });

  const nrm = svgEl('line', { stroke: '#a891f2', 'stroke-width': 4, 'stroke-linecap': 'round' }, svg);
  const ringO = svgEl('circle', { r: 9, fill: 'none', stroke: '#000', 'stroke-width': 4.5, opacity: 0.55 }, svg);
  const ring = svgEl('circle', { r: 9, fill: 'none', stroke: '#fff', 'stroke-width': 2.2 }, svg);

  // cos profile strip
  svgEl('rect', { x: 0, y: 0, width: 110, height: 400, fill: 'none' }, prof);
  svgEl('line', { x1: 10, x2: 10, y1: 0, y2: 400, stroke: '#4a4237', 'stroke-width': 1 }, prof);
  svgEl('line', { x1: 100, x2: 100, y1: 0, y2: 400, stroke: '#4a4237', 'stroke-width': 1, 'stroke-dasharray': '3 4' }, prof);
  const pArea = svgEl('path', { fill: 'rgba(240,177,58,.28)', stroke: '#f0b13a', 'stroke-width': 1.6 }, prof);
  const pLine = svgEl('line', { x1: 0, x2: 110, stroke: '#fff', 'stroke-width': 1, opacity: 0.5 }, prof);
  const pDot = svgEl('circle', { r: 5, fill: '#fff', stroke: '#000', 'stroke-width': 1 }, prof);
  const pLab = svgEl('text', { x: 14, y: 16, fill: '#f0b13a', 'font-size': 12, 'font-weight': 600 }, prof); pLab.textContent = 'cos';
  const pOne = svgEl('text', { x: 98, y: 392, fill: '#a99f90', 'font-size': 10, 'text-anchor': 'end' }, prof); pOne.textContent = '1';
  const pZero = svgEl('text', { x: 14, y: 392, fill: '#a99f90', 'font-size': 10 }, prof); pZero.textContent = '0';

  const rdCos = $('#rdCos'), rdBar = $('#rdCosBar'), rdDens = $('#rdDens'), rdDir = $('#rdDir');
  const P = { x: 320, y: 200, tx: 320, ty: 200, hold: 0 };
  function update() {
    const w = wf(P.x, P.y), c = 0.5 + 0.5 * Math.cos(TAU * w);
    const [gx, gy] = wgrad(P.x, P.y), m = Math.hypot(gx, gy), nx = gx / m, ny = gy / m;
    ring.setAttribute('cx', P.x); ring.setAttribute('cy', P.y); ringO.setAttribute('cx', P.x); ringO.setAttribute('cy', P.y);
    nrm.setAttribute('x1', P.x - nx * 30); nrm.setAttribute('y1', P.y - ny * 30); nrm.setAttribute('x2', P.x + nx * 30); nrm.setAttribute('y2', P.y + ny * 30);
    const state = c > 0.85 ? 'on a winding' : c < 0.15 ? 'between windings' : 'in between';
    rdCos.textContent = c.toFixed(2) + ' · ' + state;
    rdBar.style.width = (c * 100).toFixed(0) + '%';
    rdDens.textContent = (m * 100).toFixed(1) + ' windings per 100 px';
    const tilt = Math.atan2(-gx, gy) * 180 / Math.PI;
    rdDir.textContent = Math.abs(tilt) < 1 ? 'layers run flat' : 'layers tilt ' + Math.abs(tilt).toFixed(0) + '° ' + (tilt > 0 ? 'up' : 'down') + ' to the right';
    let d = '';
    for (let y = 0; y <= SH; y += 4) {
      const cv = 0.5 + 0.5 * Math.cos(TAU * wf(P.x, y));
      d += (y ? 'L' : 'M') + (10 + cv * 90).toFixed(1) + ' ' + y;
    }
    pArea.setAttribute('d', d);
    pLine.setAttribute('y1', P.y); pLine.setAttribute('y2', P.y);
    pDot.setAttribute('cx', 10 + c * 90); pDot.setAttribute('cy', P.y);
  }
  function setProbe(e) {
    const r = svg.getBoundingClientRect();
    P.tx = clamp((e.clientX - r.left) / r.width * SW, 8, SW - 8);
    P.ty = clamp((e.clientY - r.top) / r.height * SH, 8, SH - 8);
    P.hold = 3.5;
  }
  svg.addEventListener('pointermove', setProbe);
  svg.addEventListener('pointerdown', setProbe);
  svg.tabIndex = 0;
  svg.addEventListener('keydown', e => {
    const k = { ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12] }[e.key];
    if (!k) return;
    P.tx = clamp(P.tx + k[0], 8, SW - 8); P.ty = clamp(P.ty + k[1], 8, SH - 8); P.hold = 6; e.preventDefault();
  });
  const vis = visibility(svg);
  addTicker(vis, (dt, now) => {
    if (P.hold > 0) P.hold -= dt;
    else if (motionOK()) { P.tx = 320 + 250 * Math.sin(now * 0.42); P.ty = 205 + 140 * Math.sin(now * 0.29 + 1); }
    const k = 1 - Math.exp(-dt * 9);
    P.x = lerp(P.x, P.tx, k); P.y = lerp(P.y, P.ty, k);
    update();
  });
  update();
})();

/* ================================================================ step 2: starting mesh */
(() => {
  const cv = $('#startCanvas'), svg = $('#startSvg'), range = $('#layerCount'), out = $('#layerCountOut');
  cv.width = SW; cv.height = SH;
  cv.getContext('2d').drawImage(scene.scan, 0, 0);
  const SEEDX = 320, SEEDY = yOfWinding(SEEDX, 7), STEP = 30;
  const lines = svgEl('g', {}, svg), seed = svgEl('g', {}, svg);
  const ringA = svgEl('circle', { cx: SEEDX, cy: SEEDY, fill: 'none', stroke: '#fff', 'stroke-width': 2 }, seed);
  svgEl('animate', { attributeName: 'r', values: '5;22', dur: '1.8s', repeatCount: 'indefinite' }, ringA);
  svgEl('animate', { attributeName: 'opacity', values: '.9;0', dur: '1.8s', repeatCount: 'indefinite' }, ringA);
  svgEl('circle', { cx: SEEDX, cy: SEEDY, r: 5.5, fill: '#fff', stroke: '#000', 'stroke-width': 1.5 }, seed);
  const lab = svgEl('text', { x: SEEDX + 12, y: SEEDY - 12, fill: '#fff', 'font-size': 15, 'font-weight': 600 }, seed);
  lab.textContent = 'seed';

  const stack = Stack3D($('#startStack'), { n: 7, explode: 0.2, ang: 0.5 });

  function build(n) {
    lines.textContent = '';
    const mid = Math.floor(n / 2);
    for (let k = 0; k < n; k++) {
      let d = '';
      for (let x = 0; x <= SW; x += 10) d += (x ? 'L' : 'M') + x + ' ' + (SEEDY + (k - mid) * STEP + 0.0005 * (x - SEEDX) ** 2).toFixed(1);
      svgEl('path', { d, fill: 'none', stroke: cssVar('--mesh'), 'stroke-width': 2.4, 'stroke-linecap': 'round', opacity: k === mid ? 1 : 0.85 }, lines);
    }
    stack.set({ n });
    out.textContent = n;
  }
  range.addEventListener('input', () => build(+range.value));
  themeListeners.push(() => build(+range.value));
  build(+range.value);
})();

/* ================================================================ step 3: fit toy */
(() => {
  const fig = $('#figFit'), svg = $('#fitSvg');
  paintLayerCanvases(fig, 'bg');
  segSwitch(fig, 'bg');
  const playBtn = $('#fitPlay'), resetBtn = $('#fitReset');
  const cPull = $('#rulePull'), cDir = $('#ruleDir'), cSmooth = $('#ruleSmooth');
  const itEl = $('#fitIter'), errEl = $('#fitErr');
  const N = 7, M = 33, MID = 3, SEEDX = 320, SEEDY = yOfWinding(SEEDX, 7), STEP = 30;
  const noise = valueNoise(16, 11);   // the hints are not perfectly clean
  let L = [], iter = 0, running = false;
  const paths = [], dots = [];
  const gl = svgEl('g', {}, svg), gd = svgEl('g', {}, svg);
  for (let k = 0; k < N; k++) {
    paths.push(svgEl('path', { fill: 'none', 'stroke-width': 2.2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, gl));
    const row = [];
    for (let i = 0; i < M; i++) row.push(svgEl('circle', { r: 2.3, fill: '#fff', opacity: 0.85 }, gd));
    dots.push(row);
  }
  function colorize() { paths.forEach(p => p.setAttribute('stroke', cssVar('--mesh'))); }
  themeListeners.push(colorize); colorize();

  function reset() {
    L = [];
    for (let k = 0; k < N; k++) {
      const X = new Float64Array(M), Y = new Float64Array(M);
      for (let i = 0; i < M; i++) {
        X[i] = 10 + i * 620 / (M - 1);
        Y[i] = SEEDY + (k - MID) * STEP + 0.0005 * (X[i] - SEEDX) ** 2;
      }
      L.push({ X, Y, w: 7 + (k - MID) });
    }
    iter = 0; render();
  }
  function step() {
    const pull = cPull.checked, dir = cDir.checked, sm = cSmooth.checked;
    for (const l of L) {
      const { X, Y } = l;
      if (pull) for (let i = 0; i < M; i++) {
        const [gx, gy] = wgrad(X[i], Y[i]), g2 = gx * gx + gy * gy;
        const wObs = wf(X[i], Y[i]) + (noise(X[i], Y[i]) - 0.5) * 0.4;
        const f = 0.016 * (wObs - l.w) / g2;
        X[i] -= f * gx; Y[i] -= f * gy;
      }
      if (dir) for (let i = 0; i < M - 1; i++) {
        const dx = X[i + 1] - X[i], dy = Y[i + 1] - Y[i];
        const [gx, gy] = wgrad((X[i] + X[i + 1]) / 2, (Y[i] + Y[i + 1]) / 2), gm = Math.hypot(gx, gy);
        let tx = -gy / gm, ty = gx / gm;
        if (dx * tx + dy * ty < 0) { tx = -tx; ty = -ty; }
        const len = Math.hypot(dx, dy), cx = (tx * len - dx) * 0.08, cy = (ty * len - dy) * 0.08;
        X[i + 1] += cx; Y[i + 1] += cy; X[i] -= cx; Y[i] -= cy;
      }
      if (sm) {
        const px = Float64Array.from(X), py = Float64Array.from(Y);
        for (let i = 1; i < M - 1; i++) {
          X[i] += 0.12 * (0.5 * (px[i - 1] + px[i + 1]) - px[i]);
          Y[i] += 0.12 * (0.5 * (py[i - 1] + py[i + 1]) - py[i]);
        }
      }
    }
    iter++;
  }
  function render() {
    let err = 0, cnt = 0;
    for (let k = 0; k < N; k++) {
      const { X, Y, w } = L[k];
      let d = '';
      for (let i = 0; i < M; i++) {
        d += (i ? 'L' : 'M') + X[i].toFixed(1) + ' ' + Y[i].toFixed(1);
        dots[k][i].setAttribute('cx', X[i].toFixed(1)); dots[k][i].setAttribute('cy', Y[i].toFixed(1));
        const [gx, gy] = wgrad(X[i], Y[i]);
        err += Math.abs(wf(X[i], Y[i]) - w) / Math.hypot(gx, gy); cnt++;
      }
      paths[k].setAttribute('d', d);
    }
    itEl.textContent = iter;
    errEl.textContent = (err / cnt).toFixed(1);
  }
  function setRunning(r) { running = r; playBtn.textContent = r ? 'Pause' : 'Play'; }
  playBtn.addEventListener('click', () => setRunning(!running));
  resetBtn.addEventListener('click', () => reset());
  const vis = visibility(svg);
  let auto = false;
  addTicker(vis, () => {
    if (!auto && vis.seen) { auto = true; if (motionOK()) setTimeout(() => setRunning(true), 700); }
    if (!running) return;
    step(); render();
  });
  reset();
})();

/* ================================================================ step 3: coarse to fine */
(() => {
  const svg = $('#pyrSvg'), box = $('#pyrLevels'), info = $('#pyrInfo'), playBtn = $('#pyrPlay');
  const W = 640, H = 240, PAD = 22;
  const counts = [3, 5, 9, 17, 33];
  const notes = [
    'Only the rough direction of the line is known.',
    'The main bend is right.',
    'Medium waves start to show.',
    'Only small wiggles are missing.',
    'The line follows the target closely.'
  ];
  const f = x => 0.5 + 0.26 * Math.sin(TAU * x + 0.4) + 0.13 * Math.sin(TAU * 3 * x + 1.1) + 0.06 * Math.sin(TAU * 7 * x + 2.2);
  const X = x => PAD + x * (W - 2 * PAD), Y = v => PAD + (1 - v) * (H - 2 * PAD);

  for (let i = 0; i <= 4; i++) svgEl('line', { x1: PAD, x2: W - PAD, y1: PAD + i * (H - 2 * PAD) / 4, y2: PAD + i * (H - 2 * PAD) / 4, stroke: 'var(--line)', 'stroke-width': 1 }, svg);
  let td = '';
  for (let i = 0; i <= 300; i++) { const x = i / 300; td += (i ? 'L' : 'M') + X(x).toFixed(1) + ' ' + Y(f(x)).toFixed(1); }
  svgEl('path', { d: td, fill: 'none', stroke: 'var(--muted)', 'stroke-width': 5, opacity: 0.35, 'stroke-linecap': 'round' }, svg);
  const fit = svgEl('path', { fill: 'none', stroke: 'var(--mesh)', 'stroke-width': 2.6, 'stroke-linejoin': 'round' }, svg);
  const dg = svgEl('g', {}, svg);

  let level = 0, pts = [], tween = null, playing = false, hold = 0;
  const at = (p, x) => {
    const n = p.length - 1, s = clamp(x, 0, 1) * n, i = Math.min(n - 1, Math.floor(s));
    return lerp(p[i].y, p[i + 1].y, s - i);
  };
  function draw() {
    let d = '';
    pts.forEach((p, i) => { d += (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1); });
    fit.setAttribute('d', d);
    dg.textContent = '';
    pts.forEach(p => svgEl('circle', { cx: X(p.x), cy: Y(p.y), r: pts.length > 20 ? 2.6 : 4.2, fill: 'var(--mesh)', stroke: 'var(--surface)', 'stroke-width': 1.2 }, dg));
  }
  function setLevel(l, animate) {
    level = l;
    $$('button', box).forEach((b, i) => b.classList.toggle('on', i === l));
    const n = counts[l], xs = Array.from({ length: n }, (_, i) => i / (n - 1));
    const to = xs.map(x => f(x));
    if (animate && motionOK() && pts.length) {
      // start from where the previous curve was, then slide each point onto the target
      const from = xs.map(x => at(pts, x));
      pts = xs.map((x, i) => ({ x, y: from[i] }));
      tween = { t: 0, xs, from, to };
    } else {
      pts = xs.map((x, i) => ({ x, y: to[i] }));
      tween = null;
    }
    info.innerHTML = `Level <b>${l + 1}</b> of 5 · <b>${n}</b> points · ${notes[l]}`;
    draw();
  }
  counts.forEach((n, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Level ' + (i + 1);
    b.addEventListener('click', () => { playing = false; playBtn.textContent = 'Play'; setLevel(i, true); });
    box.appendChild(b);
  });
  playBtn.addEventListener('click', () => {
    playing = !playing; playBtn.textContent = playing ? 'Pause' : 'Play';
    if (playing) { hold = 0; if (level === counts.length - 1) setLevel(0, false); }
  });
  const vis = visibility(svg);
  let auto = false;
  addTicker(vis, dt => {
    if (!auto && vis.seen) { auto = true; if (motionOK()) setTimeout(() => { playing = true; playBtn.textContent = 'Pause'; }, 600); }
    if (tween) {
      tween.t = Math.min(1, tween.t + dt / 0.9);
      const e = ease(tween.t);
      pts = tween.xs.map((x, i) => ({ x, y: lerp(tween.from[i], tween.to[i], e) }));
      if (tween.t >= 1) tween = null;
      draw();
    } else if (playing) {
      hold += dt;
      if (hold > 1.5) {
        hold = 0;
        if (level < counts.length - 1) setLevel(level + 1, true);
        else { playing = false; playBtn.textContent = 'Replay'; }
      }
    }
  });
  setLevel(0, false);
})();

/* ================================================================ step 4: export */
(() => {
  const fig = $('#figExport');
  const N = 7;
  const stack = Stack3D($('#exportStack'), { n: N, explode: 0, ang: 0.5, auto: false });
  const range = $('#explode'), pick = $('#layerPick'), tree = $('#tree'), read = $('#tifRead');
  const GW = 48, GH = 32;
  const cv = { x: $('#tifX'), y: $('#tifY'), z: $('#tifZ') };
  let sel = 3, grid = null;

  function setExplode(v) { stack.set({ explode: v }); range.value = String(Math.round(v * 100)); }
  range.addEventListener('input', () => stack.set({ explode: range.value / 100 }));

  function buildGrid(d) {
    const g = { x: new Float64Array(GW * GH), y: new Float64Array(GW * GH), z: new Float64Array(GW * GH) };
    for (let r = 0; r < GH; r++) for (let c = 0; c < GW; c++) {
      const p = stack.point(d, c / (GW - 1), r / (GH - 1), 0);
      g.x[r * GW + c] = 4200 + p[0] * 14; g.y[r * GW + c] = 6100 + p[1] * 14; g.z[r * GW + c] = 1500 + p[2] * 14;
    }
    return g;
  }
  function paintTif(key) {
    const a = grid[key], c = cv[key], ctx = c.getContext('2d'), id = ctx.createImageData(GW, GH);
    let lo = Infinity, hi = -Infinity;
    for (const v of a) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
    for (let i = 0; i < a.length; i++) {
      const v = 30 + 225 * (a[i] - lo) / (hi - lo || 1);
      id.data[i * 4] = v; id.data[i * 4 + 1] = v; id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);
  }
  function select(i) {
    sel = i;
    $$('button', pick).forEach((b, k) => b.classList.toggle('on', k === i));
    stack.set({ sel: i });
    grid = buildGrid(i);
    ['x', 'y', 'z'].forEach(paintTif);
    tree.textContent = `winding_${String(i).padStart(4, '0')}.tifxyz/\n  x.tif\n  y.tif\n  z.tif\n  meta.json`;
    read.textContent = 'Point the cursor at an image to read one pixel.';
  }
  for (let i = 0; i < N; i++) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Layer ' + (i + 1);
    b.addEventListener('click', () => select(i)); pick.appendChild(b);
  }
  for (const key in cv) {
    const c = cv[key];
    c.addEventListener('pointermove', e => {
      const r = c.getBoundingClientRect();
      const col = clamp(Math.floor((e.clientX - r.left) / r.width * GW), 0, GW - 1);
      const row = clamp(Math.floor((e.clientY - r.top) / r.height * GH), 0, GH - 1), i = row * GW + col;
      read.innerHTML = `Row <b>${row}</b>, column <b>${col}</b> holds the point (x, y, z) = (<b>${grid.x[i].toFixed(1)}</b>, <b>${grid.y[i].toFixed(1)}</b>, <b>${grid.z[i].toFixed(1)}</b>)`;
    });
  }
  select(sel);

  const vis = visibility(fig);
  let auto = false, t0 = null;
  addTicker(vis, dt => {
    if (!auto && vis.seen) { auto = true; if (motionOK()) t0 = 0; }
    if (t0 === null) return;
    t0 += dt;
    const e = ease(clamp((t0 - 0.4) / 1.8, 0, 1));
    setExplode(e * 0.6);
    if (t0 > 2.4) t0 = null;
  });
})();

/* ================================================================ loops that should not run for reduced motion */
if (!motionOK()) {
  $$('.card svg').forEach(s => { try { s.setCurrentTime(2); s.pauseAnimations(); } catch (_) { /* older browsers */ } });
}

})();
