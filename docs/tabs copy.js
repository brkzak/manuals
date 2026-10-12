/* Tabs and the section sub-navigation.
   Hash format: #<tab> or #<tab>/<section>. Section ids are "<tab>-<section>". */
(() => {
'use strict';
const { $, $$ } = window.Manual;

const tabs = $$('[role="tab"]');
const panels = $$('[role="tabpanel"]');
const subnav = $('#subnav');
const DEFAULT = 'overview';
let current = null;
let io = null;

const tabIds = tabs.map(t => t.dataset.tab);
const panelOf = id => $('#panel-' + id);

function buildSubnav(tab) {
  subnav.textContent = '';
  if (io) io.disconnect();
  io = new IntersectionObserver(es => {
    es.forEach(e => {
      if (!e.isIntersecting) return;
      const key = e.target.id.slice(tab.length + 1);
      $$('a', subnav).forEach(a => a.setAttribute('aria-current', String(a.dataset.sec === key)));
    });
  }, { rootMargin: '-35% 0px -60% 0px' });
  $$('section[data-nav]', panelOf(tab)).forEach(sec => {
    const key = sec.id.slice(tab.length + 1);
    const a = document.createElement('a');
    a.href = '#' + tab + '/' + key;
    a.dataset.sec = key;
    if (sec.dataset.badge) { const b = document.createElement('b'); b.textContent = sec.dataset.badge; a.appendChild(b); }
    a.appendChild(document.createTextNode(sec.dataset.nav));
    subnav.appendChild(a);
    io.observe(sec);
  });
}

function show(tab) {
  if (!tabIds.includes(tab)) tab = DEFAULT;
  if (tab !== current) {
    current = tab;
    tabs.forEach(t => {
      const on = t.dataset.tab === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach(p => { p.hidden = p.id !== 'panel-' + tab; });
    buildSubnav(tab);
    const label = $('[role="tab"][aria-selected="true"]').textContent.trim();
    document.title = label + ' · Finding the windings';
    const activeTab = $('[role="tab"][aria-selected="true"]');
    if (activeTab.scrollIntoView) activeTab.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
  return tab;
}

function go(tab, sec, push) {
  tab = show(tab);
  const hash = '#' + tab + (sec ? '/' + sec : '');
  if (push !== false && location.hash !== hash) history.pushState(null, '', hash);
  if (sec) {
    const target = document.getElementById(tab + '-' + sec);
    if (target) { requestAnimationFrame(() => target.scrollIntoView()); return; }
  }
  window.scrollTo(0, 0);
}

function fromHash(push) {
  const h = location.hash.replace(/^#/, '');
  const [tab, sec] = h.split('/');
  go(tabIds.includes(tab) ? tab : DEFAULT, sec, push);
}

tabs.forEach((t, i) => {
  t.addEventListener('click', () => go(t.dataset.tab));
  t.addEventListener('keydown', e => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    const n = tabs[(i + d + tabs.length) % tabs.length];
    n.focus(); go(n.dataset.tab); e.preventDefault();
  });
});

// Any in-page link of the form #tab or #tab/section switches tabs.
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const [tab, sec] = a.getAttribute('href').slice(1).split('/');
  if (!tabIds.includes(tab)) return;
  e.preventDefault();
  go(tab, sec);
});
window.addEventListener('popstate', () => fromHash(false));

window.Manual.goTab = go;
fromHash(false);
})();
