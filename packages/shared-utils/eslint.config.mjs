// @ts-check
import rootConfig, { sharedUtilsPurity } from '../../eslint.config.mjs';

export default [
  ...rootConfig,
  sharedUtilsPurity,
  {
    // Raised from the root's 'warn' (Decision 9, Decision 11): the RUT is credential material,
    // so an accidental console.log in this workspace must fail the lint gate, not just warn.
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-console': 'error',
    },
  },
];
