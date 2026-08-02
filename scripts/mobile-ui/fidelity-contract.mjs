#!/usr/bin/env node
/**
 * Schema and completeness validation for `scripts/mobile-ui/fidelity-targets.json` against
 * `design/mockups/mobile/mockup-manifest.js` (implementation plan Decision 1, Decision 2,
 * Decision 4).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadManifest, mvpTargets } from './load-manifest.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const CONTRACT_PATH = 'scripts/mobile-ui/fidelity-targets.json';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function fail(message) {
  throw new Error(message);
}

function screenIndex(manifest) {
  return new Map((manifest.screens ?? []).map((screen) => [screen.screen_id, screen]));
}

function stateIds(screen) {
  return (screen.states ?? []).map((state) => state.state_id);
}

function mvpStateIds(screen) {
  return (screen.states ?? [])
    .filter((state) => state.mvp !== false)
    .map((state) => state.state_id);
}

function initialStateId(screen) {
  const states = screen.states ?? [];
  if (states.length === 0) return null;
  const initialStates = states.filter((state) => state.initial);
  if (initialStates.length !== 1) {
    fail(`Screen "${screen.screen_id}" must have exactly one initial state`);
  }
  return initialStates[0].state_id;
}

/** `screenId` alone for a stateless target, `screenId--stateId` otherwise (Decision 1). */
export function targetId(screenId, stateId = null) {
  if (screenId.includes('--') || stateId?.includes('--')) {
    fail('Screen and state ids cannot contain the reserved "--" delimiter');
  }
  return stateId ? `${screenId}--${stateId}` : screenId;
}

/**
 * Expands `contract.coverage_sets` into concrete `{ id, issue, screenId, stateId }` targets.
 * `states: "all"` and `states: "initial"` resolve against the manifest's own MVP states only —
 * naming an `mvp: false` screen or state explicitly is a hard failure (parser-risk tests 2, 3).
 */
export function expandCoverage(contract, manifest) {
  const screens = screenIndex(manifest);
  const targets = [];
  const seen = new Set();

  for (const coverageSet of contract.coverage_sets ?? []) {
    if (!Number.isInteger(coverageSet.issue)) {
      fail('Every coverage set must declare an integer issue');
    }
    for (const requested of coverageSet.targets ?? []) {
      const screen = screens.get(requested.screen_id);
      if (!screen) {
        fail(`Unknown screen "${requested.screen_id}" in coverage set #${coverageSet.issue}`);
      }
      if (screen.mvp === false) {
        fail(
          `Coverage set #${coverageSet.issue} names mvp:false screen "${requested.screen_id}"`,
        );
      }
      const knownStates = stateIds(screen);
      const knownMvpStates = mvpStateIds(screen);
      let requestedStates;
      if (requested.states === 'all') {
        requestedStates = knownMvpStates.length > 0 ? knownMvpStates : [null];
      } else if (requested.states === 'initial') {
        const initial = initialStateId(screen);
        if (initial != null && !knownMvpStates.includes(initial)) {
          fail(`Coverage set #${coverageSet.issue} names mvp:false state "${initial}"`);
        }
        requestedStates = [initial];
      } else if (Array.isArray(requested.states) && requested.states.length > 0) {
        requestedStates = requested.states;
      } else {
        fail(`Invalid states declaration for screen "${requested.screen_id}"`);
      }

      for (const stateId of requestedStates) {
        if (stateId != null && !knownStates.includes(stateId)) {
          fail(
            `Unknown state "${stateId}" for screen "${requested.screen_id}" in coverage set #${coverageSet.issue}. Valid states: ${knownStates.join(', ')}`,
          );
        }
        if (stateId != null && !knownMvpStates.includes(stateId)) {
          fail(
            `Coverage set #${coverageSet.issue} names mvp:false state "${requested.screen_id}--${stateId}"`,
          );
        }
        const id = targetId(requested.screen_id, stateId);
        if (seen.has(id)) fail(`Duplicate coverage target "${id}"`);
        seen.add(id);
        targets.push({ id, issue: coverageSet.issue, screenId: requested.screen_id, stateId });
      }
    }
  }
  return targets;
}

