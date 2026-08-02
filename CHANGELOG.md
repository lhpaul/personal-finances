# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Design system: `design/tokens.json` v1.0.0 and interactive HTML mockups covering 36 screens
  with 60 local states, built on the HTML Mockup Framework
- Project documentation: business domain, repository architecture, software architecture and
  the validated local-first SQLite data model
- Stack-specific best practices for Expo/React Native, SQLite + Drizzle, the bank scraper and
  design tokens
- AI development workflow from the `ai-dev-framework-template`
- **Bootstrap the monorepo and the Expo app** (#1): Turborepo + pnpm workspace with the Expo
  SDK 54 app (`apps/mobile`, Expo Router, strict TypeScript), the `shared-domain`,
  `shared-utils` and `bank-scraper` packages, placeholder routes for every MVP mockup screen,
  an enforced shared-domain import restriction, and lint / type-check / test checks on pull
  requests
- **shared-utils: CLP money, dates and RUT** (#4): `@finanzas/shared-utils` now ships CLP formatting (`formatClp`, `formatClpAbbreviated`), Chilean date helpers (`deriveDateLocal`, month/week period boundaries, es-CL labels) and RUT normalization, modulo-11 validation and display formatting. Locale formatting via `toLocaleString` is now an ESLint error repository-wide.
- **Theme and design-system primitives** (#2): `apps/mobile/src/theme.ts` as a parity-tested
  mirror of `design/tokens.json`, 23 UI primitives under `apps/mobile/src/components/ui/`
  matching the mockup `mu-*` classes, seven new design tokens, and a dev-only design-system
  gallery route at `/gallery`
- **i18n infrastructure: catalogues, resolver and the no-literal-string lint rule** (#34): `i18next` + `react-i18next` initialised in `apps/mobile/src/i18n/`, flat-key `es`/`en` catalogues, device-locale resolution via `expo-localization` defaulting to `es`, and `eslint-plugin-i18next/no-literal-string` enforcing, for JSX text covered by its `jsx-text-only` mode, that no user-facing literal string appears in JSX (known exception: the two tab-title literals in `apps/mobile/app/(tabs)/_layout.tsx`, which the rule's JSX-text-only mode cannot see). The design-system gallery now renders entirely from catalogue keys; `gallery.strings.ts` is removed.
- **Port the bank scraper with Banco de Chile** (#6): `@finanzas/bank-scraper` now ships the
  headless read engine (`ScrapeSession` with `start` / `cancel`, message routing, step state
  machine and WebView driver), the four Banco de Chile reading routines (sign in, product
  list, account movements, credit-card details) under
  `src/configs/cl/banco-de-chile/`, an exact bank-origin allowlist checked at three points
  before any credential is entered, a single-owner credential holder cleared before the
  browser session is torn down, a redacting diagnostic trail asserted by test, integer
  minor-unit amount parsing including foreign-currency card movements, timezone-independent
  `DD/MM/YYYY` dates, bounded retries with an overall read deadline, and
  `complete` / `partial` / `failed` / `cancelled` read outcomes carrying an opaque per-product
  identity. Banco Falabella and Banco Pelotillehue are not ported.

### Fixed

- **Fix the pnpm hoisted layout and add a CI bundle check** (#35): `nodeLinker: hoisted` now lives
  in `pnpm-workspace.yaml`, where pnpm 11 actually reads it — a plain `pnpm install` produces the
  hoisted layout the Expo/Metro resolver needs, and `.npmrc` (which pnpm 11 silently ignored) is
  gone. A new `pnpm check:layout` check runs on every install and in CI, a new `iOS bundle` CI job
  runs `expo export:embed` so a tree that cannot build the app can no longer be green, and a test
  now proves the `@finanzas/shared-domain` import restriction rejects a deliberate violation.
