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
    plugins: ['expo-router', 'expo-localization', 'expo-sqlite'],
  },
};
