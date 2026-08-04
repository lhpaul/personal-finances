import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { scanFlows } from './flow-lint.mjs';

/**
 * Unit tests for `scripts/e2e/flow-lint.mjs` (implementation plan for issue #22, Testing
 * Strategy → Parser-risk addendum, E1-E23). Every planted-violation fixture lives here, in the
 * test's own temp fixtures — never in `.maestro/` itself (D13).
 */

const CONTRACT = {
  credential_fixtures: { rut: '12.345.678-5', password: 'ZZE2EPASSZZ' },
  forbidden_hosts: ['bancochile.cl', 'portalpersonas.bancochile.cl'],
  input_values: [{ text: 'Jumbo', usage: 'search term' }],
  data_selectors: [{ text: 'Banco de Chile' }],
};

const CATALOGUE_VALUES = new Set(['RUT', 'Clave de internet', 'Excluir del análisis', '{{count}} transacciones']);

function makeRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'finanzas-e2e-lint-'));
  t.after(() => fs.rmSync(root, { force: true, recursive: true }));
  fs.mkdirSync(path.join(root, '.maestro'), { recursive: true });
  return root;
}

function writeFile(root, relativePath, content) {
  const filePath = path.join(root, '.maestro', relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return filePath;
}

function scan(root) {
  return scanFlows({ root, contract: CONTRACT, catalogueValues: CATALOGUE_VALUES });
}

function findingsFor(root, rule) {
  return scan(root).filter((finding) => finding.rule === rule);
}

// E1 / E2 / E3 / E4 / E5 / E6 — R1 RUT shape.
test('E1: the declared fixture RUT produces no R1 finding', (t) => {
  const root = makeRoot(t);
  writeFile(root, 'flows/a.yaml', "- comment: 'rut: \"12.345.678-5\"'\n");
  assert.equal(findingsFor(root, 'R1').length, 0);
});

test('E2: a non-fixture formatted RUT produces an R1 finding', (t) => {
  const root = makeRoot(t);
  writeFile(root, 'flows/a.yaml', "rut: \"11.111.111-1\"\n");
  assert.equal(findingsFor(root, 'R1').length, 1);
});

test('E3: an unformatted dashed RUT produces an R1 finding', (t) => {
  const root = makeRoot(t);
  writeFile(root, 'flows/a.yaml', 'rut: "12345678-5"\n');
  assert.equal(findingsFor(root, 'R1').length, 1);
});

test('E4: the check digit is case-insensitive — both K and k are flagged as non-fixture', (t) => {
  const root = makeRoot(t);
  writeFile(root, 'flows/a.yaml', '12.345.678-K and 12.345.678-k\n');
  assert.equal(findingsFor(root, 'R1').length, 2);
});

test('E5: a real RUT inside a YAML comment is still a finding — a comment is not an escape hatch', (t) => {
  const root = makeRoot(t);
  writeFile(root, 'flows/a.yaml', '# real RUT 9.876.543-3\n');
  assert.equal(findingsFor(root, 'R1').length, 1);
});

test('E6: two non-fixture RUTs on one line produce two findings, each with its own column', (t) => {
  const root = makeRoot(t);
  writeFile(root, 'flows/a.yaml', '9.876.543-3 and 1.234.567-8\n');
  const findings = findingsFor(root, 'R1');
  assert.equal(findings.length, 2);
  assert.notEqual(findings[0].column, findings[1].column);
});

// E7-E11 — R2 credential-shaped key.
test('E7: password: with the declared fixture password produces no R2 finding', (t) => {
  const root = makeRoot(t);
  writeFile(root, 'flows/a.yaml', 'password: "ZZE2EPASSZZ"\n');
  assert.equal(findingsFor(root, 'R2').length, 0);
});

test('E8: password: with an undeclared literal produces an R2 finding', (t) => {
  const root = makeRoot(t);
  writeFile(root, 'flows/a.yaml', 'password: "hunter2"\n');
  assert.equal(findingsFor(root, 'R2').length, 1);
});

test('E9: password: ${E2E_PASSWORD} produces no finding — no literal is present', (t) => {
  const root = makeRoot(t);
  writeFile(root, 'flows/a.yaml', 'password: ${E2E_PASSWORD}\n');
  assert.equal(findingsFor(root, 'R2').length, 0);
});

test('E10: a tapOn value containing the word "Clave" is not an R2 finding — R2 matches keys, not values', (t) => {
  const root = makeRoot(t);
  writeFile(root, 'flows/a.yaml', "- tapOn: \"Clave de internet\"\n");
  assert.equal(findingsFor(root, 'R2').length, 0);
});

test('E11: passwordless: true produces no finding — the key must match exactly', (t) => {
  const root = makeRoot(t);
  writeFile(root, 'flows/a.yaml', 'passwordless: true\n');
  assert.equal(findingsFor(root, 'R2').length, 0);
});

// E12-E14 — R3 typed input allowlist.
test('E12: inputText with the declared fixture password produces no R3 finding', (t) => {
  const root = makeRoot(t);
  writeFile(root, 'flows/a.yaml', "- inputText: 'ZZE2EPASSZZ'\n");
  assert.equal(findingsFor(root, 'R3').length, 0);
});

test('E13: inputText with a declared input_values entry produces no R3 finding', (t) => {
  const root = makeRoot(t);
  writeFile(root, 'flows/a.yaml', "- inputText: 'Jumbo'\n");
  assert.equal(findingsFor(root, 'R3').length, 0);
});

test('E14: inputText with an undeclared literal produces an R3 finding — typing is the real credential path', (t) => {
  const root = makeRoot(t);
  writeFile(root, 'flows/a.yaml', "- inputText: 'mi-clave-real'\n");
  assert.equal(findingsFor(root, 'R3').length, 1);
});

// E15-E17 — R4 real-bank host.
test('E15: a bancochile.cl URL produces an R4 finding (one per declared forbidden host it matches — both "bancochile.cl" and "portalpersonas.bancochile.cl" are substrings of this URL)', (t) => {
  const root = makeRoot(t);
  writeFile(root, 'flows/a.yaml', "- openLink: 'https://portalpersonas.bancochile.cl/login'\n");
  assert.equal(findingsFor(root, 'R4').length, 2);
});

test('E16: the prose "Banco de Chile" and the id "banco-de-chile" produce no R4 finding — R4 matches hosts', (t) => {
  const root = makeRoot(t);
  writeFile(root, 'flows/a.yaml', "- tapOn: 'Banco de Chile' # banco-de-chile\n");
  assert.equal(findingsFor(root, 'R4').length, 0);
});

test('E17: a credential-shaped literal in shared/fixture.yaml and in README.md both produce findings — the walk is recursive and extension-agnostic', (t) => {
  const root = makeRoot(t);
  writeFile(root, 'shared/fixture.yaml', 'password: "hunter2"\n');
  writeFile(root, 'README.md', 'password: "hunter2"\n');
  assert.equal(findingsFor(root, 'R2').length, 2);
});

// E18 — CRLF line endings.
test('E18: a file with CRLF line endings is scanned with correct line numbers', (t) => {
  const root = makeRoot(t);
  writeFile(root, 'flows/a.yaml', 'appId: x\r\npassword: "hunter2"\r\n');
  const findings = findingsFor(root, 'R2');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].line, 2);
});

