import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { PNG } from 'pngjs';
import { compareScreenshots } from './compare-screenshots.mjs';

function writePng(filePath, width, height, fill) {
  const png = new PNG({ width, height });
  for (let i = 0; i < width * height; i += 1) {
    const [r, g, b, a] = fill(i % width, Math.floor(i / width));
    png.data[i * 4] = r;
    png.data[i * 4 + 1] = g;
    png.data[i * 4 + 2] = b;
    png.data[i * 4 + 3] = a;
  }
  fs.writeFileSync(filePath, PNG.sync.write(png));
}

function solid(r, g, b) {
  return () => [r, g, b, 255];
}

function withRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'finanzas-fidelity-compare-'));
  t.after(() => fs.rmSync(root, { force: true, recursive: true }));
  return root;
}

function baseOptions(root, overrides = {}) {
  return {
    mock: path.join(root, 'mock.png'),
    app: path.join(root, 'app.png'),
    diff: path.join(root, 'diff.png'),
    report: path.join(root, 'report.md'),
    target: 'test--target',
    profile: 'test-profile',
    maxMismatchPct: 3.0,
    pixelThreshold: 0.1,
    ...overrides,
  };
}

// C1: Identical images.
test('C1: identical images verdict PASS at 0.00%', async (t) => {
  const root = withRoot(t);
  writePng(path.join(root, 'mock.png'), 20, 20, solid(255, 0, 0));
  writePng(path.join(root, 'app.png'), 20, 20, solid(255, 0, 0));
  const result = await compareScreenshots(baseOptions(root));
  assert.equal(result.passed, true);
  assert.equal(result.mismatchPct, 0);
});

// C2: Images differing by a handful of pixels, threshold 3% -> PASS.
test('C2: a handful of differing pixels passes at a 3% threshold', async (t) => {
  const root = withRoot(t);
  writePng(path.join(root, 'mock.png'), 20, 20, solid(255, 0, 0));
  writePng(path.join(root, 'app.png'), 20, 20, (x, y) => (x === 0 && y === 0 ? [0, 255, 0, 255] : [255, 0, 0, 255]));
  const result = await compareScreenshots(baseOptions(root));
  assert.equal(result.passed, true);
  assert.ok(result.mismatchPct < 3.0);
});

// C3: Images differing over a large block, threshold 3% -> FAIL, message quotes both percentages.
test('C3: a large differing block fails and quotes both percentages', async (t) => {
  const root = withRoot(t);
  writePng(path.join(root, 'mock.png'), 20, 20, solid(255, 0, 0));
  writePng(path.join(root, 'app.png'), 20, 20, solid(0, 255, 0));
  const originalLog = console.log;
  const lines = [];
  console.log = (...values) => lines.push(values.join(' '));
  let result;
  try {
    result = await compareScreenshots(baseOptions(root));
  } finally {
    console.log = originalLog;
  }
  assert.equal(result.passed, false);
  const logged = lines.join('\n');
  assert.match(logged, /100\.00% vs 3\.00% allowed/);
});

// C4: Same aspect ratio, different pixel size -> resamples, resampled: true, comparison proceeds.
test('C4: same aspect ratio at a different size resamples and proceeds', async (t) => {
  const root = withRoot(t);
  writePng(path.join(root, 'mock.png'), 40, 40, solid(10, 20, 30));
  writePng(path.join(root, 'app.png'), 20, 20, solid(10, 20, 30));
  const result = await compareScreenshots(baseOptions(root));
  assert.equal(result.resampled, true);
  assert.equal(result.aspectRatioMismatch, false);
  assert.equal(result.passed, true);
});

// C5: Different aspect ratio -> hard FAIL naming both sizes; no resample.
test('C5: a different aspect ratio hard-fails without resampling', async (t) => {
  const root = withRoot(t);
  writePng(path.join(root, 'mock.png'), 40, 40, solid(10, 20, 30));
  writePng(path.join(root, 'app.png'), 40, 80, solid(10, 20, 30));
  const options = baseOptions(root);
  const result = await compareScreenshots(options);
  assert.equal(result.passed, false);
  assert.equal(result.aspectRatioMismatch, true);
  assert.equal(result.resampled, false);
  const report = fs.readFileSync(options.report, 'utf8');
  assert.match(report, /40×40/);
  assert.match(report, /40×80/);
});

// C6: Any run — the report file exists and contains the target id, profile, verdict, mismatch,
// and threshold.
test('C6: the report contains target, profile, verdict, mismatch, and threshold', async (t) => {
  const root = withRoot(t);
  writePng(path.join(root, 'mock.png'), 20, 20, solid(255, 0, 0));
  writePng(path.join(root, 'app.png'), 20, 20, solid(255, 0, 0));
  const options = baseOptions(root, { target: 'home--pending', profile: 'iphone-393x852' });
  await compareScreenshots(options);
  const report = fs.readFileSync(options.report, 'utf8');
  assert.match(report, /home--pending/);
  assert.match(report, /iphone-393x852/);
  assert.match(report, /PASS/);
  assert.match(report, /0\.00%/);
  assert.match(report, /3\.00%/);
});

test('exits 1 via CLI on a failing comparison, 0 on a passing one', async (t) => {
  const root = withRoot(t);
  writePng(path.join(root, 'mock.png'), 20, 20, solid(255, 0, 0));
  writePng(path.join(root, 'app-same.png'), 20, 20, solid(255, 0, 0));
  writePng(path.join(root, 'app-different.png'), 20, 20, solid(0, 255, 0));

  const { execFileSync } = await import('node:child_process');
  const scriptPath = new URL('./compare-screenshots.mjs', import.meta.url).pathname;

  assert.doesNotThrow(() =>
    execFileSync(process.execPath, [
      scriptPath,
      '--mock',
      path.join(root, 'mock.png'),
      '--app',
      path.join(root, 'app-same.png'),
      '--diff',
      path.join(root, 'diff-pass.png'),
      '--report',
      path.join(root, 'report-pass.md'),
    ]),
  );

  assert.throws(() =>
    execFileSync(process.execPath, [
      scriptPath,
      '--mock',
      path.join(root, 'mock.png'),
      '--app',
      path.join(root, 'app-different.png'),
      '--diff',
      path.join(root, 'diff-fail.png'),
      '--report',
      path.join(root, 'report-fail.md'),
    ]),
  );
  t.after(() => fs.rmSync(root, { force: true, recursive: true }));
});
