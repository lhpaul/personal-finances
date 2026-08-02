# Finanzas

A personal-finance app for Chile whose defining constraint is that **your bank credentials
never leave your phone**.

Most apps in this space either broker your credentials through a server or depend on an
aggregator API. This one runs the bank scraping on-device, in a hidden WebView, and stores
everything in a local SQLite database. There is no backend.

---

## Status

The monorepo and the Expo app skeleton exist: every MVP route renders a placeholder naming
the mockup screen it stands for. The local database now exists too — schema, migrations and
starter content (banks, categories, merchants) are in place under `apps/mobile/src/db/`. No
screen is implemented yet.

| Artifact | Where |
|----------|-------|
| Interactive mockups (36 screens) | [`design/mockups/mobile/`](design/mockups/mobile/) |
| Design tokens | [`design/tokens.json`](design/tokens.json) |
| Domain, architecture, schema | [`docs/project/`](docs/project/) |
| Coding standards | [`docs/best-practices/`](docs/best-practices/) |
| Backlog | GitHub Projects |

## Quick start

```bash
open design/mockups/mobile/index.html
```

The mockups are the UI contract — flow, layout, copy and every screen state. Read
[`docs/project/1-business-domain.md`](docs/project/1-business-domain.md) next.

Run the app:

```bash
pnpm install
pnpm dev:mobile
```

## How it works

```
┌─ your phone ────────────────────────────────────┐
│                                                 │
│  expo-secure-store ──credentials──┐             │
│  (Keychain/Keystore)              ▼             │
│                            hidden WebView ──────┼──▶ your bank's site
│                                   │             │
│                            products+movements   │
│                                   ▼             │
│                          SQLite (expo-sqlite)   │
│                                   │             │
│                            categorization,      │
│                            charts, reminders    │
└─────────────────────────────────────────────────┘

          no server of ours in this diagram
```

**Stack:** Expo SDK 54 · React Native · Expo Router · SQLite + Drizzle · TanStack Query ·
Turborepo + pnpm. Details in
[`docs/project/3-software-architecture.md`](docs/project/3-software-architecture.md).

## MVP scope

In: Banco de Chile connection, sync, categorization, transactions, dashboard, settings, local
reminders. There is no sign-in — the profile is the device.

Out (present in the mockups, flagged `mvp: false`): presupuestos, planificación, beneficios,
banks other than Banco de Chile, multi-device sync.

## Development workflow

This repo uses the [AI Dev Framework](https://github.com/lhpaul/ai-dev-framework-template):
a staged Spec → Plan → Implement → Review → Release workflow that AI agents execute from
canonical protocols in [`docs/workflow/`](docs/workflow/). See [`AGENTS.md`](AGENTS.md).

## Local reference (not in this repo)

- `bank-scrapper-app/` — the scraper prototype; Banco de Chile already works. Source for
  `packages/bank-scraper`
- `personal-finances-app-mockups-v0/` — the Figma Make prototype, superseded by `design/mockups`

Both are separate git repos, kept locally and gitignored here.
