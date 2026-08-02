#!/usr/bin/env node
/**
 * Captures a mockup screen from `design/mockups/mobile/index.html` into a PNG at an exact
 * profile size, using Playwright Chromium (implementation plan Layer-by-Layer §
 * `capture-mockup.mjs`).
 *
 * Usage:
 *   node scripts/mobile-ui/capture-mockup.mjs --screen home --state pending
 *   node scripts/mobile-ui/capture-mockup.mjs --screen home --state pending --output <path>
 *   node scripts/mobile-ui/capture-mockup.mjs --screen home --state pending \
 *     --override-css ":root{--brand:#ef4444}"
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertScreenInManifest, assertStateInManifest, initialStateForScreen, loadManifest } from './load-manifest.mjs';
import { validateFidelityContract } from './fidelity-contract.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MOCKUP_HTML = path.join(REPO_ROOT, 'design/mockups/mobile/index.html');
const DEFAULT_OUTPUT_DIR = path.join(REPO_ROOT, '.tmp/ui-fidelity');

function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value) throw new Error(`${flag} requires a value`);
  return value;
}

export function parseArgs(argv) {
  const options = { profile: undefined };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--screen') options.screen = requireValue(argv, index++, arg);
    else if (arg === '--state') options.state = requireValue(argv, index++, arg);
    else if (arg === '--profile') options.profile = requireValue(argv, index++, arg);
    else if (arg === '--output') options.output = requireValue(argv, index++, arg);
    else if (arg === '--override-css') options.overrideCss = requireValue(argv, index++, arg);
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (options.help) return options;
  if (!options.screen) throw new Error('--screen is required');
  return options;
}

async function main() {
  const options = parseArgs(process.argv);
  if (options.help) {
    console.log(
      'Usage: node scripts/mobile-ui/capture-mockup.mjs --screen <id> [--state <id>] [--profile <id>] [--output <path>] [--override-css <css>]',
    );
    return;
  }

  const validation = validateFidelityContract({ root: REPO_ROOT });
  const profileId = options.profile ?? validation.contract.default_profile;
  const dimensions = validation.contract.profiles[profileId];
  if (!dimensions) throw new Error(`Unknown fidelity profile "${profileId}"`);

  const manifest = loadManifest(REPO_ROOT);
  assertScreenInManifest(manifest, options.screen);
  if (options.state) assertStateInManifest(manifest, options.screen, options.state);
  const state = options.state ?? initialStateForScreen(manifest, options.screen);

  const slug = state ? `${options.screen}-${state}` : options.screen;
  const output = path.resolve(options.output ?? path.join(DEFAULT_OUTPUT_DIR, `mock-${slug}-${profileId}.png`));
  await mkdir(path.dirname(output), { recursive: true });

  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch (error) {
    throw new Error(`Failed to load Playwright: ${error.message}. Run: npx playwright install chromium`);
  }

  let browser;
  try {
    browser = await chromium.launch();
  } catch (error) {
    throw new Error(
      `Chromium launch failed: ${error.message}\nRun: npx playwright install chromium`,
    );
  }

  try {
    const page = await browser.newPage({
      viewport: { width: Math.max(1280, dimensions.width), height: Math.max(960, dimensions.height) },
    });

    await page.goto(`file://${MOCKUP_HTML}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => typeof globalThis.go === 'function');

    if (options.overrideCss) {
      await page.addStyleTag({ content: options.overrideCss });
    }

    await page.evaluate(
      ({ screenId, stateId }) => {
        globalThis.go(screenId, stateId);
      },
      { screenId: options.screen, stateId: state },
    );

    // Neutralise `transform: scale(var(--phone-scale))` and pin the frame to the exact
    // profile size, so the capture never depends on the viewer's responsive scale factor.
    await page.evaluate(
      ({ width, height }) => {
        const phone = document.querySelector('.phone');
        const slot = document.querySelector('.phone-slot');
        if (phone instanceof HTMLElement) {
          phone.style.boxSizing = 'border-box';
          phone.style.width = `${width}px`;
          phone.style.height = `${height}px`;
          phone.style.transform = 'none';
        }
        if (slot instanceof HTMLElement) {
          slot.style.width = `${width}px`;
          slot.style.height = `${height}px`;
        }
      },
      dimensions,
    );

    await page.waitForTimeout(250);

    const phone = page.locator('.phone');
    await phone.waitFor({ state: 'visible', timeout: 10_000 });
    const box = await phone.boundingBox();
    if (box == null) throw new Error('Mockup phone frame has no capture bounds');

    await page.screenshot({
      clip: { x: box.x, y: box.y, width: dimensions.width, height: dimensions.height },
      path: output,
    });

    console.log(`Mockup screenshot saved (${profileId}, ${dimensions.width}×${dimensions.height}): ${output}`);
  } finally {
    await browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
