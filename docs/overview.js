/* Overview tab: bottom-up vs top-down, and the map of what feeds what. */
(() => {
'use strict';
const { $, svgEl, clamp, lerp, ease, motionOK, visibility, addTicker, SPIRAL, idealPoint, crush, spiralPts, ptsToPath, goTab } = window.Manual;
const TAU = Math.PI * 2;

/* ---------------------------------------------------------------- bottom-up vs top-down */
(() => {
  const bottom = $('#ovBottom'), top = $('#ovTop'), btn = $('#ovReplay');
  const TH = SPIRAL.thetaMax;
  const place = svg => svgEl('g', { transform: 'translate(0,40) scale(.5)' }, svg);
  const gb = place(bottom), gt = place(top);
  const faint = { fill: 'none', stroke: '#6b6256', 'stroke-width': 5, opacity: 0.45, 'stroke-linecap': 'round' };
  const truth = ptsToPath(spiralPts(0, TH, 1));
  svgEl('path', { d: truth, ...faint }, gb);
  svgEl('path', { d: truth, ...faint }, gt);

  // pieces: [seed angle, max reach backward, max reach forward], leaving gaps between neighbours
  const pieces = [[6.5, 2.2, 2.3], [12.4, 2.0, 2.6], [18.8, 2.4, 2.0], [24.6, 2.3, 2.4], [30.2, 2.1, 2.6], [36.5, 2.5, 2.2]];
  const hue = i => `hsl(${(i * 53 + 20) % 360} 70% 62%)`;
  const grow = pieces.map(([c, b, f], i) => ({ c, b, f, el: svgEl('path', { fill: 'none', stroke: hue(i), 'stroke-width': 6, 'stroke-linecap': 'round' }, gb) }));
  // evidence on the right: the same stretches, as bright pieces
  pieces.forEach(([c, b, f], i) => {
    svgEl('path', { d: ptsToPath(spiralPts(c - b * 0.8, c + f * 0.8, 1)), fill: 'none', stroke: hue(i), 'stroke-width': 6, 'stroke-linecap': 'round', opacity: 0.95 }, gt);
  });
  const fit = svgEl('path', { fill: 'none', stroke: 'var(--mesh)', 'stroke-width': 3.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, gt);

  let t = 0, running = false;
  function render(p) {
    grow.forEach(g => {
      const e = ease(clamp((p - 0.05) / 0.8, 0, 1));
      const a = g.c - g.b * e, b = g.c + g.f * e;
      g.el.setAttribute('d', ptsToPath(spiralPts(a, Math.max(b, a + 0.05), 1)));
    });
    const d = ease(clamp(p / 0.85, 0, 1));
    fit.setAttribute('d', ptsToPath(spiralPts(0, TH, d, 0.15)));
  }
  const vis = visibility(bottom);
  let auto = false;
  addTicker(vis, dt => {
    if (!auto && vis.seen) { auto = true; if (motionOK()) { t = 0; running = true; } else { t = 1; render(1); } }
    if (!running) return;
    t = Math.min(1, t + dt / 4.5);
    render(t);
    if (t >= 1) running = false;
  });
  btn.addEventListener('click', () => { t = 0; running = motionOK(); if (!running) render(1); });
  render(0);
})();

/* ---------------------------------------------------------------- map of what feeds what */
(() => {
  const svg = $('#ovFlow');
  const defs = svgEl('defs', {}, svg);
  const mk = (id, color) => {
    const m = svgEl('marker', { id, viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto' }, defs);
    svgEl('path', { d: 'M0 0 L10 5 L0 10 z', style: `fill:${color}` }, m);
  };
  mk('ovA', 'var(--muted)'); mk('ovL', 'var(--dir)');

  const N = {
    ct:      { x: 390, y: 34,  w: 130, h: 36, t: 'CT scan' },
    sp:      { x: 190, y: 112, w: 180, h: 42, t: 'Surface prediction', s: '3D U-Net or nnU-Net' },
    lf:      { x: 410, y: 112, w: 180, h: 42, t: 'Lasagna fields', s: 'cos · density · direction' },
    thaumato:{ x: 770, y: 112, w: 170, h: 42, t: 'ThaumatoAnakalyptor', s: 'older, stands alone', tab: ['thaumato'] },
    tr:      { x: 100, y: 205, w: 140, h: 40, t: 'Tracer', s: 'GrowPatch', tab: ['tracer'] },
    la:      { x: 255, y: 205, w: 140, h: 40, t: 'Lasagna fit', tab: ['lasagna'] },
    cp:      { x: 410, y: 205, w: 140, h: 40, t: 'Copy Out/In', tab: ['tracer', 'copy'] },
    fb:      { x: 565, y: 205, w: 140, h: 40, t: 'Fibers & atlas', tab: ['fibers'] },
    sheets:  { x: 770, y: 205, w: 170, h: 40, t: 'Sheet meshes' },
    patches: { x: 190, y: 300, w: 150, h: 40, t: 'Surface patches', s: 'tifxyz' },
    fields:  { x: 410, y: 300, w: 170, h: 40, t: 'Fields and tracks', s: 'normals · density · skeletons' },
    constr:  { x: 610, y: 300, w: 170, h: 40, t: 'Winding constraints', s: 'same · relative · absolute' },
    hand:    { x: 790, y: 300, w: 150, h: 40, t: 'Hand annotation', s: 'in VC3D' },
    spiral:  { x: 390, y: 395, w: 170, h: 44, t: 'Spiral fit', tab: ['spiral'], goal: true },
    wm:      { x: 680, y: 395, w: 160, h: 44, t: 'Winding model', tab: ['winding'] },
    out:     { x: 390, y: 452, w: 200, h: 34, t: 'One tifxyz per winding', goal: true },
  };
  const E = [
    ['ct', 'sp'], ['ct', 'lf'], ['ct', 'thaumato'], ['thaumato', 'sheets'],
    ['sp', 'tr'], ['sp', 'fields'], ['lf', 'la'], ['lf', 'fb'], ['lf', 'fields'],
    ['tr', 'patches'], ['la', 'patches'], ['cp', 'patches'], ['fb', 'constr'], ['hand', 'constr'],
    ['patches', 'spiral'], ['fields', 'spiral'], ['constr', 'spiral'], ['spiral', 'out'],
  ];
  const bottomOf = n => [n.x, n.y + n.h / 2], topOf = n => [n.x, n.y - n.h / 2];
  const gE = svgEl('g', {}, svg), gN = svgEl('g', {}, svg);
  E.forEach(([a, b]) => {
    const [sx, sy] = bottomOf(N[a]), [ex, ey] = topOf(N[b]), d = (ey - sy) / 2;
    svgEl('path', { class: 'edge', d: `M${sx} ${sy} C${sx} ${sy + d} ${ex} ${ey - d} ${ex} ${ey}`, 'marker-end': 'url(#ovA)' }, gE);
  });
  // the loop: the winding model casts rays from a fitted spiral, and feeds its output back
  const sp = N.spiral, wm = N.wm;
  svgEl('path', { class: 'edge loop', d: `M${sp.x + sp.w / 2} ${sp.y - 8} C${sp.x + 150} ${sp.y - 40} ${wm.x - 80} ${wm.y - 44} ${wm.x - 30} ${wm.y - wm.h / 2}`, 'marker-end': 'url(#ovL)' }, gE);
  svgEl('path', { class: 'edge loop', d: `M${wm.x - wm.w / 2} ${wm.y + 8} C${wm.x - 110} ${wm.y + 16} ${sp.x + 120} ${sp.y + 18} ${sp.x + sp.w / 2} ${sp.y + 8}`, 'marker-end': 'url(#ovL)' }, gE);
  const lab = (x, y, txt) => { const t = svgEl('text', { x, y, class: 'cap', 'text-anchor': 'middle', style: 'fill:var(--dir)' }, gE); t.textContent = txt; };
  lab(590, 352, 'casts rays'); lab(590, 438, 'crossings back in');

  Object.values(N).forEach(n => {
    const g = svgEl('g', { class: 'node' + (n.tab ? ' tab' : '') + (n.goal ? ' goal' : '') }, gN);
    svgEl('rect', { x: n.x - n.w / 2, y: n.y - n.h / 2, width: n.w, height: n.h, rx: 9 }, g);
    const t1 = svgEl('text', { x: n.x, y: n.y + (n.s ? -2 : 4.5) }, g); t1.textContent = n.t;
    if (n.s) { const t2 = svgEl('text', { x: n.x, y: n.y + 13, class: 'sub' }, g); t2.textContent = n.s; }
    if (n.tab) {
      g.setAttribute('role', 'link'); g.setAttribute('tabindex', '0');
      g.setAttribute('aria-label', 'Open the ' + n.t + ' tab');
      const open = () => goTab(n.tab[0], n.tab[1]);
      g.addEventListener('click', open);
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    }
  });
})();
})();
