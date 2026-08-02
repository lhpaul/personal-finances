import assert from 'node:assert/strict';
import test from 'node:test';
import { main, parseArgs, resolveTargets } from './run-fidelity.mjs';
import { validateFidelityContract } from './fidelity-contract.mjs';

test('parseArgs accepts --app-from', () => {
  const options = parseArgs(['node', 'runner', '--screen', 'settings', '--app-from', '/tmp/x.png']);
  assert.equal(options.appFrom, '/tmp/x.png');
});

test('resolveTargets returns every target for a multi-target issue', () => {
  const validation = validateFidelityContract({});
  const targets = resolveTargets(validation, { issue: 8, profile: validation.contract.default_profile });
  assert.ok(targets.length > 1, 'issue #8 owns more than one target in the real contract');
});

test('--app-from rejects a multi-target selection (--issue 8 owns 5 targets)', async () => {
  await assert.rejects(
    () => main(['node', 'runner', '--issue', '8', '--app-from', '/tmp/does-not-matter.png']),
    /--app-from applies to a single target/,
  );
});

test('--app-from is accepted for a single-target selection (--screen settings, stateless)', async () => {
  // "settings" is stateless (exactly one target), so resolveTargets returns exactly one target
  // and the --app-from guard must not reject it. --dry-run means main() never touches the
  // (nonexistent) source PNG, so a clean resolution here proves the guard, not the file I/O.
  await assert.doesNotReject(() =>
    main(['node', 'runner', '--screen', 'settings', '--app-from', '/tmp/does-not-exist.png', '--dry-run']),
  );
});
