import fs from 'node:fs';
import vm from 'node:vm';

export type MockupScreen = {
  screen_id: string;
  route: string;
  mvp?: boolean;
  [key: string]: unknown;
};

export type MockupManifest = {
  screens: MockupScreen[];
  [key: string]: unknown;
};

const DESIGN_SYSTEM_SCREEN_IDS = ['ds-colors', 'ds-typography', 'ds-components'];

/**
 * Evaluates `design/mockups/mobile/mockup-manifest.js` — a browser-global script, not a
 * module — in an isolated `node:vm` context and returns `window.__MOCKUP_MANIFEST__`.
 *
 * Throws a descriptive error if the manifest global is missing after evaluation, so a future
 * manifest refactor that silently empties the expected route set fails loudly instead of
 * making the parity test trivially pass.
 */
export function loadMockupManifest(manifestPath: string): MockupManifest {
  const source = fs.readFileSync(manifestPath, 'utf8');
  const context: { window: Record<string, unknown> } = { window: {} };
  vm.runInNewContext(source, context, { filename: manifestPath });

  const manifest = context.window.__MOCKUP_MANIFEST__ as MockupManifest | undefined;
  if (!manifest || !Array.isArray(manifest.screens)) {
    throw new Error(
      `loadMockupManifest: window.__MOCKUP_MANIFEST__ was not an object with a "screens" ` +
        `array after evaluating ${manifestPath}. A manifest refactor may have silently ` +
        'emptied the expected route set.',
    );
  }

  return manifest;
}

/** The MVP route scope: every screen not flagged `mvp: false`, excluding the three
 * design-system reference screens (spec Business Rule 4). */
export function getMvpRoutes(manifest: MockupManifest): string[] {
  return manifest.screens
    .filter((screen) => screen.mvp !== false && !DESIGN_SYSTEM_SCREEN_IDS.includes(screen.screen_id))
    .map((screen) => screen.route);
}

/** The eight screens flagged `mvp: false` (spec MVP Route Scope exclusion table). */
export function getOutOfMvpScreens(manifest: MockupManifest): MockupScreen[] {
  return manifest.screens.filter((screen) => screen.mvp === false);
}