function assertExclusions(contract, manifest, targetIds) {
  const screens = screenIndex(manifest);
  for (const exclusion of contract.exclusions ?? []) {
    const screen = screens.get(exclusion.screen_id);
    if (!screen) fail(`Unknown excluded screen "${exclusion.screen_id}"`);
    if (typeof exclusion.reason !== 'string' || exclusion.reason.trim() === '') {
      fail(`Exclusion for "${exclusion.screen_id}" must have a non-empty reason`);
    }
    if (exclusion.states === null) {
      const id = targetId(exclusion.screen_id, null);
      if (targetIds.has(id) === false && (screen.states ?? []).length > 0) {
        // Whole-screen exclusion of a screen that does carry states: nothing further to check
        // here — completeness is verified target-by-target below.
      }
      continue;
    }
    if (!Array.isArray(exclusion.states) || exclusion.states.length === 0) {
      fail(`Exclusion for "${exclusion.screen_id}" must set "states" to null or a non-empty array`);
    }
    for (const stateId of exclusion.states) {
      if (!stateIds(screen).includes(stateId)) {
        fail(
          `Unknown excluded state "${stateId}" for screen "${exclusion.screen_id}". Valid states: ${stateIds(screen).join(', ')}`,
        );
      }
    }
  }
}

function excludedTargetIds(contract) {
  const excluded = new Set();
  for (const exclusion of contract.exclusions ?? []) {
    if (exclusion.states === null) {
      excluded.add(targetId(exclusion.screen_id, null));
    } else {
      for (const stateId of exclusion.states ?? []) {
        excluded.add(targetId(exclusion.screen_id, stateId));
      }
    }
  }
  return excluded;
}

