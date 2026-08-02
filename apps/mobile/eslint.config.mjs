// @ts-check
import expoConfig from 'eslint-config-expo/flat.js';
import i18nextPlugin from 'eslint-plugin-i18next';

import rootConfig from '../../eslint.config.mjs';

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
];
