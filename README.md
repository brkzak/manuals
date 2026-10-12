# Manuals

Static, self-contained explainer pages. No build step, no server, no network.
Open the `index.html` of a manual directly in a browser.

| Manual | What it covers |
|---|---|
| [lasagna/](lasagna/index.html) | Ways this repo finds the windings of a rolled papyrus in a CT scan. One tab each: overview, Lasagna, the patch tracer (GrowPatch, Copy Out/In), fibers and the atlas, the spiral fit, the winding model, and ThaumatoAnakalyptor. |

The pictures use made-up data. They illustrate the idea and are not real scan output.

## Layout of `lasagna/`

- `index.html`: all text, with one panel per tab. Section ids are `<tab>-<section>`; links of the form `#<tab>` or `#<tab>/<section>` switch tabs.
- `style.css`: theme (follows the system light/dark setting) and layout.
- `core.js`: shared helpers (animation loop, canvas sizing, the synthetic scan patch, the 3D layer stack, spiral geometry), exposed as `window.Manual`.
- `tabs.js`: tab router and the section links under the tab bar.
- `lasagna.js`, `overview.js`, `tracer.js`, `fibers.js`, `spiral.js`, `winding.js`, `thaumato.js`: the figures of each tab. `icons.js`: small animated rule icons.

To add a tab: add a button with `role="tab"` and a `div role="tabpanel"` in `index.html`, give each `section` a `data-nav` label, and load a script for its figures.

## Checking before you publish

```bash
python3 manuals/check.py            # offline: tags balanced, ids unique, in-page links and local files resolve, no local-path links
python3 manuals/check.py --online   # also requests every external link
```

Links in a manual must be absolute `https` URLs or anchors inside the page, because the pages are published away from the repo checkout. Link to `https://github.com/ScrollPrize/villa/blob/main/...` for source files.