function assertMappingShape({ mapping, fixtures, profiles, defaults, root }) {
  const id = targetId(mapping.screen_id, mapping.state_id ?? null);
  if (typeof mapping.fixture !== 'string' || mapping.fixture.trim() === '') {
    fail(`Mapping "${id}" has an empty fixture`);
  }
  if (!fixtures.has(mapping.fixture)) {
    fail(`Mapping "${id}" references unknown fixture "${mapping.fixture}"`);
  }
  if (mapping.profile != null && !profiles.has(mapping.profile)) {
    fail(
      `Mapping "${id}" references unknown profile "${mapping.profile}". Valid profiles: ${[...profiles].join(', ')}`,
    );
  }

  if (mapping.status !== 'planned' && mapping.status !== 'wired') {
    fail(`Mapping "${id}" has invalid status "${mapping.status}" (must be "planned" or "wired")`);
  }

  const wiredFields = ['app_file', 'deep_link', 'ready_test_id'];
  if (mapping.status === 'planned') {
    for (const field of wiredFields) {
      if (mapping[field] != null) {
        fail(`Mapping "${id}" is "planned" and must not carry "${field}"`);
      }
    }
  } else {
    for (const field of wiredFields) {
      if (typeof mapping[field] !== 'string' || mapping[field].trim() === '') {
        fail(`Mapping "${id}" is "wired" and is missing "${field}"`);
      }
    }
    if (!fs.existsSync(path.join(root, mapping.app_file))) {
      fail(`Mapping "${id}" references missing app file "${mapping.app_file}"`);
    }
    const source = fs.readFileSync(path.join(root, mapping.app_file), 'utf8');
    // Accept either the literal selector string, or the canonical `fidelityTestId(screenId)`
    // call (Decision 9) with a matching screen_id — screens are expected to compute the
    // selector from the shared helper rather than hand-typing it, and the call expression
    // still statically proves the correct id is wired.
    const helperCallPattern = new RegExp(
      `fidelityTestId\\(\\s*['"\`]${mapping.screen_id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]\\s*\\)`,
    );
    if (!source.includes(mapping.ready_test_id) && !helperCallPattern.test(source)) {
      fail(`Mapping "${id}" selector "${mapping.ready_test_id}" is absent from ${mapping.app_file}`);
    }
    let deepLink;
    try {
      deepLink = new URL(mapping.deep_link);
    } catch {
      fail(`Mapping "${id}" has an invalid deep_link URL`);
    }
    const expectedState = mapping.state_id ?? null;
    const actualState = deepLink.searchParams.get('fidelityState');
    if (
      deepLink.protocol !== 'finanzas:' ||
      deepLink.searchParams.get('fidelity') !== '1' ||
      deepLink.searchParams.get('fidelityScreen') !== mapping.screen_id ||
      (expectedState === null ? actualState !== null : actualState !== expectedState)
    ) {
      fail(`Mapping "${id}" deep_link preview parameters do not match its target`);
    }
  }

  if (mapping.max_mismatch_pct != null) {
    const value = mapping.max_mismatch_pct;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 100) {
      fail(`Mapping "${id}" has an invalid max_mismatch_pct "${value}"`);
    }
    if (value > defaults.max_mismatch_pct) {
      if (typeof mapping.threshold_note !== 'string' || mapping.threshold_note.trim() === '') {
        fail(
          `Mapping "${id}" raises max_mismatch_pct above the default and must carry a threshold_note`,
        );
      }
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
export function validateFidelityContract({ root = REPO_ROOT, contract, manifest } = {}) {
  const resolvedContract = contract ?? readJson(path.join(root, CONTRACT_PATH));
  const resolvedManifest = manifest ?? loadManifest(root);

  if (resolvedContract.schema_version !== 1) {
    fail(`Unsupported fidelity contract schema_version "${resolvedContract.schema_version}"`);
  }

  const profiles = new Set(Object.keys(resolvedContract.profiles ?? {}));
  if (profiles.size === 0) fail('Fidelity contract must define at least one profile');
  for (const [profileId, profile] of Object.entries(resolvedContract.profiles ?? {})) {
    if (
      !Number.isInteger(profile.width) ||
      profile.width <= 0 ||
      !Number.isInteger(profile.height) ||
      profile.height <= 0
    ) {
      fail(`Profile "${profileId}" must define positive integer width and height`);
    }
  }
  if (!profiles.has(resolvedContract.default_profile)) {
    fail(`Unknown default_profile "${resolvedContract.default_profile}"`);
  }

  const fixtures = new Set(Object.keys(resolvedContract.fixtures ?? {}));
  if (fixtures.size === 0) fail('Fidelity contract must define at least one fixture');

  const defaults = resolvedContract.defaults ?? {};
  if (
    typeof defaults.max_mismatch_pct !== 'number' ||
    !Number.isFinite(defaults.max_mismatch_pct) ||
    defaults.max_mismatch_pct <= 0
  ) {
    fail('Fidelity contract defaults.max_mismatch_pct must be a positive finite number');
  }

  // Decision 1: the mvp-true universe must equal coverage ∪ (exclusions ∩ universe), with an
  // empty intersection between coverage and exclusions.
  const universe = mvpTargets(resolvedManifest);
  const universeIds = new Set(universe.map((target) => targetId(target.screenId, target.stateId)));
  const targets = expandCoverage(resolvedContract, resolvedManifest);
  const targetIds = new Set(targets.map((target) => target.id));

  assertExclusions(resolvedContract, resolvedManifest, targetIds);
  const excluded = excludedTargetIds(resolvedContract);

  for (const id of targetIds) {
    if (excluded.has(id)) {
      fail(`Target "${id}" is both covered and excluded`);
    }
  }
  const orphans = [...universeIds].filter((id) => !targetIds.has(id) && !excluded.has(id));
  if (orphans.length > 0) {
    fail(`Manifest target(s) not covered and not excluded: ${orphans.sort().join(', ')}`);
  }

  const mappings = new Map();
  for (const mapping of resolvedContract.mappings ?? []) {
    const id = targetId(mapping.screen_id, mapping.state_id ?? null);
    if (mappings.has(id)) fail(`Duplicate mapping target "${id}"`);
    assertMappingShape({ mapping, fixtures, profiles, defaults, root });
    mappings.set(id, mapping);
  }
  for (const id of targetIds) {
    if (!mappings.has(id)) fail(`Missing mapping for coverage target "${id}"`);
  }
  for (const id of mappings.keys()) {
    if (!targetIds.has(id)) fail(`Mapping "${id}" is stale: no coverage target requests it`);
  }

  const screensCovered = new Set(targets.map((target) => target.screenId));
  const wiredCount = [...mappings.values()].filter((mapping) => mapping.status === 'wired').length;

  return {
    contract: resolvedContract,
    manifest: resolvedManifest,
    mappings,
    profiles,
    root,
    screens: screensCovered,
    targets,
    wiredCount,
  };
}

function parseCli(argv) {
  const args = new Set(argv.slice(2));
  const allowed = new Set(['--check-docs', '--help', '-h']);
  for (const arg of args) if (!allowed.has(arg)) fail(`Unknown argument: ${arg}`);
  if (args.has('--help') || args.has('-h')) {
    console.log('Usage: node scripts/mobile-ui/fidelity-contract.mjs [--check-docs]');
    return null;
  }
  return {};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = parseCli(process.argv);
    if (options) {
      const result = validateFidelityContract({});
      const plannedCount = result.targets.length - result.wiredCount;
      console.log(
        `Fidelity contract valid: ${result.targets.length} targets (${result.wiredCount} wired, ${plannedCount} planned), ${result.screens.size} screens, ${result.contract.exclusions?.length ?? 0} exclusions.`,
      );
    }
  } catch (error) {
    console.error(`Fidelity contract invalid: ${error.message}`);
    process.exit(1);
  }
}
