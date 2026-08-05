// APP_VARIANT is the one documented build-time variable (implementation plan
// docs/specs/developments/20260802155158_23-eas-build-release-ci Decision D2). It is set by
// every apps/mobile/eas.json build profile (`development`, `development-device`, `preview`,
// `production`) and defaults to `development` when unset — the code path taken by local
// `expo run:ios` and the CI `bundle` job. No feature code may read this variable; it is
// consumed only here, to select the app identity below.
const APP_VARIANTS = {
  development: { name: 'Finanzas [DEV]', id: 'cl.finanzas.mobile.dev' },
  preview: { name: 'Finanzas [BETA]', id: 'cl.finanzas.mobile.preview' },
  production: { name: 'Finanzas', id: 'cl.finanzas.mobile' },
};

const variant = process.env.APP_VARIANT ?? 'development';
const identity = APP_VARIANTS[variant];
if (!identity) {
  throw new Error(
    `APP_VARIANT="${variant}" is not a known build variant. ` +
      `Expected one of: ${Object.keys(APP_VARIANTS).join(', ')}.`,
  );
}

module.exports = {
  expo: {
    name: identity.name,
    slug: 'finanzas',
    scheme: 'finanzas',
    // One version source (Decision D10): apps/mobile/package.json. eas.json's
    // cli.appVersionSource: "remote" means EAS owns ios.buildNumber / android.versionCode
    // separately — this field never carries a build number.
    version: require('./package.json').version,
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: identity.id,
    },
    android: {
      package: identity.id,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
    },
    web: {
      favicon: './assets/favicon.png',
    },
    // `useSQLCipher: true` (issue #25, Decision 2) compiles `expo-sqlite` against its vendored
    // SQLCipher build instead of plain SQLite — a native-build-flag change, never deliverable as
    // a JS-only OTA update. Every developer, every EAS profile and every existing dev client must
    // be rebuilt (`npx expo prebuild --clean`) after this change lands.
    plugins: ['expo-router', 'expo-localization', ['expo-sqlite', { useSQLCipher: true }]],
    // Non-secret EAS project identifier (implementation plan Decision D12) — written by
    // `eas init --account lhpaul --non-interactive` (H1). Public, not a credential; every
    // build variant shares the one EAS project.
    extra: {
      eas: {
        projectId: '2447749d-611f-4c85-8dc0-0a9b04200ef1',
      },
    },
    owner: 'lhpaul',
  },
};
