#!/usr/bin/env node
// Verifies that this repository's node_modules tree is actually hoisted, not just
// declared as hoisted somewhere. Node 22 built-ins only, zero npm dependencies — this
// script must run even when the install is broken, which is exactly when it is needed
// (implementation plan for #35, Decision 2).
//
// Three assertions, each printing one line and a distinct, actionable FAIL message:
//   A — pnpm actually resolves nodeLinker to "hoisted" (pnpm 11 reads this from
//       pnpm-workspace.yaml, never from .npmrc).
//   B — the installed tree records itself as hoisted in node_modules/.modules.yaml.
//   C — the modules Metro needs at the workspace root are real directories, not symlinks.

import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const modulesDir = path.join(repoRoot, 'node_modules');
const modulesYamlPath = path.join(modulesDir, '.modules.yaml');

// Metro's resolver is pointed at <root>/node_modules with disableHierarchicalLookup, so
// these must be real directories at the root. @expo/metro-runtime is the transitive
// dependency named in the original resolver error and is only ever hoisted to the root
// under the hoisted linker. react-native is a direct dependency of @finanzas/mobile, so
// under the isolated linker it lives in apps/mobile/node_modules and is absent here.
const REQUIRED_ROOT_MODULES = ['@expo/metro-runtime', 'react-native'];

let failed = false;

function fail(message) {
  failed = true;
  console.error(`FAIL: ${message}`);
}

function ok(message) {
  console.log(`ok: ${message}`);
}

// --- Assertion A: the declaration is where pnpm actually reads it. ---
function checkAssertionA() {
  let output;
  try {
    output = execFileSync('pnpm', ['config', 'get', 'nodeLinker'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
  } catch (error) {
    fail(
      `could not run "pnpm config get nodeLinker" (${error.message}). ` +
        'Confirm pnpm is installed and resolvable from the repository root.',
    );
    return;
  }
  const value = output.trim();
  if (value !== 'hoisted') {
    fail(
      `pnpm config get nodeLinker printed "${value}", expected "hoisted". ` +
        'Add `nodeLinker: hoisted` to pnpm-workspace.yaml (pnpm 11 does not read ' +
        'node-linker from .npmrc) and re-run `pnpm install`.',
    );
    return;
  }
  ok('pnpm resolves nodeLinker to "hoisted" (pnpm-workspace.yaml)');
}

// --- Assertion B: the installed tree was linked hoisted. ---
function checkAssertionB() {
  if (!existsSync(modulesYamlPath)) {
    fail(
      `${path.relative(repoRoot, modulesYamlPath)} is missing. ` +
        'Run `pnpm install` to produce it.',
    );
    return;
  }
  let parsed;
  try {
    const raw = readFileSync(modulesYamlPath, 'utf8');
    parsed = JSON.parse(raw);
  } catch (error) {
    fail(
      `${path.relative(repoRoot, modulesYamlPath)} could not be parsed as JSON (${error.message}). ` +
        'This script expects pnpm 11, which writes .modules.yaml as JSON. ' +
        'If pnpm changed this format, check-node-linker-layout.mjs needs an update.',
    );
    return;
  }
  if (parsed.nodeLinker !== 'hoisted') {
    fail(
      `${path.relative(repoRoot, modulesYamlPath)} records nodeLinker "${parsed.nodeLinker}", ` +
        'expected "hoisted". Run `pnpm install` (plain, no --node-linker flag) to relink.',
    );
    return;
  }
  ok('node_modules/.modules.yaml records nodeLinker "hoisted"');
}

// --- Assertion C: the modules Metro needs are really at the root. ---
function checkAssertionC() {
  for (const name of REQUIRED_ROOT_MODULES) {
    const modulePath = path.join(modulesDir, name);
    if (!existsSync(modulePath)) {
      fail(
        `${path.join('node_modules', name)} does not exist at the workspace root. ` +
          'Run `pnpm install` (plain, no --node-linker flag).',
      );
      continue;
    }
    let stats;
    try {
      stats = lstatSync(modulePath);
    } catch (error) {
      fail(`could not stat ${path.join('node_modules', name)} (${error.message}).`);
      continue;
    }
    if (stats.isSymbolicLink()) {
      fail(
        `${path.join('node_modules', name)} is a symlink, not a real directory. ` +
          'The tree is isolated, not hoisted. Run `pnpm install` (plain, no ' +
          '--node-linker flag).',
      );
      continue;
    }
    if (!stats.isDirectory()) {
      fail(`${path.join('node_modules', name)} exists but is not a directory.`);
      continue;
    }
    const packageJsonPath = path.join(modulePath, 'package.json');
    if (!existsSync(packageJsonPath)) {
      fail(
        `${path.join('node_modules', name)} exists but has no package.json. ` +
          'Run `pnpm install` (plain, no --node-linker flag) to repair the tree.',
      );
      continue;
    }
    ok(`${path.join('node_modules', name)} is a real directory with a package.json`);
  }
}

checkAssertionA();
checkAssertionB();
checkAssertionC();

if (failed) {
  console.error(
    '\nnode_modules layout check FAILED. See the FAIL lines above for what to fix.',
  );
  process.exitCode = 1;
} else {
  console.log('\nnode_modules layout check passed: the tree is hoisted.');
}
