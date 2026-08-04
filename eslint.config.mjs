// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Shared flat-config base, consumed by every workspace's own `eslint.config.mjs`.
 *
 * Kept workspace-agnostic on purpose: ESLint 9 flat config resolves `files` / `ignores`
 * globs relative to the config file that defines them, not to the directory ESLint was
 * invoked from, and each workspace loads this file from its own directory (Decision 3 in
 * the implementation plan). No root-relative path assumptions belong here.
 */
const sharedConfig = tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.turbo/**',
      '**/.expo/**',
      '**/node_modules/**',
      // Parallel-lane git worktrees live under .claude/worktrees/; a root-invoked lint must
      // never descend into them — CI clones never contain them, so linting them locally only
      // produces phantom errors from sibling lanes' in-flight trees.
      '**/.claude/worktrees/**',
    ],
  },
  js.configs.recommended,
  {
    // Scoped to TypeScript files only: `tseslint.configs.recommended` sets rules such as
    // `@typescript-eslint/no-require-imports` that are wrong for the plain CommonJS `.js`
    // config files every workspace has (jest.config.js, metro.config.js, babel.config.js).
    files: ['**/*.{ts,tsx}'],
    extends: [...tseslint.configs.recommended],
  },
  {
    // Every workspace's own config file (jest.config.js, eslint.config.mjs, metro.config.js,
    // babel.config.js) runs under Node, not a bundler or browser — without this, ESLint's
    // core `no-undef` rule flags `module` / `require` / `__dirname` as unknown globals.
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-console': 'warn',
    },
  },
  {
    // Wider than the no-console entry above, on purpose: AC4's residual scan and the CHANGELOG
    // claim ("no toLocaleString calls remain in app code") cover `.js` too, so this ban must not
    // be TypeScript-only — the repo already has real, committed `.js` files (app.config.js,
    // jest.config.js, metro.config.js, babel.config.js, and packages/bank-scraper's per-bank
    // script configs). AC4, implementation plan Decision 11.
    files: ['**/*.{ts,tsx,js,jsx,mjs,cjs}'],
    rules: {
      'no-restricted-properties': [
        'error',
        ...['toLocaleString', 'toLocaleDateString', 'toLocaleTimeString'].map((property) => ({
          property,
          message:
            'Locale formatting is not byte-stable across Hermes and ICU builds. Use @finanzas/shared-utils (formatClp, formatShortDate, formatLongDate) instead.',
        })),
      ],
    },
  },
);

export default sharedConfig;

/**
 * Domain-purity restriction (spec Business Rule 6, Use Case 4, AC7).
 *
 * `@finanzas/shared-domain` may not depend on the app, on Expo modules, or on any SQL
 * library. Applied only by `packages/shared-domain/eslint.config.mjs` — the app and the
 * other shared packages are not restricted by this rule.
 */
export const sharedDomainPurity = {
  files: ['**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: [
              'expo',
              'expo-*',
              'react-native',
              'react-native-*',
              '@finanzas/mobile',
              '**/apps/**',
              'drizzle-orm',
              'drizzle-orm/*',
              'expo-sqlite',
              'better-sqlite3',
              'sqlite3',
              'knex',
              'kysely',
              'typeorm',
              '@prisma/client',
            ],
            message:
              '@finanzas/shared-domain may not depend on the app, on Expo modules, or on any SQL library.',
          },
          {
            // NOT 'react-*': that would also match 'react-native', which the group above already
            // matches, producing two findings for one import (issue #5, Decision 8).
            group: ['react', 'react/*', 'react-dom', 'react-dom/*'],
            message: '@finanzas/shared-domain may not depend on React.',
          },
        ],
      },
    ],
    // Issue #5, Decision 8 — AC3 "no Date.now()": the clock is injected as a DateLocal produced
    // by @finanzas/shared-utils' deriveDateLocal(instant); nothing in this package may read the
    // host clock. checkGlobalObject: true also catches globalThis.Date.
    'no-restricted-globals': [
      'error',
      {
        globals: [
          {
            name: 'Date',
            message:
              '@finanzas/shared-domain must not read the clock. The instant is injected as a ' +
              'DateLocal produced by @finanzas/shared-utils deriveDateLocal(instant).',
          },
        ],
        checkGlobalObject: true,
        // CodeRabbit finding on PR #44: checkGlobalObject only checks globalThis/self/window by
        // default, not Node's `global` alias — without this, `global.Date.now()` would bypass
        // the ban this rule exists to enforce.
        globalObjects: ['global'],
      },
    ],
  },
};

/**
 * `@finanzas/shared-utils` purity restriction (implementation plan Decision 11, issue #4).
 *
 * `@finanzas/shared-utils` may not depend on React, on Expo/React Native modules, on the app,
 * or on any Node I/O built-in. Applied only by `packages/shared-utils/eslint.config.mjs` — the
 * app and the other shared packages are not restricted by this rule. Mirrors the shape of
 * `sharedDomainPurity` above; that export is not renamed and `shared-domain`'s own config is not
 * touched by this addition.
 */
