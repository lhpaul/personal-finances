# HTML mockups

Interactive mockups for design review and implementation alignment. Couples with the specs in `docs/project/`.

Parent: [design/README.md](../README.md) · Framework: `~/Git/Cerebro/LH/40 - Conocimiento/Estándares/HTML Mockup Framework.md`

---

## Framework

### Layout

```
mockups/
├── README.md
├── shared/viewer.js
└── <app-name>/
    ├── README.md
    ├── index.html
    ├── mockup-manifest.js     ← edit this; sets __MOCKUP_MANIFEST__
    ├── assets/
    └── INVENTORY.md
```

### Viewer

Three columns: flow nav · phone frame · states + metadata. Driven by `mockup-manifest.js` via `shared/viewer.js` (`MockupViewer.loadManifest`).

| Mode | Viewport |
|------|----------|
| `phone` (mobile) | 393×852 @ 0.90 |
| `desktop` / `browser` | not bootstrapped |

Hash: `#screen=<screen_id>&state=<state_id>`.

Open `mobile/index.html` directly (`file://`) or over HTTP. Share the whole `mockups/` folder so `shared/` and assets resolve.

### State handling

A state never gets its own `<section>`. Every screen is one node with `id="s-<screen_id>"`; markup that only belongs to some states declares:

```html
<div data-states="filled error">…</div>
```

The boot script sets `screenEl.dataset.state` and toggles `hidden` on each `[data-states]` descendant. Nodes without `data-states` are always visible. This keeps one screen = one DOM contract, as the framework requires.

### Workflow (no scripts/)

1. Edit `mockup-manifest.js` and/or `index.html`
2. Mirror token changes in `:root` when editing `tokens.json`
3. Open `design/mockups/mobile/index.html` (or serve over HTTP)
4. Link `#screen=` from the related spec / backlog item when UX changes

PR checklist:

- [ ] Navigation ids exist in `screens`
- [ ] Each screen with `states` has unique `state_id`s and exactly one `initial: true`
- [ ] States do not declare `screen_id`, `route`, `dom_id`, `nav_screen`, or `kind`
- [ ] Every `data-states` value is declared in that screen's `states`
- [ ] Every `go('id')` / `go('id','state')` target exists
- [ ] Token changes mirrored in `:root`

The last three are mechanical — see the verification snippet in [mobile/README.md](./mobile/README.md#verification).

### Evolving mockups

| Change | Steps |
|--------|-------|
| **HTML screen** | Edit `index.html` + manifest |
| **Local state** | Add under `screens[].states` + `data-states` fragments |
| **New flow** | Agree `route` → `navigation` + screen |
| **With a spec** | Same PR / change set when possible |

---

## Project — Finanzas

| App | Path | Open |
|-----|------|------|
| `mobile` | [mobile/](./mobile/) | `#screen=home&state=pending` |
| `web` | — | not bootstrapped |

**Status:** complete · [mobile/INVENTORY.md](./mobile/INVENTORY.md)

### Figma

[Personal Finance App MVP](https://www.figma.com/design/1hvQP0Tu1ueQAxRWYFDIUa/Personal-Finance-App-MVP) — origen del prototipo v0. Estos mockups lo reemplazan como fuente de verdad de UX.
