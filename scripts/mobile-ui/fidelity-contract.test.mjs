import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { expandCoverage, targetId, validateFidelityContract } from './fidelity-contract.mjs';
import { loadManifest, mvpTargets } from './load-manifest.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function baseManifest() {
  return {
    screens: [
      { screen_id: 'stateless' },
      {
        screen_id: 'multi',
        states: [
          { state_id: 'empty', initial: true },
          { state_id: 'filled' },
        ],
      },
      {
        screen_id: 'hub',
        states: [
          { state_id: 'normal', initial: true },
          { state_id: 'lapsed' },
        ],
      },
      { screen_id: 'legacy', mvp: false, states: [{ state_id: 'only', initial: true }] },
      {
        screen_id: 'wizard',
        states: [
          { state_id: 'active', initial: true },
          { state_id: 'draft', mvp: false },
        ],
      },
      { screen_id: 'ds-page' },
    ],
  };
}

function mapping(screenId, stateId = null, overrides = {}) {
  const stateParam = stateId ? `&fidelityState=${stateId}` : '';
  return {
    screen_id: screenId,
    ...(stateId ? { state_id: stateId } : {}),
    status: 'wired',
    fixture: 'session',
    app_file: `apps/${screenId}${stateId ? `-${stateId}` : ''}.tsx`,
    deep_link: `finanzas:///${screenId}?fidelity=1&fidelityScreen=${screenId}${stateParam}`,
    ready_test_id: `fidelity-${screenId}`,
    ...overrides,
  };
}

function baseContract() {
  return {
    schema_version: 1,
    default_profile: 'test-profile',
    defaults: { max_mismatch_pct: 3.0, pixel_threshold: 0.1, settle_ms: 2500 },
    profiles: { 'test-profile': { width: 100, height: 200 } },
    fixtures: { session: { description: 'test fixture' } },
    coverage_sets: [
      {
        issue: 1,
        targets: [
          { screen_id: 'stateless', states: 'all' },
          { screen_id: 'multi', states: 'all' },
          { screen_id: 'hub', states: 'all' },
          { screen_id: 'wizard', states: 'all' },
        ],
      },
    ],
    exclusions: [{ screen_id: 'ds-page', states: null, reason: 'Design-system reference page' }],
    mappings: [
      mapping('stateless'),
      mapping('multi', 'empty'),
      mapping('multi', 'filled'),
      mapping('hub', 'normal'),
      mapping('hub', 'lapsed'),
      mapping('wizard', 'active'),
    ],
  };
}

function clone(value) {
  return structuredClone(value);
}

function makeRoot(t, contract = baseContract()) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'finanzas-fidelity-'));
  t.after(() => fs.rmSync(root, { force: true, recursive: true }));
  for (const entry of contract.mappings ?? []) {
    if (entry.status !== 'wired' || typeof entry.app_file !== 'string') continue;
    const file = path.join(root, entry.app_file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `export const id = '${entry.ready_test_id}';\n`);
  }
  return root;
}

function expectInvalid(t, mutate, pattern) {
  const contract = baseContract();
  const manifest = baseManifest();
  mutate(contract, manifest);
  const root = makeRoot(t, contract);
  assert.throws(() => validateFidelityContract({ contract, manifest, root }), pattern);
}

// 1. Reserved delimiter collisions.
test('rejects screen and state ids containing the reserved "--" delimiter', () => {
  assert.throws(() => targetId('screen--bad'), /reserved/);
  assert.throws(() => targetId('screen', 'state--bad'), /reserved/);
});

// 2. Coverage target naming an mvp:false screen.
test('rejects a coverage target naming an mvp:false screen', (t) => {
  expectInvalid(
    t,
    (contract) => {
      contract.coverage_sets[0].targets.push({ screen_id: 'legacy', states: 'all' });
    },
    /legacy/,
  );
});

// 3. Coverage target naming an mvp:false state.
test('rejects a coverage target naming an mvp:false state', (t) => {
  expectInvalid(
    t,
    (contract) => {
      contract.coverage_sets[0].targets = contract.coverage_sets[0].targets.map((target) =>
        target.screen_id === 'wizard' ? { screen_id: 'wizard', states: ['active', 'draft'] } : target,
      );
      contract.mappings.push(mapping('wizard', 'draft'));
    },
    /wizard--draft/,
  );
});

// 4. MVP screen present but in neither coverage nor exclusions.
test('rejects an MVP screen covered by neither coverage nor exclusions', (t) => {
  expectInvalid(
    t,
    (contract, manifest) => {
      manifest.screens.push({ screen_id: 'orphan-screen' });
    },
    /not covered and not excluded.*orphan-screen/,
  );
});

