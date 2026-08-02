#!/usr/bin/env node
/**
 * Orchestrates one or more fidelity targets: capture the mockup, capture the running app on
 * the fidelity simulator, compare, and aggregate a summary (implementation plan Layer-by-Layer
 * § `run-fidelity.mjs`).
 *
 * Usage:
 *   node scripts/mobile-ui/run-fidelity.mjs --screen home --state pending
 *   node scripts/mobile-ui/run-fidelity.mjs --issue 12
 *   node scripts/mobile-ui/run-fidelity.mjs --all --dry-run
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compareScreenshots } from './compare-screenshots.mjs';
import { targetId, validateFidelityContract } from './fidelity-contract.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const DEFAULT_OUTPUT_DIR = path.join(REPO_ROOT, '.tmp/ui-fidelity');

function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
  return value;
}

export function parseArgs(argv) {
  const options = { all: false, dryRun: false, outputDir: DEFAULT_OUTPUT_DIR };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--screen') options.screen = requireValue(argv, index++, arg);
    else if (arg === '--state') options.state = requireValue(argv, index++, arg);
    else if (arg === '--profile') options.profile = requireValue(argv, index++, arg);
    else if (arg === '--issue') options.issue = Number(requireValue(argv, index++, arg));
    else if (arg === '--output-dir') options.outputDir = path.resolve(requireValue(argv, index++, arg));
    else if (arg === '--summary') options.summary = requireValue(argv, index++, arg);
    else if (arg === '--app-from') options.appFrom = requireValue(argv, index++, arg);
    else if (arg === '--all') options.all = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (options.issue != null && !Number.isInteger(options.issue)) {
    throw new Error('--issue must be an integer');
  }
  if (options.state && !options.screen) throw new Error('--state requires --screen');
  return options;
}

export function resolveTargets(validation, options) {
  const defaultProfile = validation.contract.default_profile;
  const profile = options.profile ?? defaultProfile;
  if (!validation.profiles.has(profile)) {
    throw new Error(`Unknown profile "${profile}". Valid profiles: ${[...validation.profiles].join(', ')}`);
  }
  const selectors = [options.all, options.issue != null, options.screen != null].filter(Boolean);
  if (selectors.length !== 1) {
    throw new Error('Select exactly one of --all, --issue <number>, or --screen <id>');
  }
  let targets = validation.targets;
  if (options.issue != null) targets = targets.filter((target) => target.issue === options.issue);
  if (options.screen != null) {
    targets = targets.filter((target) => target.screenId === options.screen);
    if (options.state != null) {
      targets = targets.filter((target) => target.stateId === options.state);
    } else if (targets.length > 1) {
      throw new Error(
        `Screen "${options.screen}" has multiple states; provide --state (${targets.map((target) => target.stateId).join(', ')})`,
      );
    }
  }
  if (targets.length === 0) throw new Error('No fidelity targets matched the selection');
  return targets.map((target) => ({
    ...target,
    mapping: validation.mappings.get(target.id),
    profile,
  }));
}

export function artifactPaths(outputDir, target, profile) {
  const suffix = `${target.id}-${profile}`;
  return {
    mock: path.join(outputDir, `mock-${suffix}.png`),
    app: path.join(outputDir, `app-${suffix}.png`),
    diff: path.join(outputDir, `diff-${suffix}.png`),
    report: path.join(outputDir, `report-${suffix}.md`),
  };
}

async function spawnProcess(command, args) {
  const { spawn } = await import('node:child_process');
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: REPO_ROOT, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code, signal) => resolve({ code, signal }));
  });
}

function runNode(scriptArgs) {
  return spawnProcess(process.execPath, scriptArgs);
}

function runBash(scriptArgs) {
  return spawnProcess('bash', scriptArgs);
}

async function runTarget(target, outputDir) {
  if (target.mapping.status === 'planned') {
    throw new Error(
      `Target "${target.id}" is still planned (owned by issue #${target.issue}); wire it before running the gate.`,
    );
  }
  const artifacts = artifactPaths(outputDir, target, target.profile);
  await mkdir(outputDir, { recursive: true });

  const mockArgs = [
    'scripts/mobile-ui/capture-mockup.mjs',
    '--screen',
    target.screenId,
    '--profile',
    target.profile,
    '--output',
    artifacts.mock,
  ];
  if (target.stateId) mockArgs.push('--state', target.stateId);
  const mockResult = await runNode(mockArgs);
  if (mockResult.code !== 0) throw new Error('Mockup capture failed');

  if (target.appFrom) {
    await import('node:fs/promises').then((fs) => fs.copyFile(target.appFrom, artifacts.app));
  } else {
    const captureResult = await runBash([
      'scripts/mobile-ui/capture-simulator.sh',
      '--profile',
      target.profile,
      '--deep-link',
      target.mapping.deep_link,
      '--output',
      artifacts.app,
    ]);
    if (captureResult.code !== 0) throw new Error('Simulator capture failed');
  }

  const contract = target.contract;
  const maxMismatchPct = target.mapping.max_mismatch_pct ?? contract.defaults.max_mismatch_pct;
  const pixelThreshold = contract.defaults.pixel_threshold;
  const compareResult = await compareScreenshots({
    mock: artifacts.mock,
    app: artifacts.app,
    diff: artifacts.diff,
    report: artifacts.report,
    target: target.id,
    profile: target.profile,
    maxMismatchPct,
    pixelThreshold,
  });
  return { ...artifacts, ...compareResult };
}

function printHelp() {
  console.log(`Usage:
  node scripts/mobile-ui/run-fidelity.mjs --screen <id> [--state <id>] [--profile <id>] [--dry-run]
  node scripts/mobile-ui/run-fidelity.mjs --issue <number> [--profile <id>] [--dry-run]
  node scripts/mobile-ui/run-fidelity.mjs --all [--profile <id>] [--dry-run]`);
}

export async function main(argv = process.argv) {
  const options = parseArgs(argv);
  if (options.help) {
    printHelp();
    return;
  }
  const validation = validateFidelityContract({ root: REPO_ROOT });
  const resolved = resolveTargets(validation, options);
  if (options.appFrom && resolved.length > 1) {
    throw new Error('--app-from applies to a single target; narrow the selection with --screen/--state');
  }
  const targets = resolved.map((target) => ({
    ...target,
    contract: validation.contract,
    appFrom: options.appFrom,
  }));

  const rows = [];
  let anyFailed = false;
  for (const target of targets) {
    console.log(
      `${options.dryRun ? '[dry-run] ' : ''}${target.id} | profile=${target.profile} | fixture=${target.mapping.fixture} | status=${target.mapping.status} | issue=#${target.issue}`,
    );
    if (options.dryRun) {
      const artifacts = artifactPaths(options.outputDir, target, target.profile);
      console.log(`  artifacts=${Object.values(artifacts).join(', ')}`);
      rows.push({ id: target.id, status: 'dry-run', mismatchPct: null });
      continue;
    }
    try {
      const result = await runTarget(target, options.outputDir);
      rows.push({ id: target.id, status: result.passed ? 'PASS' : 'FAIL', mismatchPct: result.mismatchPct });
      if (!result.passed) anyFailed = true;
    } catch (error) {
      rows.push({ id: target.id, status: 'ERROR', mismatchPct: null, error: error.message });
      anyFailed = true;
      console.error(`Fidelity target ${targetId(target.screenId, target.stateId)} failed: ${error.message}`);
    }
  }

  if (options.summary && !options.dryRun) {
    const lines = [
      '# Fidelity run summary',
      '',
      '| Target | Status | Mismatch |',
      '| --- | --- | --- |',
      ...rows.map(
        (row) =>
          `| \`${row.id}\` | ${row.status} | ${row.mismatchPct != null ? `${row.mismatchPct.toFixed(2)}%` : row.error ?? '—'} |`,
      ),
    ];
    await writeFile(options.summary, `${lines.join('\n')}\n`);
  }

  if (anyFailed) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