// E19-E22 — selector rule (D10).
test('E19: selector text equal to an es.json value produces no finding', (t) => {
  const root = makeRoot(t);
  writeFile(root, 'flows/a.yaml', "- assertVisible: 'RUT'\n");
  assert.equal(findingsFor(root, 'SELECTOR').length, 0);
});

test('E20: selector text matching no es.json value and no data_selectors entry produces a finding naming the file and line', (t) => {
  const root = makeRoot(t);
  writeFile(root, 'flows/a.yaml', "- assertVisible: 'Some unknown copy'\n");
  const findings = findingsFor(root, 'SELECTOR');
  assert.equal(findings.length, 1);
  assert.equal(findings[0].file, '.maestro/flows/a.yaml');
  assert.equal(findings[0].line, 1);
});

test('E21: selector text equal to an es.json value that contains {{count}} is a finding — interpolated copy is not legal', (t) => {
  const root = makeRoot(t);
  writeFile(root, 'flows/a.yaml', "- assertVisible: '{{count}} transacciones'\n");
  assert.equal(findingsFor(root, 'SELECTOR').length, 1);
});

test('E22: selector text listed in data_selectors produces no finding', (t) => {
  const root = makeRoot(t);
  writeFile(root, 'flows/a.yaml', "- tapOn: 'Banco de Chile'\n");
  assert.equal(findingsFor(root, 'SELECTOR').length, 0);
});

// E23 — empty tree.
test('E23: an empty .maestro/ tree is a hard error — the scanner must not pass vacuously', (t) => {
  const root = makeRoot(t);
  assert.throws(() => scan(root), /no files/);
});

test('a missing .maestro/ directory entirely is also a hard error', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'finanzas-e2e-lint-missing-'));
  t.after(() => fs.rmSync(root, { force: true, recursive: true }));
  assert.throws(() => scanFlows({ root, contract: CONTRACT, catalogueValues: CATALOGUE_VALUES }), /does not exist/);
});

// Additional coverage: the committed suite passes end to end (both directions — a scanner that
// only ever passes proves nothing, and this suite proves it also passes on real, clean input).
test('a clean file with a below: anchor and a data-derived tap target produces no findings at all', (t) => {
  const root = makeRoot(t);
  writeFile(
    root,
    'flows/a.yaml',
    [
      "appId: cl.finanzas.mobile.dev",
      "---",
      "- tapOn:",
      "    below: 'RUT'",
      "- inputText: '12.345.678-5' # fixture RUT",
      "- tapOn: 'Banco de Chile'",
      "- assertVisible: 'Clave de internet'",
      '',
    ].join('\n'),
  );
  assert.deepEqual(scan(root), []);
});

// flow-contract.json's own exemption (R1-R4 only) — its data_selectors/credential_fixtures
// declarations must not self-trigger the very rules they configure.
test("flow-contract.json's own declared forbidden_hosts entries do not self-trigger R4", (t) => {
  const root = makeRoot(t);
  writeFile(
    root,
    'flow-contract.json',
    JSON.stringify({ credential_fixtures: CONTRACT.credential_fixtures, forbidden_hosts: CONTRACT.forbidden_hosts }),
  );
  const findings = scanFlows({ root, contract: CONTRACT, catalogueValues: CATALOGUE_VALUES });
  assert.equal(findings.filter((f) => f.rule === 'R4').length, 0);
});
