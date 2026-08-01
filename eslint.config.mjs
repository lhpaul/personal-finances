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
  ...tseslint.configs.recommended,
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
