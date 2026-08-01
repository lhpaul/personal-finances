# `mobile` app mockup

Mockup for the **`mobile`** app (frame: **phone** 393×852 @0.90).

Parent: [../README.md](../README.md) · [../../README.md](../../README.md)

---

## Framework

- **Tokens:** [`../../tokens.json`](../../tokens.json)
- **Manifest:** [`mockup-manifest.js`](./mockup-manifest.js) (sole source — sets `window.__MOCKUP_MANIFEST__`)
- **Viewer:** [`../shared/viewer.js`](../shared/viewer.js)
- **Default:** `#screen=home&state=pending`

All product screens are `kind: html` in `index.html`. Variants use `screens[].states` + `data-states` fragments.

### Quick start

```bash
open design/mockups/mobile/index.html
# or with a hash:
open 'design/mockups/mobile/index.html#screen=categorize&state=income'
```

HTTP:

```bash
cd design/mockups && python3 -m http.server 8765
open 'http://127.0.0.1:8765/mobile/#screen=home&state=pending'
```

**Sharing:** share the whole `design/mockups/` tree (needs `shared/` + `mobile/`). A lone `index.html` is not enough.

### Verification

Run from `design/mockups/mobile/` before opening a PR:

```bash
node -e "global.window={};require('./mockup-manifest.js');const m=window.__MOCKUP_MANIFEST__,fs=require('fs'),h=fs.readFileSync('index.html','utf8');const dom=[...h.matchAll(/<section class=\"app-screen\" id=\"([^\"]+)\"/g)].map(x=>x[1]);const ids=m.screens.map(s=>s.screen_id);const dec=Object.fromEntries(m.screens.map(s=>[s.screen_id,(s.states||[]).map(x=>x.state_id)]));const nav=[];(function w(i){for(const x of i||[]){if(x.screen_id)nav.push(x.screen_id);w(x.items)}})(m.navigation.flatMap(s=>s.items));const bad=[];ids.filter(i=>!dom.includes('s-'+i)).forEach(i=>bad.push('no DOM: '+i));dom.filter(d=>!ids.includes(d.slice(2))).forEach(d=>bad.push('orphan DOM: '+d));nav.filter(n=>!ids.includes(n)).forEach(n=>bad.push('nav not a screen: '+n));m.screens.filter(s=>s.states&&s.states.filter(x=>x.initial).length!==1).forEach(s=>bad.push('initial!=1: '+s.screen_id));for(const sec of h.split('<section class=\"app-screen\" id=\"').slice(1)){const id=sec.slice(0,sec.indexOf('\"')).slice(2);for(const mm of sec.matchAll(/data-states=\"([^\"]+)\"/g))for(const st of mm[1].split(/\s+/))if(!(dec[id]||[]).includes(st))bad.push('undeclared state '+id+' -> '+st)}for(const g of h.matchAll(/go\('([a-z0-9-]+)'(?:\s*,\s*'([a-z0-9-]+)')?\)/g))if(!ids.includes(g[1])||(g[2]&&!(dec[g[1]]||[]).includes(g[2])))bad.push('bad go(): '+g[0]);console.log(bad.length?bad.join('\n'):'OK — '+ids.length+' screens')"
```

The `data-states` check reports two false positives (`a`, `b`) from the documentation comment in the boot script — ignore those two lines.

### Screen kinds

| `kind` | Behavior |
|--------|----------|
| `html` | DOM screens in `index.html` (all screens today) |
| `image` | Optional PNG under `exports/` + app shell (unused) |

---

## Project — Finanzas · `mobile`

**Status:** `$status: complete` · 36 screens · rebuilt from the Figma Make prototype `personal-finances-app-mockups-v0`.

Inventory + open questions: [INVENTORY.md](./INVENTORY.md).

### Navigation

```
(auth)            → sign-in → verify-code
(onboarding)      → intro → value → connect-bank → bank-picker → bank-credentials
                    → bank-syncing → bank-connected → notifications → schedule → ready
categorize        → intro → categorize → merchant/[id] → complete
(tabs)/home       → home
(tabs)/transactions → transactions → transactions/[id]
dashboard         → dashboard
(tabs)/budgets    → budgets → budgets/new        · fuera del MVP
planning          → planning → planning/life     · fuera del MVP
(tabs)/benefits   → benefits → benefits/[cat]    · fuera del MVP
settings          → account | banks | banks/[id] | notifications | categories | about
design-system     → colors | typography | components
```

### Screens with local states

| `screen_id` | `state_id`s |
|-------------|-------------|
| `auth` | `empty` · `email-typed` |
| `verify-code` | `empty` · `filled` · `invalid` · `resend-ready` |
| `onboarding-value` | `step-1` · `step-2` · `step-3` |
| `bank-picker` | `list` · `search` · `no-results` |
| `bank-credentials` | `empty` · `filled` · `error` · `rut-locked` |
| `bank-syncing` | `login` · `products` · `transactions` · `error` |
| `categorize` | `expense` · `income` · `not-sure` · `advanced` · `exclude-sheet` |
| `merchant-edit` | `default` · `suggestions` · `category-picker` |
| `home` | `pending` · `all-clear` · `empty` · `sync-error` |
| `transactions` | `list` · `search` · `filters` · `empty` |
| `transaction-detail` | `categorized` · `uncategorized` · `excluded` · `exclude-sheet` |
| `dashboard` | `month` · `week` |
| `settings-banks` | `list` · `empty` · `disconnect-confirm` |
| `bank-review` | `ok` · `error` |
| `settings-categories` | `expense` · `income` · `edit` · `delete-confirm` |

Full list in [`mockup-manifest.js`](./mockup-manifest.js).

### Design system

| screen_id | route |
|-----------|-------|
| `ds-colors` | `design-system/colors` |
| `ds-typography` | `design-system/typography` |
| `ds-components` | `design-system/components` |

### Changelog

| Date | Change |
|------|--------|
| 2026-08-01 | Initial build: 36 screens rebuilt from the Figma Make prototype using the HTML Mockup Framework; tokens v1.0.0; `mvp: false` flag for budgets/planning/benefits |