// 5. MVP state present but uncovered while its screen is covered.
test('rejects an MVP state uncovered while its screen is covered', (t) => {
  expectInvalid(
    t,
    (contract) => {
      contract.coverage_sets[0].targets = contract.coverage_sets[0].targets.map((target) =>
        target.screen_id === 'hub' ? { screen_id: 'hub', states: ['normal'] } : target,
      );
      contract.mappings = contract.mappings.filter(
        (m) => !(m.screen_id === 'hub' && m.state_id === 'lapsed'),
      );
    },
    /hub--lapsed/,
  );
});

// 6. Screen/state both covered and excluded.
test('rejects a target that is both covered and excluded', (t) => {
  expectInvalid(
    t,
    (contract) => {
      contract.exclusions.push({ screen_id: 'stateless', states: null, reason: 'test' });
    },
    /both covered and excluded/,
  );
});

// 7. Exclusion without a reason, or with an empty reason.
test('rejects exclusions with a missing or empty reason', (t) => {
  expectInvalid(
    t,
    (contract) => {
      delete contract.exclusions[0].reason;
    },
    /non-empty reason/,
  );
  expectInvalid(
    t,
    (contract) => {
      contract.exclusions[0].reason = '   ';
    },
    /non-empty reason/,
  );
});

// 8. Exclusion naming an unknown screen, or an unknown state of a known screen.
test('rejects exclusions naming an unknown screen or an unknown state', (t) => {
  expectInvalid(
    t,
    (contract) => {
      contract.exclusions[0].screen_id = 'nonexistent';
    },
    /Unknown excluded screen/,
  );
  expectInvalid(
    t,
    (contract) => {
      contract.exclusions.push({ screen_id: 'hub', states: ['missing-state'], reason: 'test' });
    },
    /Unknown excluded state.*Valid states/,
  );
});

// 9. Duplicate coverage target across two coverage sets.
test('rejects duplicate coverage targets across two coverage sets', (t) => {
  expectInvalid(
    t,
    (contract) => {
      contract.coverage_sets.push({ issue: 2, targets: [{ screen_id: 'stateless', states: 'all' }] });
    },
    /Duplicate coverage target/,
  );
});

// 10. Coverage set without an integer issue.
test('rejects a coverage set without an integer issue', (t) => {
  expectInvalid(
    t,
    (contract) => {
      contract.coverage_sets[0].issue = 'not-a-number';
    },
    /integer issue/,
  );
});

// 11. Coverage target with a mapping missing.
test('rejects a coverage target with no mapping', (t) => {
  expectInvalid(
    t,
    (contract) => {
      contract.mappings.pop();
    },
    /Missing mapping/,
  );
});

// 12. Mapping with no corresponding coverage target (stale).
test('rejects a stale mapping with no coverage target', (t) => {
  expectInvalid(
    t,
    (contract) => {
      contract.mappings.push(mapping('legacy', 'only'));
    },
    /stale/,
  );
});

// 13. Duplicate mapping for one target.
test('rejects a duplicate mapping for one target', (t) => {
  expectInvalid(
    t,
    (contract) => {
      contract.mappings.push(clone(contract.mappings[0]));
    },
    /Duplicate mapping/,
  );
});

// 14. status other than planned/wired.
test('rejects a mapping status other than planned or wired', (t) => {
  expectInvalid(
    t,
    (contract) => {
      contract.mappings[0].status = 'done';
    },
    /invalid status/,
  );
});

// 15. wired mapping missing app_file, deep_link, or ready_test_id.
test('rejects a wired mapping missing a required field', (t) => {
  for (const field of ['app_file', 'deep_link', 'ready_test_id']) {
    expectInvalid(
      t,
      (contract) => {
        delete contract.mappings[0][field];
      },
      new RegExp(`missing "${field}"`),
    );
  }
});

// 16. wired mapping whose app_file does not exist on disk.
test('rejects a wired mapping whose app_file is missing on disk', (t) => {
  const contract = baseContract();
  const manifest = baseManifest();
  const root = makeRoot(t, contract);
  fs.rmSync(path.join(root, contract.mappings[0].app_file));
  assert.throws(
    () => validateFidelityContract({ contract, manifest, root }),
    /missing app file/,
  );
});

// 17. wired mapping whose ready_test_id is absent from app_file.
test('rejects a wired mapping whose selector is absent from its app_file', (t) => {
  const contract = baseContract();
  const manifest = baseManifest();
  const root = makeRoot(t, contract);
  fs.writeFileSync(path.join(root, contract.mappings[0].app_file), 'export {};\n');
  assert.throws(
    () => validateFidelityContract({ contract, manifest, root }),
    /absent from/,
  );
});

