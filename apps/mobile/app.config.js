// No environment variable is read here (spec AC1: no undocumented environment variable at
// install/build time). App-level config only. Icons/splash are the unmodified default Expo
// template assets — no design decision is made here (spec UX Rules); the theme and
// design-system primitives are mirrored into the app by a later item.
module.exports = {
  expo: {
    name: 'Finanzas',
    slug: 'finanzas',
    scheme: 'finanzas',
    version: '0.0.0',
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
      bundleIdentifier: 'cl.finanzas.mobile',
    },
    android: {
      package: 'cl.finanzas.mobile',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: ['expo-router'],
  },
};
