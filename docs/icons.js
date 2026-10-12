/* Small animated icons for the rule cards. Styles come from ".card" in style.css. */
(() => {
'use strict';
const { $$ } = window.Manual;
const svg = (label, body) => `<svg viewBox="0 0 160 100" role="img" aria-label="${label}">${body}</svg>`;
const T = 'dur="4s" repeatCount="indefinite"';

const icons = {
  ridge: svg('A point slides onto a bright band.', `
    <rect x="10" y="62" width="140" height="18" fill="var(--cos)" opacity=".35"/>
    <line class="surf" x1="10" y1="71" x2="150" y2="71"/>
    <circle class="dot big" cx="80" cy="20" r="5"><animate attributeName="cy" values="20;71;71;20" keyTimes="0;.5;.8;1" ${T}/></circle>`),
  straight: svg('A bent line straightens.', `
    <path class="mesh" d="M10 60 L45 36 L80 70 L115 36 L150 60" fill="none">
      <animate attributeName="d" ${T} keyTimes="0;.4;.7;1"
        values="M10 60 L45 36 L80 70 L115 36 L150 60;M10 55 L45 55 L80 55 L115 55 L150 55;M10 55 L45 55 L80 55 L115 55 L150 55;M10 60 L45 36 L80 70 L115 36 L150 60"/></path>`),
  even: svg('Uneven dots slide until they are evenly spaced.', `
    <line class="mesh thin" x1="14" y1="50" x2="146" y2="50"/>
    <circle class="dot big" cx="20" cy="50" r="5"/>
    <circle class="dot big" cy="50" r="5"><animate attributeName="cx" values="38;44;44;38" keyTimes="0;.4;.7;1" ${T}/></circle>
    <circle class="dot big" cy="50" r="5"><animate attributeName="cx" values="70;68;68;70" keyTimes="0;.4;.7;1" ${T}/></circle>
    <circle class="dot big" cy="50" r="5"><animate attributeName="cx" values="78;92;92;78" keyTimes="0;.4;.7;1" ${T}/></circle>
    <circle class="dot big" cy="50" r="5"><animate attributeName="cx" values="118;116;116;118" keyTimes="0;.4;.7;1" ${T}/></circle>
    <circle class="dot big" cx="140" cy="50" r="5"/>`),
  normal: svg('A line turns until it is square to an arrow.', `
    <line class="hint-d" x1="80" y1="60" x2="80" y2="16"/><path class="hint-d fill" d="M80 10 L74 22 L86 22 z"/>
    <g><line class="mesh" x1="34" y1="60" x2="126" y2="60"/>
      <animateTransform attributeName="transform" type="rotate" values="26 80 60;0 80 60;0 80 60;26 80 60" keyTimes="0;.4;.7;1" ${T} calcMode="spline" keySplines=".4 0 .2 1;0 0 1 1;.4 0 .2 1"/></g>
    <circle class="dot" cx="80" cy="60" r="3"/>`),
  neighbor: svg('A line is tugged toward a neighbor but stays where it is.', `
    <line class="guide" x1="12" y1="26" x2="148" y2="26"/>
    <text class="small" x="148" y="18" text-anchor="end">neighbor winding</text>
    <line class="mesh thin" x1="12" y1="72" x2="148" y2="72" style="opacity:.9"/>
    <circle class="dot big" cx="80" cy="72" r="5"><animate attributeName="cy" values="72;66;72;72" keyTimes="0;.25;.5;1" ${T}/></circle>
    <path d="M80 62 L80 34" stroke="var(--dir)" stroke-width="2" fill="none" stroke-dasharray="3 3"><animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.25;.5;1" ${T}/></path>
    <path d="M75 38 L80 30 L85 38" stroke="var(--dir)" stroke-width="2" fill="none"><animate attributeName="opacity" values="0;1;0;0" keyTimes="0;.25;.5;1" ${T}/></path>`),
};
$$('.icon[data-icon]').forEach(el => { el.innerHTML = icons[el.dataset.icon] || ''; });
window.Manual.icons = icons;
})();
