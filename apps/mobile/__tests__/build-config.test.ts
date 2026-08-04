import easJson from '../eas.json';
import pkg from '../package.json';

/**
 * Anti-drift control between apps/mobile/eas.json and apps/mobile/app.config.js
 * (implementation plan docs/specs/developments/20260802155158_23-eas-build-release-ci,
 * Decision D2, D3, D5, D10). `app.config.js` is a CommonJS module read once per `require`, so
 * every variant case resets the module registry and restores `process.env.APP_VARIANT`
 * afterwards — case order must not change the result.
 */

type AppConfig = {
  expo: {
    name: string;
    scheme: string;
    version: string;
    ios: { bundleIdentifier: string };
    android: { package: string };
  };
};

const KNOWN_VARIANTS = ['development', 'preview', 'production'];

function loadExpoConfig(variant: string | undefined): AppConfig['expo'] {
  jest.resetModules();
  if (variant === undefined) {
    delete process.env.APP_VARIANT;
  } else {
    process.env.APP_VARIANT = variant;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const config = require('../app.config.js') as AppConfig;
  return config.expo;
}

describe('app.config.js build variants', () => {
  const originalVariant = process.env.APP_VARIANT;

  afterEach(() => {
    if (originalVariant === undefined) {
      delete process.env.APP_VARIANT;
    } else {
      process.env.APP_VARIANT = originalVariant;
    }
    jest.resetModules();
  });

  it('resolves the development identity', () => {
    const expo = loadExpoConfig('development');
    expect(expo.name).toBe('Finanzas [DEV]');
    expect(expo.ios.bundleIdentifier).toBe('cl.finanzas.mobile.dev');
    expect(expo.android.package).toBe('cl.finanzas.mobile.dev');
  });

  it('resolves the preview identity', () => {
    const expo = loadExpoConfig('preview');
    expect(expo.name).toBe('Finanzas [BETA]');
    expect(expo.ios.bundleIdentifier).toBe('cl.finanzas.mobile.preview');
    expect(expo.android.package).toBe('cl.finanzas.mobile.preview');
  });

  it('resolves the production identity', () => {
    const expo = loadExpoConfig('production');
    expect(expo.name).toBe('Finanzas');
    expect(expo.ios.bundleIdentifier).toBe('cl.finanzas.mobile');
    expect(expo.android.package).toBe('cl.finanzas.mobile');
  });

  it('defaults to the development identity when APP_VARIANT is unset', () => {
    const expo = loadExpoConfig(undefined);
    expect(expo.name).toBe('Finanzas [DEV]');
    expect(expo.ios.bundleIdentifier).toBe('cl.finanzas.mobile.dev');
    expect(expo.android.package).toBe('cl.finanzas.mobile.dev');
  });

  it('throws on an unknown APP_VARIANT, naming the variable and the accepted values', () => {
    expect(() => loadExpoConfig('staging')).toThrow(/APP_VARIANT/);
    expect(() => loadExpoConfig('staging')).toThrow(/development, preview, production/);
  });

  it.each(KNOWN_VARIANTS)('keeps a single URL scheme for variant %s', (variant) => {
    const expo = loadExpoConfig(variant);
    expect(expo.scheme).toBe('finanzas');
  });

  it.each(KNOWN_VARIANTS)(
    'takes the version from apps/mobile/package.json for variant %s',
    (variant) => {
      const expo = loadExpoConfig(variant);
      expect(expo.version).toBe(pkg.version);
      expect(expo.version).not.toBe('9.9.9');
    },
  );
});

describe('eas.json <-> app.config.js agreement', () => {
  it('every declared build profile env.APP_VARIANT is a variant app.config.js accepts, and the profile name matches it', () => {
    const buildProfiles = easJson.build as Record<string, { env?: Record<string, string> }>;
    const profilesWithVariant = Object.entries(buildProfiles).filter(
      ([, profile]) => profile.env?.APP_VARIANT !== undefined,
    );

    // The control only means something if it actually checks something.
    expect(profilesWithVariant.length).toBeGreaterThan(0);

    for (const [profileName, profile] of profilesWithVariant) {
      const appVariant = profile.env?.APP_VARIANT;
      expect(KNOWN_VARIANTS).toContain(appVariant);
      expect(profileName).toBe(appVariant);
    }
  });

  it('development-device extends development and overrides only the simulator flag', () => {
    const developmentDevice = easJson.build['development-device'];
    expect(developmentDevice.extends).toBe('development');
    expect(developmentDevice.ios?.simulator).toBe(false);
  });
});

describe('eas.json build profiles', () => {
  it('development is a dev-client Simulator build', () => {
    const development = easJson.build.development;
    expect(development.developmentClient).toBe(true);
    expect(development.ios?.simulator).toBe(true);
  });

  it('preview and production auto-increment their remote build number', () => {
    expect(easJson.cli.appVersionSource).toBe('remote');
    expect(easJson.build.preview.autoIncrement).toBe(true);
    expect(easJson.build.production.autoIncrement).toBe(true);
  });

  it('declares a submit profile for production and carries no key material', () => {
    expect(easJson.submit.production).toBeDefined();

    const serialized = JSON.stringify(easJson);
    const keyLikePatterns = [/\.p8/i, /\.p12/i, /password/i, /keystore/i, /apiKey/i];
    for (const pattern of keyLikePatterns) {
      expect(serialized).not.toMatch(pattern);
    }
  });
});
