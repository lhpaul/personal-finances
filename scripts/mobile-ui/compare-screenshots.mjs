#!/usr/bin/env node
/**
 * Diffs a mockup capture against an app capture with pixelmatch, writes a diff PNG and a
 * markdown report carrying an explicit PASS/FAIL verdict, and — the behavioural difference
 * from the Zeki original, which only reported — **exits 1 when the mismatch exceeds the
 * threshold** (implementation plan Decision 10, Layer-by-Layer § `compare-screenshots.mjs`).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_OUTPUT_DIR = path.join(REPO_ROOT, '.tmp/ui-fidelity');
const ASPECT_RATIO_TOLERANCE = 0.01;

function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
  return value;
}

export function parseArgs(argv) {
  const options = {
    maxMismatchPct: 3.0,
    pixelThreshold: 0.1,
    profile: 'unspecified',
    target: 'unspecified',
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--mock') options.mock = requireValue(argv, index++, arg);
    else if (arg === '--app') options.app = requireValue(argv, index++, arg);
    else if (arg === '--diff') options.diff = requireValue(argv, index++, arg);
    else if (arg === '--report') options.report = requireValue(argv, index++, arg);
    else if (arg === '--target') options.target = requireValue(argv, index++, arg);
    else if (arg === '--profile') options.profile = requireValue(argv, index++, arg);
    else if (arg === '--max-mismatch-pct')
      options.maxMismatchPct = Number(requireValue(argv, index++, arg));
    else if (arg === '--pixel-threshold')
      options.pixelThreshold = Number(requireValue(argv, index++, arg));
    else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (options.help) return options;
  if (!options.mock || !options.app) {
    throw new Error('Both --mock and --app are required.');
  }
  if (!Number.isFinite(options.maxMismatchPct) || options.maxMismatchPct <= 0) {
    throw new Error('--max-mismatch-pct must be a positive finite number.');
  }
  const base = path.basename(options.mock, path.extname(options.mock)).replace(/^mock-/, '');
  options.mock = path.resolve(options.mock);
  options.app = path.resolve(options.app);
  options.diff = path.resolve(options.diff ?? path.join(DEFAULT_OUTPUT_DIR, `diff-${base}.png`));
  options.report = path.resolve(
    options.report ?? path.join(DEFAULT_OUTPUT_DIR, `report-${base}.md`),
  );
  return options;
}

async function loadPng(filePath) {
  const buffer = await readFile(filePath);
  return PNG.sync.read(buffer);
}

function resizeToMatch(source, width, height) {
  if (source.width === width && source.height === height) return source;
  const resized = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sx = Math.min(source.width - 1, Math.floor((x / width) * source.width));
      const sy = Math.min(source.height - 1, Math.floor((y / height) * source.height));
      const srcIdx = (source.width * sy + sx) << 2;
      const dstIdx = (width * y + x) << 2;
      resized.data[dstIdx] = source.data[srcIdx];
      resized.data[dstIdx + 1] = source.data[srcIdx + 1];
      resized.data[dstIdx + 2] = source.data[srcIdx + 2];
      resized.data[dstIdx + 3] = source.data[srcIdx + 3];
    }
  }
  return resized;
}

function renderReport({
  target,
  profile,
  mock,
  app,
  diff,
  mockPng,
  appOriginal,
  mismatched,
  totalPixels,
  mismatchPct,
  maxMismatchPct,
  passed,
  resampled,
  aspectRatioMismatch,
}) {
  const verdict = aspectRatioMismatch ? 'FAIL' : passed ? 'PASS' : 'FAIL';
  return `# UI fidelity comparison

| Field | Value |
| ----- | ----- |
| Target | \`${target}\` |
| Profile | \`${profile}\` |
| Verdict | **${verdict}** |
| Mock | \`${mock}\` (${mockPng.width}×${mockPng.height}) |
| App | \`${app}\` (${appOriginal.width}×${appOriginal.height}) |
| Diff | \`${diff}\` |
| Resampled | ${resampled ? 'yes' : 'no'} |
| Mismatched pixels | ${mismatched} / ${totalPixels} (${mismatchPct.toFixed(2)}%) |
| Threshold | ${maxMismatchPct.toFixed(2)}% |
${aspectRatioMismatch ? `| Aspect ratio | mock ${(mockPng.width / mockPng.height).toFixed(4)} vs app ${(appOriginal.width / appOriginal.height).toFixed(4)} — hard failure, no resample |\n` : ''}
> Pixel diff is a drift detector, not a pixel-identity assertion. Chromium and React Native
> antialias text, shadows and charts differently — see the per-screen \`threshold_note\` in
> \`scripts/mobile-ui/fidelity-targets.json\` for known, accepted differences.
`;
}

export async function compareScreenshots(options) {
  await mkdir(path.dirname(options.diff), { recursive: true });

  const mockPng = await loadPng(options.mock);
  const appOriginal = await loadPng(options.app);
  let appPng = appOriginal;
  let resampled = false;

  if (appPng.width !== mockPng.width || appPng.height !== mockPng.height) {
    const mockRatio = mockPng.width / mockPng.height;
    const appRatio = appPng.width / appPng.height;
    const aspectRatioMismatch = Math.abs(mockRatio - appRatio) / mockRatio > ASPECT_RATIO_TOLERANCE;
    if (aspectRatioMismatch) {
      const diffPng = new PNG({ width: mockPng.width, height: mockPng.height });
      await writeFile(options.diff, PNG.sync.write(diffPng));
      const report = renderReport({
        ...options,
        mockPng,
        appOriginal,
        mismatched: mockPng.width * mockPng.height,
        totalPixels: mockPng.width * mockPng.height,
        mismatchPct: 100,
        passed: false,
        resampled: false,
        aspectRatioMismatch: true,
      });
      await writeFile(options.report, report);
      console.log(
        `FAIL ${options.target} (${options.profile}): aspect ratio mismatch (mock ${mockPng.width}x${mockPng.height} vs app ${appOriginal.width}x${appOriginal.height}) — hard failure, no resample`,
      );
      return { passed: false, mismatchPct: 100, resampled: false, aspectRatioMismatch: true };
    }
    appPng = resizeToMatch(appPng, mockPng.width, mockPng.height);
    resampled = true;
  }

  const diffPng = new PNG({ width: mockPng.width, height: mockPng.height });
  const mismatched = pixelmatch(mockPng.data, appPng.data, diffPng.data, mockPng.width, mockPng.height, {
    includeAA: true,
    threshold: options.pixelThreshold,
  });
  const totalPixels = mockPng.width * mockPng.height;
  const mismatchPct = (mismatched / totalPixels) * 100;
  const passed = mismatchPct <= options.maxMismatchPct;

  await writeFile(options.diff, PNG.sync.write(diffPng));
  const report = renderReport({
    ...options,
    mockPng,
    appOriginal,
    mismatched,
    totalPixels,
    mismatchPct,
    maxMismatchPct: options.maxMismatchPct,
    passed,
    resampled,
    aspectRatioMismatch: false,
  });
  await writeFile(options.report, report);

  console.log(
    `${passed ? 'PASS' : 'FAIL'} ${options.target} (${options.profile}): ${mismatchPct.toFixed(2)}% vs ${options.maxMismatchPct.toFixed(2)}% allowed`,
  );
  return { passed, mismatchPct, resampled, aspectRatioMismatch: false };
}

function printHelp() {
  console.log(
    'Usage: node scripts/mobile-ui/compare-screenshots.mjs --mock <png> --app <png> [--target <id>] [--profile <id>] [--diff <png>] [--report <md>] [--max-mismatch-pct <n>] [--pixel-threshold <n>]',
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  (async () => {
    const options = parseArgs(process.argv);
    if (options.help) {
      printHelp();
      return;
    }
    const result = await compareScreenshots(options);
    if (!result.passed) process.exitCode = 1;
  })().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