// 17b. A wired mapping whose app_file uses the canonical fidelityTestId(screenId) call
// expression (Decision 9) is accepted without the literal selector string.
test('accepts a wired mapping whose app_file computes the selector via fidelityTestId()', (t) => {
  const contract = baseContract();
  const manifest = baseManifest();
  const root = makeRoot(t, contract);
  fs.writeFileSync(
    path.join(root, contract.mappings[0].app_file),
    "testID={fidelityTestId('stateless')}\n",
  );
  assert.doesNotThrow(() => validateFidelityContract({ contract, manifest, root }));
});

test('rejects a fidelityTestId() call expression whose screen id does not match the mapping', (t) => {
  const contract = baseContract();
  const manifest = baseManifest();
  const root = makeRoot(t, contract);
  fs.writeFileSync(
    path.join(root, contract.mappings[0].app_file),
    "testID={fidelityTestId('multi')}\n",
  );
  assert.throws(() => validateFidelityContract({ contract, manifest, root }), /absent from/);
});

// 18. planned mapping carrying app_file / deep_link / ready_test_id.
test('rejects a planned mapping carrying wired-only fields', (t) => {
  for (const field of ['app_file', 'deep_link', 'ready_test_id']) {
    expectInvalid(
      t,
      (contract) => {
        contract.mappings[0].status = 'planned';
        contract.mappings[0][field] = 'x';
      },
      /must not carry/,
    );
  }
});

// 19. Deep link with the wrong scheme, missing fidelity=1, or mismatched fidelityScreen/fidelityState.
test('rejects deep links whose preview metadata does not match the mapping', (t) => {
  expectInvalid(
    t,
    (contract) => {
      contract.mappings[0].deep_link = 'zeki:///stateless?fidelity=1&fidelityScreen=stateless';
    },
    /deep_link preview parameters/,
  );
  expectInvalid(
    t,
    (contract) => {
      contract.mappings[0].deep_link = 'finanzas:///stateless?fidelityScreen=stateless';
    },
    /deep_link preview parameters/,
  );
  expectInvalid(
    t,
    (contract) => {
      contract.mappings[0].deep_link = 'finanzas:///stateless?fidelity=1&fidelityScreen=multi';
    },
    /deep_link preview parameters/,
  );
  expectInvalid(
    t,
    (contract) => {
      contract.mappings[1].deep_link = 'finanzas:///multi?fidelity=1&fidelityScreen=multi&fidelityState=filled';
    },
    /deep_link preview parameters/,
  );
});

// 20. Deep link that is not a parsable URL.
test('rejects a deep_link that is not a parsable URL', (t) => {
  expectInvalid(
    t,
    (contract) => {
      contract.mappings[0].deep_link = 'not a url';
    },
    /invalid deep_link/,
  );
});

// 21. max_mismatch_pct above the default without a threshold_note.
test('rejects a raised max_mismatch_pct without a threshold_note', (t) => {
  expectInvalid(
    t,
    (contract) => {
      contract.mappings[0].max_mismatch_pct = 5.0;
    },
    /threshold_note/,
  );
});

test('accepts a raised max_mismatch_pct with a threshold_note', (t) => {
  const contract = baseContract();
  const manifest = baseManifest();
  contract.mappings[0].max_mismatch_pct = 5.0;
  contract.mappings[0].threshold_note = 'Known renderer difference';
  const root = makeRoot(t, contract);
  assert.doesNotThrow(() => validateFidelityContract({ contract, manifest, root }));
});

// 22. max_mismatch_pct that is 0, negative, >100, or non-finite.
test('rejects an invalid max_mismatch_pct', (t) => {
  for (const value of [0, -1, 101, Number.POSITIVE_INFINITY]) {
    expectInvalid(
      t,
      (contract) => {
        contract.mappings[0].max_mismatch_pct = value;
        contract.mappings[0].threshold_note = 'note';
      },
      /invalid max_mismatch_pct/,
    );
  }
});

// 23. Mapping referencing an unknown fixture or an unknown profile.
test('rejects a mapping referencing an unknown fixture or profile', (t) => {
  expectInvalid(
    t,
    (contract) => {
      contract.mappings[0].fixture = 'unknown-fixture';
    },
    /unknown fixture/,
  );
  expectInvalid(
    t,
    (contract) => {
      contract.mappings[0].profile = 'unknown-profile';
    },
    /unknown profile/,
  );
});

// 24. states: "all" on a screen with no states[] yields exactly one target with state_id: null.
test('expands "all" on a stateless screen to exactly one null-state target', () => {
  const targets = expandCoverage(baseContract(), baseManifest());
  const stateless = targets.filter((target) => target.screenId === 'stateless');
  assert.equal(stateless.length, 1);
  assert.equal(stateless[0].stateId, null);
});

