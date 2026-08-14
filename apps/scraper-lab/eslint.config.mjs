// @ts-check
import expoConfig from 'eslint-config-expo/flat.js';
import i18nextPlugin from 'eslint-plugin-i18next';

import rootConfig, { secureStoreBoundary } from '../../eslint.config.mjs';

export default [
  ...rootConfig,
  ...expoConfig,
  {
    files: ['app/**/*.tsx', 'src/**/*.tsx'],
    plugins: { i18next: i18nextPlugin },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-text-only',
          'jsx-attributes': {
            exclude: ['testID', 'accessibilityLabel', 'accessible'],
          },
        },
      ],
    },
  },
  {
    ...secureStoreBoundary,
    files: ['app/**/*.{ts,tsx}', 'src/**/*.{ts,tsx}'],
    ignores: ['src/lib/secure-store/expo-secure-store.adapter.ts'],
  },
  {
    files: ['src/lib/secure-store/**/*.{ts,tsx}', 'app/credentials.tsx'],
    rules: {
      'no-console': 'error',
    },
  },
  {
    files: ['src/i18n/index.ts'],
    rules: {
      'import/no-named-as-default-member': 'off',
    },
  },
];
