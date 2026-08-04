#!/usr/bin/env node
/**
 * Schema and completeness validation for `.maestro/flow-contract.json` against
 * `design/mockups/mobile/mockup-manifest.js` (implementation plan for issue #22, D1, D2, D12).
 * Mirrors `scripts/mobile-ui/fidelity-contract.mjs`'s shape — the same split this repository's
 * design-fidelity gate (#47) already established for a contract-driven suite.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadManifest } from '../mobile-ui/load-manifest.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const CONTRACT_PATH = '.maestro/flow-contract.json';
const FLOWS_DIR = '.maestro/flows';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function fail(message) {
  throw new Error(message);
}

function screenIds(manifest) {
  return new Set((manifest.screens ?? []).map((screen) => screen.screen_id));
}

/** Every screen with `mvp !== false` — the residual-coverage universe (D2, Residual verification
 * strategy). Mirrors `scripts/mobile-ui/load-manifest.mjs`'s `mvpTargets`, at screen granularity
 * rather than per-state: a flow exercises a *screen*, not one declared mockup state. */
function mvpScreenIds(manifest) {
  return new Set((manifest.screens ?? []).filter((screen) => screen.mvp !== false).map((screen) => screen.screen_id));
}

function listFlowFiles(root) {
  const dir = path.join(root, FLOWS_DIR);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.yaml'))
    .map((entry) => `flows/${entry.name}`)
    .sort();
}

function assertFixtureStates(contract) {
  const states = contract.fixture_states ?? [];
  if (states.length === 0) fail('flow-contract.json must declare at least one fixture_states entry');

  const seenIds = new Set();
  for (const state of states) {
    if (typeof state.id !== 'string' || state.id.trim() === '') {
      fail('Every fixture_states entry must have a non-empty "id"');
    }
    if (seenIds.has(state.id)) fail(`Duplicate fixture_states id "${state.id}"`);
    seenIds.add(state.id);
    if (typeof state.action_key !== 'string' || state.action_key.trim() === '') {
      fail(`fixture_states entry "${state.id}" must have a non-empty "action_key"`);
    }
  }
  return seenIds;
}

function assertFlows(contract, manifest, root) {
  const flows = contract.flows ?? [];
  if (flows.length === 0) fail('flow-contract.json must declare at least one flow');

  const declaredStateIds = assertFixtureStates(contract);
  const usedStateIds = new Set();
  const declaredFiles = new Set();
  const knownScreenIds = screenIds(manifest);
  const seenFlowIds = new Set();

  for (const flow of flows) {
    if (typeof flow.id !== 'string' || flow.id.trim() === '') {
      fail('Every flow must have a non-empty "id"');
    }
    if (seenFlowIds.has(flow.id)) fail(`Duplicate flow id "${flow.id}"`);
    seenFlowIds.add(flow.id);

    if (flow.status !== 'wired' && flow.status !== 'planned') {
      fail(`Flow "${flow.id}" has invalid status "${flow.status}" (must be "wired" or "planned")`);
    }
    if (!Number.isInteger(flow.issue)) {
      fail(`Flow "${flow.id}" must declare an integer "issue"`);
    }
    if (typeof flow.file !== 'string' || flow.file.trim() === '') {
      fail(`Flow "${flow.id}" must have a non-empty "file"`);
    }
    if (declaredFiles.has(flow.file)) fail(`Duplicate flow file "${flow.file}"`);
    declaredFiles.add(flow.file);

    if (!declaredStateIds.has(flow.fixture_state)) {
      fail(`Flow "${flow.id}" references undeclared fixture state "${flow.fixture_state}"`);
    }
    usedStateIds.add(flow.fixture_state);

    if (!Array.isArray(flow.screens) || flow.screens.length === 0) {
      fail(`Flow "${flow.id}" must declare a non-empty "screens" array`);
    }
    for (const screenId of flow.screens) {
      if (!knownScreenIds.has(screenId)) {
        fail(`Flow "${flow.id}" references unknown screen_id "${screenId}"`);
      }
    }

    if (flow.status === 'wired') {
      if (!fs.existsSync(path.join(root, FLOWS_DIR, path.basename(flow.file)))) {
        fail(`Flow "${flow.id}" is "wired" but its file "${flow.file}" does not exist`);
      }
    }
  }

  const undeclaredStateUse = [...declaredStateIds].filter((id) => !usedStateIds.has(id));
  if (undeclaredStateUse.length > 0) {
    fail(`Declared fixture state(s) no flow uses: ${undeclaredStateUse.sort().join(', ')}`);
  }

  const filesOnDisk = new Set(listFlowFiles(root));
  const wiredFiles = new Set(
    flows.filter((flow) => flow.status === 'wired').map((flow) => flow.file),
  );
  const orphanFiles = [...filesOnDisk].filter((file) => !wiredFiles.has(file));
  if (orphanFiles.length > 0) {
    fail(`Flow file(s) on disk but not declared as "wired" in the contract: ${orphanFiles.sort().join(', ')}`);
  }
  const missingFiles = [...wiredFiles].filter((file) => !filesOnDisk.has(file));
  if (missingFiles.length > 0) {
    fail(`Contract declares "wired" file(s) missing from disk: ${missingFiles.sort().join(', ')}`);
  }

  return flows;
}

