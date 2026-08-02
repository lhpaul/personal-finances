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
    ignores: ['**/dist/**', '**/.turbo/**', '**/.expo/**', '**/node_modules/**'],
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
        ],
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
