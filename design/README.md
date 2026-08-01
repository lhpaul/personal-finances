# Design

Visual design artifacts for **Finanzas**: **tokens** (canonical) and **interactive HTML mockups**.

This tree lives in the **product repo** because the AI development workflow (`docs/`, backlog, implementation agents) runs here — agents need tokens, mockups and specs in a single clone.

**Canonical framework:** `~/Git/Cerebro/LH/40 - Conocimiento/Topics/HTML Mockup Framework.md`

No build step. Open `mockups/mobile/index.html` directly (`file://`) or serve `mockups/` over HTTP. Keep the `mockups/` folder together when sharing (`shared/` + `mobile/`).

---

## Framework

### Repo home

| Concern | Home |
|---------|------|
| Specs, plans, ADRs, **mockups, tokens**, backlog | This repo |
| Idea / discovery notes | `~/Git/Cerebro/LH/40 - Conocimiento/App Ideas/Personal Finance App` |
| Figma Make prototype (v0, superseded) | `personal-finances-app-mockups-v0/` |

### Layout

```
design/
├── README.md
├── tokens.json
└── mockups/
    ├── README.md
    ├── shared/viewer.js
    └── mobile/
        ├── README.md
        ├── index.html
        ├── mockup-manifest.js     ← sole manifest source
        ├── assets/
        └── INVENTORY.md
```

### Apps

| App | Path | Frame | Open |
|-----|------|-------|------|
| `mobile` | [mockups/mobile/](./mockups/mobile/) | `phone` 393×852 @0.90 | see Quick start |
| `web` | not bootstrapped | — | — |

### Viewer

- Hash: `#screen=<screen_id>&state=<state_id>` (omit `state` when unused)
- `navigation` / `screens[]` = real destinations; visual variants = `screens[].states`
- Shell: [`mockups/shared/viewer.js`](./mockups/shared/viewer.js) reads `window.__MOCKUP_MANIFEST__` from `mockup-manifest.js`
- States are **not** separate DOM screens. Each screen owns one `<section>`; fragments scoped to a subset of states declare `data-states="a b"` and the boot script toggles `hidden`.

### Token workflow

1. Edit [`tokens.json`](./tokens.json)
2. Mirror the values in each mockup `index.html` `:root` block **in the same commit**
3. The Expo theme (`packages/ui/theme.ts`) follows the JSON

### Source-of-truth hierarchy

1. **Product specifications** (`docs/project/`) — business rules win
2. **`tokens.json` + DS screens (`ds-*`)** — visual language
3. **Mockup product screens** — flow, layout, copy
4. **Figma Make prototype** — upstream reference; superseded by these mockups
5. **Production code** — converges upward

---

## Project — Finanzas

### Brand

- **Primary:** `#6366f1` (índigo) — CTAs, links, tab activo, series principal de gráficos
- **Secondary:** `#f59e0b` (ámbar) — gastos, pendientes, acentos cálidos
- **Celebration:** `#8b5cf6` (violeta) — heroes de desafío, logros
- **Typography:** system UI stack (sin fuente web; la app usa la del sistema)

### Color roles

| Token | Hex | Use |
|-------|-----|-----|
| `brandPrimary` | `#6366f1` | Marca, CTA, tab activo |
| `brandSecondary` | `#f59e0b` | Montos de gasto, estados pendientes |
| `surface0` / `surface1` | `#fafbfc` / `#ffffff` | Fondo de app / cards |
| `success` / `successBg` | `#10b981` / `#ecfdf5` | Ingresos, sincronizado, al día |
| `warning` / `warningBg` | `#f59e0b` / `#fffbeb` | Sin categorizar, cerca del límite |
| `danger` / `dangerBg` | `#ef4444` / `#fef2f2` | Errores, acciones destructivas |
| `celebration` | `#8b5cf6` | Desafíos y celebración |

Full set: [`tokens.json`](./tokens.json). Swatches: `#screen=ds-colors`.

### Status

| App | `$status` | Notes |
|-----|-----------|-------|
| `mobile` | `complete` | 36 pantallas · [INVENTORY.md](./mockups/mobile/INVENTORY.md) |

### MVP scope

Los mockups cubren el producto completo. El **desarrollo del MVP deja fuera** Presupuestos/Planificación y Beneficios: esas pantallas llevan `mvp: false` en el manifest y el panel de metadata las marca como **Fuera del MVP**.

### Quick start

```bash
open design/mockups/mobile/index.html
```

O sobre HTTP:

```bash
cd design/mockups && python3 -m http.server 8765
```

→ `http://127.0.0.1:8765/mobile/#screen=home&state=pending`
