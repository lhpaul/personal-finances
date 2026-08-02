// @ts-check
import rootConfig from '../../eslint.config.mjs';

/**
 * This package's own lint fence (implementation plan Decision 12, issue #6).
 *
 * `packages/bank-scraper` is the only module that ever touches a bank credential, so its lint
 * fence is stricter than the repo default: a stray `console.log` here is a credential-leak
 * vector, not a style issue, and the package must never gain a path to a server, a SQL library,
 * the secure store, or the rest of the workspace.
 */
export default [
  ...rootConfig,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // Raised from the root's 'warn' (matches packages/shared-utils).
      'no-console': 'error',
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'expo-secure-store', message: 'Credentials are handed in by the caller. This package never reads the secure store.' },
            { name: 'expo-sqlite', message: 'This package writes nothing to SQLite (Business Rule 1, AC3).' },
            { name: 'drizzle-orm', message: 'This package writes nothing to SQLite (Business Rule 1, AC3).' },
            { name: 'better-sqlite3', message: 'This package writes nothing to SQLite (Business Rule 1, AC3).' },
            { name: 'axios', message: 'There is no backend. This package talks only to the bank via the WebView.' },
            { name: 'node-fetch', message: 'There is no backend. This package talks only to the bank via the WebView.' },
            { name: 'undici', message: 'There is no backend. This package talks only to the bank via the WebView.' },
            { name: '@react-native-async-storage/async-storage', message: 'Nothing from a session outlives the read (Business Rule 7).' },
            { name: 'expo-file-system', message: 'No bank page content is written to disk (AC31).' },
          ],
          patterns: [
            { group: ['drizzle-orm/*'], message: 'This package writes nothing to SQLite (Business Rule 1, AC3).' },
            { group: ['@sentry/*'], message: 'No crash reporting leaves the device (Operational Visibility).' },
            { group: ['@amplitude/*'], message: 'No analytics leaves the device (Operational Visibility).' },
            { group: ['**/apps/**'], message: 'This package may not depend on an app (AGENTS.md non-negotiable 9).' },
            { group: ['../../*', '../../../*', '../../../../*'], message: 'No cross-package relative imports (AGENTS.md non-negotiable 9). Import shared code by its @finanzas/* name.' },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'There is no backend (AC31, escalation check).' },
        { name: 'XMLHttpRequest', message: 'There is no backend (AC31, escalation check).' },
        { name: 'WebSocket', message: 'There is no backend (AC31, escalation check).' },
        { name: 'EventSource', message: 'There is no backend (AC31, escalation check).' },
      ],
    },
  },
];
