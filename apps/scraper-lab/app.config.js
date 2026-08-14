const APP_VARIANTS = {
  development: { name: 'Scraper Lab [DEV]', id: 'cl.finanzas.scraper-lab.dev' },
  production: { name: 'Scraper Lab', id: 'cl.finanzas.scraper-lab' },
};

const variant = process.env.APP_VARIANT ?? 'development';
const identity = APP_VARIANTS[variant];
if (!identity) {
  throw new Error(
    `APP_VARIANT="${variant}" is not a known build variant. Expected one of: ${Object.keys(APP_VARIANTS).join(', ')}.`,
  );
}

module.exports = {
  expo: {
    name: identity.name,
    slug: 'finanzas-scraper-lab',
    scheme: 'finanzas-scraper-lab',
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
      supportsTablet: true,
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
    plugins: [
      'expo-router',
      'expo-localization',
      'expo-secure-store',
      ['expo-dev-client', { launchMode: 'most-recent' }],
    ],
  },
};