function assertResidualCoverage(contract, manifest, flows) {
  const universe = mvpScreenIds(manifest);
  const covered = new Set(flows.flatMap((flow) => flow.screens));
  const planned = new Set(
    flows.filter((flow) => flow.status === 'planned').flatMap((flow) => flow.screens),
  );

  const knownScreenIds = screenIds(manifest);
  const excluded = new Set();
  for (const exclusion of contract.exclusions ?? []) {
    if (!knownScreenIds.has(exclusion.screen_id)) {
      fail(`exclusions entry references unknown screen_id "${exclusion.screen_id}"`);
    }
    if (typeof exclusion.reason !== 'string' || exclusion.reason.trim() === '') {
      fail(`exclusions entry for "${exclusion.screen_id}" must have a non-empty reason`);
    }
    excluded.add(exclusion.screen_id);
  }

  const coveredAndExcluded = [...covered].filter((screenId) => excluded.has(screenId));
  if (coveredAndExcluded.length > 0) {
    fail(`Screen(s) both covered by a wired flow and excluded: ${coveredAndExcluded.sort().join(', ')}`);
  }

  const orphans = [...universe].filter(
    (screenId) => !covered.has(screenId) && !planned.has(screenId) && !excluded.has(screenId),
  );
  if (orphans.length > 0) {
    fail(
      `MVP screen(s) neither covered by a wired flow, named in a planned flow, nor excluded: ${orphans
        .sort()
        .join(', ')}`,
    );
  }
}

function assertCredentialFixtures(contract) {
  const fixtures = contract.credential_fixtures;
  if (fixtures == null || typeof fixtures !== 'object') {
    fail('flow-contract.json must declare "credential_fixtures"');
  }
  if (typeof fixtures.rut !== 'string' || fixtures.rut.trim() === '') {
    fail('credential_fixtures.rut must be a non-empty string');
  }
  if (typeof fixtures.password !== 'string' || fixtures.password.trim() === '') {
    fail('credential_fixtures.password must be a non-empty string');
  }
}

function assertForbiddenHosts(contract) {
  if (!Array.isArray(contract.forbidden_hosts) || contract.forbidden_hosts.length === 0) {
    fail('flow-contract.json must declare a non-empty "forbidden_hosts" array');
  }
}

function assertDataSelectors(contract, declaredStateIds) {
  for (const selector of contract.data_selectors ?? []) {
    if (typeof selector.text !== 'string' || selector.text.trim() === '') {
      fail('Every data_selectors entry must have a non-empty "text"');
    }
    if (!declaredStateIds.has(selector.fixture_state)) {
      fail(`data_selectors entry "${selector.text}" references undeclared fixture state "${selector.fixture_state}"`);
    }
  }
}

/**
 * @param {object} [options]
 * @param {string} [options.root]
 * @param {object} [options.contract]
 * @param {object} [options.manifest] — pass a pre-loaded manifest object to test against a
 *   synthetic universe; defaults to `loadManifest(root)` for the real manifest.
 */
export function validateFlowContract({ root = REPO_ROOT, contract, manifest } = {}) {
  const resolvedContract = contract ?? readJson(path.join(root, CONTRACT_PATH));
  const resolvedManifest = manifest ?? loadManifest(root);

  if (resolvedContract.schema_version !== 1) {
    fail(`Unsupported flow contract schema_version "${resolvedContract.schema_version}"`);
  }
  if (typeof resolvedContract.app_id !== 'string' || resolvedContract.app_id.trim() === '') {
    fail('flow-contract.json must declare a non-empty "app_id"');
  }

  assertCredentialFixtures(resolvedContract);
  assertForbiddenHosts(resolvedContract);

  const declaredStateIds = assertFixtureStates(resolvedContract);
  assertDataSelectors(resolvedContract, declaredStateIds);

  const flows = assertFlows(resolvedContract, resolvedManifest, root);
  assertResidualCoverage(resolvedContract, resolvedManifest, flows);

  const wiredCount = flows.filter((flow) => flow.status === 'wired').length;
  return {
    contract: resolvedContract,
    manifest: resolvedManifest,
    flows,
    root,
    wiredCount,
    plannedCount: flows.length - wiredCount,
  };
}

function parseCli(argv) {
  const args = new Set(argv.slice(2));
  const allowed = new Set(['--help', '-h']);
  for (const arg of args) if (!allowed.has(arg)) fail(`Unknown argument: ${arg}`);
  if (args.has('--help') || args.has('-h')) {
    console.log('Usage: node scripts/e2e/flow-contract.mjs');
    return null;
  }
  return {};
}

function printSummaryTable(result) {
  console.log(`Flow contract valid: ${result.flows.length} flows (${result.wiredCount} wired, ${result.plannedCount} planned).`);
  console.log('');
  console.log('id | status | fixture_state | screens | issue');
  console.log('-- | ------ | ------------- | ------- | -----');
  for (const flow of result.flows) {
    console.log(`${flow.id} | ${flow.status} | ${flow.fixture_state} | ${flow.screens.join(', ')} | #${flow.issue}`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = parseCli(process.argv);
    if (options) {
      const result = validateFlowContract({});
      printSummaryTable(result);
    }
  } catch (error) {
    console.error(`Flow contract invalid: ${error.message}`);
    process.exit(1);
  }
}