export const sharedUtilsPurity = {
  files: ['**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: [
              'react',
              'react-*',
              'expo',
              'expo-*',
              'react-native',
              'react-native-*',
              '@finanzas/mobile',
              '**/apps/**',
              'drizzle-orm',
              'drizzle-orm/*',
              'expo-sqlite',
              'better-sqlite3',
              'sqlite3',
              'knex',
              'kysely',
              'typeorm',
              '@prisma/client',
              'node:fs',
              'node:fs/*',
              'node:net',
              'node:http',
              'node:http2',
              'node:http2/*',
              'node:https',
              'node:tls',
              'node:tls/*',
              'node:child_process',
              'node:cluster',
              'node:cluster/*',
              'node:worker_threads',
              'node:dgram',
              'node:dns',
              'node:dns/*',
              'node:readline',
              'node:readline/*',
              'node:repl',
              'node:vm',
              'fs',
              'fs/*',
              'net',
              'http',
              'http2',
              'http2/*',
              'https',
              'tls',
              'tls/*',
              'child_process',
              'cluster',
              'cluster/*',
              'worker_threads',
              'dgram',
              'dns',
              'dns/*',
              'readline',
              'readline/*',
              'repl',
              'vm',
              'node:process',
              'process',
              'node:os',
              'os',
            ],
            message:
              '@finanzas/shared-utils must stay pure: no React, no Expo/React Native modules, no SQL library, and no Node I/O.',
          },
        ],
      },
    ],
    // `checkGlobalObject: true` (plus `global` in `globalObjects`, alongside ESLint's own
    // defaults `globalThis`/`self`/`window`) closes the gap the bare `globals` array leaves open:
    // without it, `globalThis.process?.env` or `global.process` would not be flagged, only a bare
    // `process` identifier.
    'no-restricted-globals': [
      'error',
      {
        globals: [
          {
            name: 'process',
            message:
              '@finanzas/shared-utils must stay pure: no Node I/O. Do not read process.env or any other process global (including via globalThis.process / global.process); pass configuration in as an explicit function argument instead.',
          },
          {
            name: 'global',
            message: '@finanzas/shared-utils must stay pure: no Node globals.',
          },
        ],
        checkGlobalObject: true,
        globalObjects: ['global'],
      },
    ],
  },
};

/**
 * SQL access boundary (implementation plan Decision 19, AC26). `apps/mobile/src/db/` is the only
 * place allowed to import a SQL library — `AGENTS.md`'s layering contract
 * (`app/ → feature hooks → src/db → SQLite`) says screens never import Drizzle. Applied only by
 * `apps/mobile/eslint.config.mjs`, from `app/**` and `src/**`, with `src/db/**` ignored there (the
 * `ignores` entry lives beside the `files` entry that applies this export, not here, so this
 * export stays reusable if a second app is ever added to the workspace).
 *
 * A companion test, `apps/mobile/src/db/__tests__/db-access-boundary.test.ts`, scans the same
 * tree for the same import specifiers, so the guarantee survives a lint-config regression.
 */
export const dbAccessBoundary = {
  files: ['**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['drizzle-orm', 'drizzle-orm/*', 'expo-sqlite', 'better-sqlite3'],
            message:
              'Only apps/mobile/src/db/ may import a SQL library. Screens and feature hooks call a src/db repository function instead (AGENTS.md layering: app/ → feature hooks → src/db → SQLite).',
          },
        ],
      },
    ],
  },
};

/**
 * Secure-store access boundary (implementation plan Decision 4, issue #9). A bank credential may
 * only ever be handled by one module —
 * `apps/mobile/src/lib/secure-store/expo-secure-store.adapter.ts` — so `expo-secure-store` may not
 * be imported anywhere else in the app. Mirrors `dbAccessBoundary`'s shape exactly. Applied only
 * by `apps/mobile/eslint.config.mjs`, from `app/**` and `src/**`, with only that **exact file**
 * ignored there (found in review — CodeRabbit PR #80: ignoring the whole
 * `src/lib/secure-store/**` directory would let a *second* file added there later bypass this
 * rule, even though `port.ts`/`credential-store.ts` never need to import the package themselves).
 *
 * A companion test, `apps/mobile/src/__tests__/secure-store-boundary.test.ts`, scans the same
 * tree for the same import specifier, so the guarantee survives a lint-config regression.
 */
export const secureStoreBoundary = {
  files: ['**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['expo-secure-store', 'expo-secure-store/*'],
            message:
              'Only apps/mobile/src/lib/secure-store/expo-secure-store.adapter.ts may import expo-secure-store. Every other caller goes through the SecureStorePort (AGENTS.md non-negotiable 1).',
          },
        ],
      },
    ],
  },
};
