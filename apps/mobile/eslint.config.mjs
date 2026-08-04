// @ts-check
import expoConfig from 'eslint-config-expo/flat.js';
import i18nextPlugin from 'eslint-plugin-i18next';

import rootConfig, {
  dbAccessBoundary,
  notificationsBoundary,
  secureStoreBoundary,
} from '../../eslint.config.mjs';

export default [
  ...rootConfig,
  ...expoConfig,
  // `i18next/no-literal-string` — no user-facing literal string in JSX (AGENTS.md
  // non-negotiable 8). Copied verbatim from `docs/best-practices/stack/i18n.md`
  // (implementation plan Decision 6). `mode: 'jsx-text-only'` checks JSX *text children*
  // only — a literal in a JSX attribute or inside an object passed through an attribute is
  // not reported by this mode; see Decision 6 for the empirically-confirmed scope of this
  // control and the follow-up it leaves open. Appended as a new array entry so the existing
  // `[...rootConfig, ...expoConfig]` spread above is untouched.
  {
    files: ['app/**/*.tsx', 'src/**/*.tsx'],
    plugins: { i18next: i18nextPlugin },
    rules: {
      'i18next/no-literal-string': ['error', {
        mode: 'jsx-text-only',
        'jsx-attributes': {
          exclude: ['testID', 'accessibilityLabel', 'accessible'],
        },
      }],
    },
  },
  // SQL access boundary (implementation plan Decision 19, AC26). Applied to `app/**` and
  // `src/**`, with `src/db/**` ignored — that is the one directory allowed to import a SQL
  // library. See `dbAccessBoundary`'s own doc comment in the root `eslint.config.mjs` for the
  // rationale and the companion test.
  {
    ...dbAccessBoundary,
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    ignores: ['src/db/**'],
  },
  // Secure-store access boundary (implementation plan Decision 4, issue #9). Applied to
  // `app/**` and `src/**`, with only `expo-secure-store.adapter.ts` itself ignored — that is
  // the one file allowed to import `expo-secure-store` (found in review — CodeRabbit PR #80:
  // ignoring the whole `src/lib/secure-store/**` directory would let a future second file there
  // bypass this rule at lint time, even though the test-time boundary scan would still catch
  // it). See `secureStoreBoundary`'s own doc comment in the root `eslint.config.mjs` for the
  // rationale and the companion test.
  {
    ...secureStoreBoundary,
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    ignores: ['src/lib/secure-store/expo-secure-store.adapter.ts'],
  },
  // Notifications access boundary (implementation plan for issue #18, Decision 1). Applied to
  // `app/**` and `src/**`, with only `expo-notifications.adapter.ts` itself ignored — the one
  // file allowed to import `expo-notifications`. See `notificationsBoundary`'s own doc comment
  // in the root `eslint.config.mjs` for the rationale and the companion test.
  {
    ...notificationsBoundary,
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    ignores: ['src/lib/notifications/expo-notifications.adapter.ts'],
  },
  // No credential value may ever reach a log line (AGENTS.md non-negotiable 1, Business Rule 1).
  // `no-console` is `'warn'` for the rest of the workspace (root config); these directories are
  // the ones that see a plaintext RUT/password, so a stray `console.*` there is a hard error.
  // `src/features/bank-syncing/**` added for issue #11 (implementation plan Infrastructure /
  // Configuration): `use-scraper-runner.tsx` and `use-bank-sync.ts` hold the credential for the
  // life of an attempt, matching item #9's `src/features/connect-bank/**` precedent exactly.
  {
    files: [
      'src/lib/secure-store/**/*.{ts,tsx}',
      'src/features/connect-bank/**/*.{ts,tsx}',
      'src/features/bank-syncing/**/*.{ts,tsx}',
    ],
    rules: {
      'no-console': 'error',
    },
  },
];