// 25. states: "initial" on a screen with zero or two initial:true states.
test('rejects "initial" on a screen with zero or two initial states', (t) => {
  expectInvalid(
    t,
    (contract, manifest) => {
      manifest.screens.find((s) => s.screen_id === 'multi').states.forEach((s) => {
        s.initial = false;
      });
      contract.coverage_sets[0].targets = contract.coverage_sets[0].targets.map((target) =>
        target.screen_id === 'multi' ? { screen_id: 'multi', states: 'initial' } : target,
      );
    },
    /exactly one initial state/,
  );
  expectInvalid(
    t,
    (contract, manifest) => {
      manifest.screens.find((s) => s.screen_id === 'multi').states.forEach((s) => {
        s.initial = true;
      });
      contract.coverage_sets[0].targets = contract.coverage_sets[0].targets.map((target) =>
        target.screen_id === 'multi' ? { screen_id: 'multi', states: 'initial' } : target,
      );
    },
    /exactly one initial state/,
  );
});

test('"initial" uses the same strict state.initial === true predicate as load-manifest.mjs', (t) => {
  // A truthy-but-not-boolean `initial` (e.g. `initial: 1`) must not resolve as the initial
  // state — expandCoverage delegates to the shared initialStateForScreen, so there is exactly
  // one predicate for "is this the initial state" across the whole kit.
  expectInvalid(
    t,
    (contract, manifest) => {
      const screen = manifest.screens.find((s) => s.screen_id === 'multi');
      screen.states[0].initial = 1;
      screen.states[1].initial = false;
      contract.coverage_sets[0].targets = contract.coverage_sets[0].targets.map((target) =>
        target.screen_id === 'multi' ? { screen_id: 'multi', states: 'initial' } : target,
      );
    },
    /exactly one initial state/,
  );
});

// 26. states: [] or a non-array, non-"all", non-"initial" value.
test('rejects an invalid states declaration', (t) => {
  expectInvalid(
    t,
    (contract) => {
      contract.coverage_sets[0].targets[0].states = [];
    },
    /Invalid states declaration/,
  );
  expectInvalid(
    t,
    (contract) => {
      contract.coverage_sets[0].targets[0].states = 42;
    },
    /Invalid states declaration/,
  );
});

// 27. schema_version other than 1.
test('rejects an unsupported schema_version', (t) => {
  expectInvalid(
    t,
    (contract) => {
      contract.schema_version = 2;
    },
    /Unsupported/,
  );
});

// 28. Profile with non-integer or non-positive width/height.
test('rejects a profile with non-integer or non-positive dimensions', (t) => {
  for (const dimensions of [{ width: 1.5, height: 200 }, { width: 100, height: 0 }, { width: -1, height: 200 }]) {
    expectInvalid(
      t,
      (contract) => {
        contract.profiles['test-profile'] = dimensions;
      },
      /positive integer/,
    );
  }
});

// 29. Manifest file missing, unparsable, or not assigning window.__MOCKUP_MANIFEST__.
test('loadManifest throws naming the manifest path when missing, unparsable, or empty', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'finanzas-fidelity-manifest-'));
  t.after(() => fs.rmSync(root, { force: true, recursive: true }));

  assert.throws(() => loadManifest(root), /mockup-manifest\.js/);

  const manifestDir = path.join(root, 'design/mockups/mobile');
  fs.mkdirSync(manifestDir, { recursive: true });
  const manifestFile = path.join(manifestDir, 'mockup-manifest.js');

  fs.writeFileSync(manifestFile, 'this is not valid javascript {{{');
  assert.throws(() => loadManifest(root), /mockup-manifest\.js/);

  fs.writeFileSync(manifestFile, 'window.__SOMETHING_ELSE__ = {};');
  assert.throws(() => loadManifest(root), /did not assign window\.__MOCKUP_MANIFEST__/);
});

// 30. The real repository contract and the real manifest.
test('validates the real contract against the real manifest', () => {
  const result = validateFidelityContract({ root: REPO_ROOT });
  assert.equal(result.targets.length, 64);
  assert.equal(result.screens.size, 25);
  assert.equal(result.contract.coverage_sets.length, 13);
  for (const mapping of result.mappings.values()) {
    assert.ok(mapping.status === 'planned' || mapping.status === 'wired');
  }
});

test('mvpTargets on the real manifest matches the canonical 67-target universe', () => {
  const manifest = loadManifest(REPO_ROOT);
  assert.equal(mvpTargets(manifest).length, 67);
});
