/* Tracer tab: seeded growth along a surface prediction, the state grid, and Copy Out/In. */
(() => {
'use strict';
const { $, svgEl, clamp, lerp, motionOK, cssVar, themeListeners, visibility, addTicker,
  SW, SH, wf, wgrad, yOfWinding, valueNoise } = window.Manual;

const SEED_X = 320, WIND = 7;
const SEED_Y = yOfWinding(SEED_X, WIND);
const RED = '#ff5a5a';

/* ---- synthetic surface prediction: bright where a winding is, with an optional merger ---- */
const y7 = new Float32Array(SW), y8 = new Float32Array(SW);
for (let x = 0; x < SW; x++) { y7[x] = yOfWinding(x, 7); y8[x] = yOfWinding(x, 8); }
const merge = x => Math.exp(-(((x - 450) / 16) ** 2));
const holes = valueNoise(22, 5);

function predAt(x, y, merger) {
  const w = wf(x, y), k = Math.round(w), f = w - k;
  const [gx, gy] = wgrad(x, y), d = f / Math.hypot(gx, gy);
  let r = Math.exp(-d * d / (2 * 3.5 * 3.5));
  if (merger) {
    const m = merge(x), xi = clamp(Math.round(x), 0, SW - 1);
    if (k === WIND) r *= 1 - 0.8 * m;
    const c = y7[xi] + 0.7 * (y8[xi] - y7[xi]);
    r = Math.max(r, m * Math.exp(-(((y - c) / 9) ** 2)));
  }
  return r;
}
const ridgeOnly = (x, y) => predAt(x, y, false);

function renderPred(canvas, merger) {
  canvas.width = SW; canvas.height = SH;
  const ctx = canvas.getContext('2d'), id = ctx.createImageData(SW, SH);
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    const i = (y * SW + x) * 4;
    let v = predAt(x, y, merger) * (0.82 + 0.18 * holes(x, y));
    v = clamp(v, 0, 1);
    id.data[i] = 20 + v * 215; id.data[i + 1] = 17 + v * 208; id.data[i + 2] = 13 + v * 187; id.data[i + 3] = 255;
  }
  ctx.putImageData(id, 0, 0);
}

/* ---------------------------------------------------------------- grow along the surface */
(() => {
  const canvas = $('#trCanvas'), svg = $('#trSvg');
  const playBtn = $('#trPlay'), resetBtn = $('#trReset'), cMerge = $('#trMerger'), cCorr = $('#trCorr'), meter = $('#trMeter');
  const STEP = 8, LAMBDA = 0.0015;
  let pts, running = false, acc = 0, done = false;

  const gLine = svgEl('g', {}, svg), gCorr = svgEl('g', {}, svg), gDots = svgEl('g', {}, svg), gMsg = svgEl('g', {}, svg);
  const okPath = svgEl('path', { fill: 'none', 'stroke-width': 3.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, gLine);
  const badPath = svgEl('path', { fill: 'none', stroke: RED, 'stroke-width': 3.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, gLine);
  const msg = svgEl('text', { class: 'lab', y: 0, fill: RED, style: 'fill:' + RED, 'text-anchor': 'middle', opacity: 0 }, gMsg);
  msg.textContent = 'sheet switch';
  const seedDot = svgEl('circle', { cx: SEED_X, cy: SEED_Y, r: 5.5, fill: '#fff', stroke: '#000', 'stroke-width': 1.5 }, gDots);

  function corrAt(x) { return cCorr.checked && Math.abs(x - 450) < 75 ? y7[clamp(Math.round(x), 0, SW - 1)] : null; }

  function drawCorr() {
    gCorr.textContent = '';
    if (!cCorr.checked) return;
    [410, 450, 490].forEach(x => {
      const y = y7[x];
      svgEl('circle', { cx: x, cy: y, r: 7, fill: 'none', stroke: '#4be08a', 'stroke-width': 2.4 }, gCorr);
      svgEl('circle', { cx: x, cy: y, r: 2.5, fill: '#4be08a' }, gCorr);
    });
    const t = svgEl('text', { x: 450, y: y7[450] - 18, class: 'lab', 'text-anchor': 'middle', style: 'fill:#4be08a' }, gCorr);
    t.textContent = 'correction points';
  }

  function best(x, yPred) {
    let by = yPred, bs = -1e9;
    const yc = corrAt(x);
    for (let y = yPred - 12; y <= yPred + 12; y += 1) {
      let s = predAt(x, y, cMerge.checked) - LAMBDA * (y - yPred) ** 2;
      if (yc !== null) s -= 0.02 * (y - yc) ** 2;
      if (s > bs) { bs = s; by = y; }
    }
    return by;
  }
  function addPoint(dir) {
    const arr = dir > 0 ? pts.right : pts.left;
    const last = arr[arr.length - 1];
    const x = last.x + dir * STEP;
    if (x < 6 || x > SW - 6) return false;
    let slope = 0;
    if (arr.length >= 3) slope = (last.y - arr[arr.length - 3].y) / (last.x - arr[arr.length - 3].x);
    const y = best(x, last.y + slope * dir * STEP);
    arr.push({ x, y });
    // optimise the active fringe: small pull to the local maximum, then smooth
    const n = arr.length, from = Math.max(1, n - 6);
    for (let it = 0; it < 2; it++) for (let i = from; i < n - 1; i++) {
      const p = arr[i];
      let by = p.y, bs = -1e9;
      for (let yy = p.y - 2; yy <= p.y + 2; yy += 1) {
        const s = predAt(p.x, yy, cMerge.checked) - LAMBDA * (yy - p.y) ** 2 - (corrAt(p.x) !== null ? 0.02 * (yy - corrAt(p.x)) ** 2 : 0);
        if (s > bs) { bs = s; by = yy; }
      }
      p.y = lerp(p.y, by, 0.5);
      p.y = lerp(p.y, (arr[i - 1].y + arr[i + 1].y) / 2, 0.3);
    }
    return true;
  }
  function all() { return [...pts.left.slice(1).reverse(), ...pts.right]; }

  function render() {
    const line = all();
    let cut = -1;
    for (let i = 0; i < line.length; i++) if (Math.abs(wf(line[i].x, line[i].y) - WIND) > 0.5) { cut = i; break; }
    const seg = (a, b) => line.slice(a, b).map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join('');
    okPath.setAttribute('stroke', cssVar('--mesh'));
    if (cut < 0) { okPath.setAttribute('d', seg(0, line.length)); badPath.setAttribute('d', ''); msg.setAttribute('opacity', 0); }
    else {
      okPath.setAttribute('d', seg(0, cut));
      badPath.setAttribute('d', seg(Math.max(0, cut - 1), line.length));
      msg.setAttribute('x', line[cut].x); msg.setAttribute('y', line[cut].y - 16); msg.setAttribute('opacity', 1);
    }
    gDots.textContent = '';
    gDots.appendChild(seedDot);
    const tip = (p, bad) => svgEl('circle', { cx: p.x, cy: p.y, r: 4, fill: bad ? RED : '#fff', stroke: '#000', 'stroke-width': 1 }, gDots);
    const L = pts.left[pts.left.length - 1], R = pts.right[pts.right.length - 1];
    [L, R].forEach(p => tip(p, Math.abs(wf(p.x, p.y) - WIND) > 0.5));
    // fringe being optimised
    const fr = pts.right.slice(-6), fl = pts.left.slice(-6);
    [fr, fl].forEach(a => { if (a.length > 1) svgEl('path', { d: a.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1)).join(''), fill: 'none', stroke: '#fff', 'stroke-width': 5.5, opacity: 0.35, 'stroke-linecap': 'round' }, gDots); });
    if (done) {
      meter.textContent = cut < 0 ? 'Done. The trace stayed on winding 7.'
        : 'Done. At x = ' + Math.round(line[cut].x) + ' the trace jumped to winding ' + Math.round(wf(line[line.length - 1].x, line[line.length - 1].y)) + '. Everything after that is wrong.';
    } else meter.textContent = 'Growing: ' + line.length + ' points on the row.';
  }

  function reset() {
    renderPred(canvas, cMerge.checked);
    pts = { left: [{ x: SEED_X, y: SEED_Y }], right: [{ x: SEED_X, y: SEED_Y }] };
    acc = 0; done = false; drawCorr(); render(); meter.textContent = 'Ready.';
  }
  function setRunning(r) { running = r; playBtn.textContent = r ? 'Pause' : (done ? 'Replay' : 'Play'); }
  playBtn.addEventListener('click', () => { if (done) { reset(); setRunning(true); } else setRunning(!running); });
  resetBtn.addEventListener('click', () => { reset(); setRunning(false); });
  [cMerge, cCorr].forEach(c => c.addEventListener('change', () => { reset(); setRunning(motionOK()); }));

  const vis = visibility(canvas);
  let auto = false;
  addTicker(vis, dt => {
    if (!auto && vis.seen) { auto = true; if (motionOK()) setTimeout(() => setRunning(true), 600); }
    if (!running) return;
    acc += dt;
    while (acc > 0.07 && !done) {
      acc -= 0.07;
      const a = addPoint(1), b = addPoint(-1);
      if (!a && !b) { done = true; setRunning(false); break; }
    }
    render();
  });
  themeListeners.push(render);
  reset();
})();

/* ---------------------------------------------------------------- the state grid */
(() => {
  const canvas = $('#latCanvas'), btn = $('#latPlay'), meter = $('#latMeter');
  const COLS = 40, ROWS = 14;
  const cells = [];
  const r = window.Manual.rng(9);
  const cx = COLS * 0.42, cy = ROWS / 2;
  for (let j = 0; j < ROWS; j++) for (let i = 0; i < COLS; i++) cells.push({ i, j, key: Math.hypot((i - cx) * 0.55, (j - cy)) + r() * 1.6 });
  cells.sort((a, b) => a.key - b.key);
  const ACTIVE = 70;
  let n = 0, running = false;

  function draw() {
    const { ctx, w, h } = window.Manual.sizeCanvas(canvas);
    ctx.clearRect(0, 0, w, h);
    const cw = w / COLS, ch = h / ROWS, mesh = cssVar('--mesh'), muted = cssVar('--muted');
    ctx.strokeStyle = muted; ctx.globalAlpha = 0.18; ctx.lineWidth = 1;
    for (let i = 0; i <= COLS; i++) { ctx.beginPath(); ctx.moveTo(i * cw, 0); ctx.lineTo(i * cw, h); ctx.stroke(); }
    for (let j = 0; j <= ROWS; j++) { ctx.beginPath(); ctx.moveTo(0, j * ch); ctx.lineTo(w, j * ch); ctx.stroke(); }
    ctx.globalAlpha = 1;
    for (let k = 0; k < n; k++) {
      const c = cells[k], act = k >= n - ACTIVE;
      ctx.fillStyle = act ? mesh : muted;
      ctx.globalAlpha = act ? 0.9 : 0.4;
      ctx.fillRect(c.i * cw + 1, c.j * ch + 1, cw - 2, ch - 2);
    }
    ctx.globalAlpha = 1;
    const s = cells[0];
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc((s.i + 0.5) * cw, (s.j + 0.5) * ch, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    meter.textContent = 'Committed ' + n + ' of ' + cells.length + ' cells · active fringe ' + Math.min(n, ACTIVE);
  }
  const vis = visibility(canvas);
  let auto = false;
  addTicker(vis, dt => {
    if (!auto && vis.seen) { auto = true; if (motionOK()) { n = 0; running = true; } else { n = cells.length; } draw(); }
    if (!running) return;
    n = Math.min(cells.length, n + Math.ceil(dt * 160));
    if (n >= cells.length) running = false;
    draw();
  });
  btn.addEventListener('click', () => { n = 0; running = motionOK(); if (!running) n = cells.length; draw(); });
  window.Manual.onResize(canvas, draw);
  themeListeners.push(draw);
  draw();
})();

/* ---------------------------------------------------------------- Copy Out/In */
(() => {
  const canvas = $('#cpCanvas'), svg = $('#cpSvg');
  const stepBtn = $('#cpStep'), resetBtn = $('#cpReset'), cErr = $('#cpErr'), meter = $('#cpMeter');
  renderPred(canvas, false);
  const XS = []; for (let x = 8; x <= SW - 8; x += 8) XS.push(x);
  const gArr = svgEl('g', {}, svg), gLines = svgEl('g', {}, svg);
  let lines = [];   // each: array of y per XS

  function source() {
    return XS.map(x => {
      if (!cErr.checked) return y7[x];
      const t = clamp((x - 420) / 24, 0, 1);
      return lerp(y7[x], y8[x], t * t * (3 - 2 * t));
    });
  }
  function copyOut(src) {
    return src.map((y, i) => {
      const x = XS[i], [, gy] = wgrad(x, y);
      const guess = y + 1 / gy;                       // about one winding spacing along the normal
      let by = guess, bs = -1;
      for (let yy = guess - 6; yy <= guess + 6; yy += 1) { const s = ridgeOnly(x, yy) - 0.002 * (yy - guess) ** 2; if (s > bs) { bs = s; by = yy; } }
      return by;
    });
  }
  const colorFor = j => `hsl(${lerp(32, 52, j / 3)} 90% ${lerp(58, 72, j / 3)}%)`;
  function draw() {
    gLines.textContent = ''; gArr.textContent = '';
    lines.forEach((ys, j) => {
      const d = ys.map((y, i) => (i ? 'L' : 'M') + XS[i] + ' ' + y.toFixed(1)).join('');
      const p = svgEl('path', { d, fill: 'none', stroke: j === 0 ? cssVar('--mesh') : colorFor(j), 'stroke-width': j === 0 ? 3.4 : 2.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, gLines);
      if (j === lines.length - 1 && j > 0 && motionOK()) {
        const len = p.getTotalLength(); p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
        p.getBoundingClientRect();
        p.style.transition = 'stroke-dashoffset .9s ease'; p.style.strokeDashoffset = 0;
      }
    });
    if (lines.length > 1) {   // little arrows from the previous line to the newest
      const a = lines[lines.length - 2], b = lines[lines.length - 1];
      for (let i = 4; i < XS.length; i += 9) svgEl('path', { d: `M${XS[i]} ${a[i].toFixed(1)} L${XS[i]} ${b[i].toFixed(1)}`, stroke: '#fff', 'stroke-width': 1.5, opacity: 0.6, 'stroke-dasharray': '3 3' }, gArr);
    }
  }
  function report() {
    if (lines.length === 1) { meter.textContent = 'Source: winding 7' + (cErr.checked ? ', with a sheet switch at x = 430.' : '.'); return; }
    const j = lines.length - 1, target = WIND + j, ys = lines[j];
    let ok = 0; ys.forEach((y, i) => { if (Math.abs(wf(XS[i], y) - target) < 0.3) ok++; });
    const pct = Math.round(100 * ok / ys.length);
    meter.textContent = 'Copy ' + j + ': ' + pct + '% of the line is on winding ' + target + (pct < 95 ? '. The rest is on the wrong winding, inherited from the source.' : '.');
  }
  function reset() { lines = [source()]; draw(); report(); }
  stepBtn.addEventListener('click', () => { if (lines.length >= 4) return; lines.push(copyOut(lines[lines.length - 1])); draw(); report(); });
  resetBtn.addEventListener('click', reset);
  cErr.addEventListener('change', reset);
  themeListeners.push(draw);
  reset();
})();
})();
