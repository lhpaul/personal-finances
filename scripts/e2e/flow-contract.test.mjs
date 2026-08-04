import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { validateFlowContract } from './flow-contract.mjs';

/**
 * Unit tests for `scripts/e2e/flow-contract.mjs` (implementation plan for issue #22, Testing
 * Strategy → "Unit tests — toolchain"). Mirrors `scripts/mobile-ui/fidelity-contract.test.mjs`'s
 * shape: a synthetic manifest and contract, a temp root with real flow files on disk for the
 * "wired" rows, and `assert.throws`/`assert.doesNotThrow` per scenario.
 */

function baseManifest() {
  return {
    screens: [
      { screen_id: 'home' },
      { screen_id: 'transactions' },
      { screen_id: 'settings' },
      { screen_id: 'ds-page' },
      { screen_id: 'legacy', mvp: false },
    ],
  };
}

function baseContract() {
  return {
    schema_version: 1,
    app_id: 'cl.finanzas.mobile',
    credential_fixtures: { rut: '12.345.678-5', password: 'ZZE2EPASSZZ' },
    forbidden_hosts: ['bancochile.cl'],
    fixture_states: [
      { id: 'reset', action_key: 'dev.e2e_fixtures.reset_action' },
      { id: 'synced-home', action_key: 'dev.e2e_fixtures.synced_home_action' },
    ],
    data_selectors: [],
    input_values: [],
    flows: [
      { id: '01-home', file: 'flows/01-home.yaml', fixture_state: 'synced-home', screens: ['home'], status: 'wired', issue: 22 },
      { id: '02-transactions', file: 'flows/02-transactions.yaml', fixture_state: 'reset', screens: ['transactions'], status: 'wired', issue: 22 },
      { id: '03-settings', file: 'flows/03-settings.yaml', fixture_state: 'synced-home', screens: ['settings'], status: 'planned', issue: 19 },
    ],
    exclusions: [{ screen_id: 'ds-page', reason: 'Design-system reference page' }],
  };
}

function makeRoot(t, contract = baseContract()) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'finanzas-e2e-contract-'));
  t.after(() => fs.rmSync(root, { force: true, recursive: true }));
  const flowsDir = path.join(root, '.maestro', 'flows');
  fs.mkdirSync(flowsDir, { recursive: true });
  for (const flow of contract.flows ?? []) {
    if (flow.status !== 'wired') continue;
    fs.writeFileSync(path.join(root, '.maestro', flow.file), `appId: cl.finanzas.mobile\n---\n- launchApp\n`);
  }
  return root;
}

function expectInvalid(t, mutate, pattern) {
  const contract = baseContract();
  const manifest = baseManifest();
  mutate(contract, manifest);
  const root = makeRoot(t, contract);
  assert.throws(() => validateFlowContract({ contract, manifest, root }), pattern);
}

test('a valid contract passes', (t) => {
  const contract = baseContract();
  const manifest = baseManifest();
  const root = makeRoot(t, contract);
  const result = validateFlowContract({ contract, manifest, root });
  assert.equal(result.wiredCount, 2);
  assert.equal(result.plannedCount, 1);
});

test('a wired row whose file is missing fails', (t) => {
  const contract = baseContract();
  const manifest = baseManifest();
  const root = makeRoot(t, contract);
  fs.rmSync(path.join(root, '.maestro', 'flows', '01-home.yaml'));
  assert.throws(() => validateFlowContract({ contract, manifest, root }), /01-home.*does not exist/s);
});

test('a planned row whose file is missing passes', (t) => {
  // 03-settings is already "planned" with no file on disk in baseContract's makeRoot — the
  // fixture above already proves this; this test asserts it explicitly and independently.
  const contract = baseContract();
  const manifest = baseManifest();
  const root = makeRoot(t, contract);
  assert.doesNotThrow(() => validateFlowContract({ contract, manifest, root }));
  assert.equal(fs.existsSync(path.join(root, '.maestro', 'flows', '03-settings.yaml')), false);
});

test('a flow referencing an undeclared fixture state fails', (t) => {
  expectInvalid(
    t,
    (contract) => {
      contract.flows[0].fixture_state = 'no-such-state';
    },
    /undeclared fixture state/,
  );
});

test('a declared fixture state no flow uses fails', (t) => {
  expectInvalid(
    t,
    (contract) => {
      contract.fixture_states.push({ id: 'unused', action_key: 'dev.e2e_fixtures.unused_action' });
    },
    /no flow uses/,
  );
});

test('a screen_id absent from the mockup manifest fails', (t) => {
  expectInvalid(
    t,
    (contract) => {
      contract.flows[0].screens.push('no-such-screen');
    },
    /unknown screen_id/,
  );
});

test('a flow file present on disk but absent from the contract fails', (t) => {
  const contract = baseContract();
  const manifest = baseManifest();
  const root = makeRoot(t, contract);
  fs.writeFileSync(path.join(root, '.maestro', 'flows', 'orphan.yaml'), 'appId: cl.finanzas.mobile\n---\n- launchApp\n');
  assert.throws(() => validateFlowContract({ contract, manifest, root }), /orphan\.yaml/);
});

test('an empty .maestro/flows directory fails loudly (a broken walk must not pass vacuously)', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'finanzas-e2e-contract-empty-'));
  t.after(() => fs.rmSync(root, { force: true, recursive: true }));
  fs.mkdirSync(path.join(root, '.maestro', 'flows'), { recursive: true });
  const manifest = baseManifest();
  const contract = baseContract();
  // Every "wired" flow's file is absent from this empty directory.
  assert.throws(() => validateFlowContract({ contract, manifest, root }), /does not exist/);
});

test('an MVP screen covered by neither a wired flow, a planned flow, nor an exclusion fails', (t) => {
  expectInvalid(
    t,
    (contract, manifest) => {
      manifest.screens.push({ screen_id: 'orphan-screen' });
    },
    /orphan-screen/,
  );
});

test('a data_selectors entry referencing an undeclared fixture state fails', (t) => {
  expectInvalid(
    t,
    (contract) => {
      contract.data_selectors.push({ text: 'Banco de Chile', fixture_state: 'no-such-state' });
    },
    /undeclared fixture state/,
  );
});

test('a duplicate flow id fails', (t) => {
  expectInvalid(
    t,
    (contract) => {
      contract.flows.push({ ...contract.flows[0] });
    },
    /Duplicate flow id/,
  );
});

test('a screen that is both covered by a wired flow and excluded fails', (t) => {
  expectInvalid(
    t,
    (contract) => {
      contract.exclusions.push({ screen_id: 'home', reason: 'test' });
    },
    /both covered by a wired flow and excluded/,
  );
});
