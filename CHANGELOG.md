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
