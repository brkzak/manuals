/* Fibers tab: control points vs a traced line, and the atlas layout from links. */
(() => {
'use strict';
const { $, $$, svgEl, clamp, lerp, ease, motionOK, cssVar, themeListeners, visibility, addTicker,
  SW, SH, yOfWinding, valueNoise, scene } = window.Manual;

/* ---------------------------------------------------------------- tracing between control points */
(() => {
  const canvas = $('#fbCanvas'), svg = $('#fbSvg'), range = $('#fbPts'), out = $('#fbPtsOut'), meter = $('#fbMeter');
  canvas.width = SW; canvas.height = SH;
  canvas.getContext('2d').drawImage(scene.scan, 0, 0);
  const K = 7, jitter = valueNoise(30, 21);
  const ridge = x => yOfWinding(x, K);
  const traced = x => ridge(x) + (jitter(x, 100) - 0.5) * 1.6;   // follows the fields, not perfectly

  // Catmull-Rom spline through the control points (what a plain smooth curve would do)
  function spline(cp) {
    const P = cp.map(x => [x, ridge(x)]), pts = [];
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
      for (let t = 0; t < 1; t += 0.05) {
        const t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        pts.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    pts.push(P[P.length - 1]);
    return pts;
  }
  function draw() {
    const n = +range.value; out.textContent = n;
    svg.textContent = '';
    const cp = Array.from({ length: n }, (_, i) => 40 + i * 560 / (n - 1));
    const sp = spline(cp);
    svgEl('path', { d: sp.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(''), fill: 'none', stroke: '#fff', 'stroke-width': 2.2, 'stroke-dasharray': '6 5', opacity: 0.9 }, svg);
    let d = '';
    for (let x = 6; x <= 634; x += 4) d += (d ? 'L' : 'M') + x + ' ' + traced(x).toFixed(1);
    svgEl('path', { d, fill: 'none', stroke: cssVar('--mesh'), 'stroke-width': 3, 'stroke-linecap': 'round' }, svg);
    cp.forEach(x => {
      svgEl('circle', { cx: x, cy: ridge(x), r: 6.5, fill: '#fff', stroke: '#000', 'stroke-width': 1.6 }, svg);
    });
    // errors against the true winding
    let e1 = 0, e2 = 0, c = 0;
    for (let i = 0; i < sp.length; i++) { e1 += Math.abs(sp[i][1] - ridge(sp[i][0])); c++; }
    e1 /= c; c = 0;
    for (let x = 40; x <= 600; x += 4) { e2 += Math.abs(traced(x) - ridge(x)); c++; }
    e2 /= c;
    meter.innerHTML = 'Average distance from the winding: smooth curve <b>' + e1.toFixed(1) + ' px</b> · traced line <b>' + e2.toFixed(1) + ' px</b>';
  }
  range.addEventListener('input', draw);
  themeListeners.push(draw);
  draw();
})();

/* ---------------------------------------------------------------- atlas layout */
(() => {
  const svg = $('#atSvg'), list = $('#atLinks'), nextBtn = $('#atNext'), resetBtn = $('#atReset'), info = $('#atInfo');
  const P = 150, X0 = 20, OFFS = [-1, 0, 1, 2];
  const fibers = [
    { n: 'F1', ua: 22, ub: 92 }, { n: 'F2', ua: 56, ub: 130 }, { n: 'F3', ua: 28, ub: 108 },
    { n: 'F4', ua: 66, ub: 140 }, { n: 'F5', ua: 12, ub: 82 }, { n: 'F6', ua: 48, ub: 122 },
  ];
  const rowY = i => 62 + i * 38;
  const links = [
    { a: 0, b: 1, d: 0, text: 'F1 and F2 cross: same winding' },
    { a: 1, b: 2, d: 1, text: 'F3 is one winding out from F2' },
    { a: 2, b: 3, d: 1, text: 'F4 is one winding out from F3' },
    { a: 0, b: 4, d: -1, text: 'F5 is one winding in from F1' },
    { a: 4, b: 5, d: 0, text: 'F6 shares a winding with F5' },
    { a: 1, b: 3, d: 1, text: 'F4 is one winding out from F2' },
  ];
  const on = links.map(() => false);
  const hue = i => `hsl(${(i * 57 + 200) % 360} 62% 58%)`;

  // layout: root F1 at 0. Take the links in the order they were accepted and fill in offsets.
  function layout() {
    const off = fibers.map(() => null); off[0] = 0;
    const conflicts = [];
    let changed = true;
    while (changed) {
      changed = false;
      links.forEach((l, i) => {
        if (!on[i]) return;
        const A = off[l.a], B = off[l.b];
        if (A !== null && B === null) { off[l.b] = A + l.d; changed = true; }
        else if (A === null && B !== null) { off[l.a] = B - l.d; changed = true; }
      });
    }
    links.forEach((l, i) => {
      if (!on[i]) return;
      if (off[l.a] !== null && off[l.b] !== null && off[l.b] - off[l.a] !== l.d && !conflicts.includes(i)) conflicts.push(i);
    });
    return { off: off.map(o => (o === null ? 0 : o)), conflicts };
  }

  // static layer: tiles
  svgEl('rect', { x: 0, y: 0, width: 640, height: 320, fill: 'none' }, svg);
  OFFS.forEach((o, i) => {
    svgEl('rect', { x: X0 + i * P, y: 28, width: P, height: 270, fill: i % 2 ? 'var(--surface)' : 'var(--bg)', opacity: 0.8, stroke: 'var(--line)' }, svg);
    const t = svgEl('text', { x: X0 + i * P + P / 2, y: 20, class: 'cap', 'text-anchor': 'middle' }, svg);
    t.textContent = 'offset ' + (o > 0 ? '+' + o : o);
  });
  const gLinks = svgEl('g', {}, svg), gBars = svgEl('g', {}, svg);
  const bars = fibers.map((f, i) => {
    const g = svgEl('g', {}, gBars);
    const r = svgEl('rect', { height: 14, rx: 7, fill: hue(i), stroke: '#000', 'stroke-opacity': 0.35, width: f.ub - f.ua }, g);
    const t = svgEl('text', { class: 'cap', 'text-anchor': 'middle', style: 'fill:var(--ink);font-weight:650', y: 0 }, g);
    t.textContent = f.n;
    return { g, r, t };
  });

  // link checkboxes
  links.forEach((l, i) => {
    const li = document.createElement('li');
    const label = document.createElement('label');
    const cb = document.createElement('input'); cb.type = 'checkbox';
    cb.addEventListener('change', () => { on[i] = cb.checked; refresh(); });
    const span = document.createElement('span'); span.innerHTML = '<code>L' + (i + 1) + '</code> ' + l.text;
    const tag = document.createElement('span'); tag.className = 'tagx';
    label.append(cb, span, tag); li.appendChild(label); list.appendChild(li);
    l.cb = cb; l.li = li; l.tag = tag;
  });

  const cur = fibers.map(() => 0);        // animated offsets
  let tgt = fibers.map(() => 0), conflicts = [];
  const xOf = (i, o) => X0 + (o + 1) * P + fibers[i].ua;

  function refresh() {
    const L = layout(); tgt = L.off; conflicts = L.conflicts;
    links.forEach((l, i) => {
      l.li.classList.toggle('conflict', conflicts.includes(i));
      l.tag.textContent = conflicts.includes(i) ? 'disagrees' : (on[i] ? 'accepted' : '');
    });
    const used = fibers.map((_, i) => links.some((l, k) => on[k] && (l.a === i || l.b === i)) || i === 0);
    info.innerHTML = 'Offsets: ' + fibers.map((f, i) => f.n + ' <b>' + (tgt[i] > 0 ? '+' : '') + tgt[i] + '</b>' + (used[i] ? '' : ' (no link)')).join(' · ') +
      (conflicts.length ? '<br>Link <b>L' + (conflicts[0] + 1) + '</b> does not fit the others. The layout keeps the first answer it found and reports the conflict.' : '');
    if (!motionOK()) { cur.forEach((_, i) => { cur[i] = tgt[i]; }); paint(); }
  }
  function paint() {
    fibers.forEach((f, i) => {
      const x = X0 + (cur[i] + 1) * P + f.ua, y = rowY(i);
      bars[i].r.setAttribute('x', x); bars[i].r.setAttribute('y', y);
      bars[i].t.setAttribute('x', x + (f.ub - f.ua) / 2); bars[i].t.setAttribute('y', y + 11);
    });
    gLinks.textContent = '';
    links.forEach((l, i) => {
      if (!on[i]) return;
      const ax = X0 + (cur[l.a] + 1) * P + (fibers[l.a].ua + fibers[l.a].ub) / 2, ay = rowY(l.a) + 7;
      const bx = X0 + (cur[l.b] + 1) * P + (fibers[l.b].ua + fibers[l.b].ub) / 2, by = rowY(l.b) + 7;
      const bad = conflicts.includes(i), mx = Math.max(ax, bx) + 24 + (i % 3) * 8;
      svgEl('path', { d: `M${ax} ${ay} C${mx} ${ay} ${mx} ${by} ${bx} ${by}`, fill: 'none', stroke: bad ? '#ff5a5a' : 'var(--muted)', 'stroke-width': bad ? 2.4 : 1.5, 'stroke-dasharray': bad ? '5 4' : 'none', opacity: 0.9 }, gLinks);
      const t = svgEl('text', { x: mx + 4, y: (ay + by) / 2 + 4, class: 'cap', style: bad ? 'fill:#ff5a5a;font-weight:650' : '' }, gLinks);
      t.textContent = 'L' + (i + 1);
    });
  }
  nextBtn.addEventListener('click', () => {
    const i = on.indexOf(false);
    if (i < 0) return;
    on[i] = true; links[i].cb.checked = true; refresh();
  });
  resetBtn.addEventListener('click', () => { on.fill(false); links.forEach(l => { l.cb.checked = false; }); refresh(); });

  const vis = visibility(svg);
  addTicker(vis, dt => {
    let moving = false;
    cur.forEach((c, i) => {
      const d = tgt[i] - c;
      if (Math.abs(d) > 0.002) { cur[i] = c + d * (1 - Math.exp(-dt * 7)); moving = true; } else cur[i] = tgt[i];
    });
    if (moving) paint();
  });
  window.Manual.themeListeners.push(paint);
  refresh(); paint();
})();
})();
