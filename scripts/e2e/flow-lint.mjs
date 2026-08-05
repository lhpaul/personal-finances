#!/usr/bin/env node
/**
 * Credential and selector scanner for `.maestro/` (implementation plan for issue #22, D10, D13).
 * Proves AC2 ("no real credential appears in any flow file") mechanically, over every file under
 * `.maestro/`, recursively and extension-agnostic (R1-R4 below), and proves D10's selector rule
 * (every `tapOn`/`assertVisible`/`below`/`above` literal is either an exact `es.json` value or a
 * declared `data_selectors` entry).
 *
 * **Suppression semantics: none, deliberately (D13).** No inline directive is recognised, in any
 * position. The only declared exceptions are `flow-contract.json`'s own `credential_fixtures`,
 * `input_values` and `data_selectors` — and, for R1/R2/R3/R4 only, `flow-contract.json` itself is
 * exempt from the four credential rules, because it is the *declaration* surface for the fixture
 * constants and the forbidden-host list (mirrors `src/db/checks/peso-total-scan.ts`'s own
 * hard-coded, single-file allowlist for its own definition file) — a blanket scan would otherwise
 * self-flag `forbidden_hosts`'s own declared entries as if they were visited hosts. The selector
 * rule is **not** exempt for this file: `flow-contract.json` carries no `tapOn`/`assertVisible`
 * keys, so the exemption is moot for it in practice, but is written narrowly (R1-R4 only) rather
 * than as a whole-file skip.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MAESTRO_DIR = '.maestro';
const CONTRACT_PATH = '.maestro/flow-contract.json';

/** The one file exempt from R1-R4 (not from the selector rule) — see the module doc comment. */
const CREDENTIAL_RULES_EXEMPT_FILE = CONTRACT_PATH;

function fail(message) {
  throw new Error(message);
}

function listFilesRecursive(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

function readEs2sCatalogueValues(root) {
  const esJsonPath = path.join(root, 'apps/mobile/src/i18n/es.json');
  const catalogue = JSON.parse(fs.readFileSync(esJsonPath, 'utf8'));
  return new Set(Object.values(catalogue).filter((value) => typeof value === 'string'));
}

/** Splits on `\r\n`, `\r` or `\n` (E18 — CRLF line endings must still report correct line
 * numbers). */
function splitLines(source) {
  return source.split(/\r\n|\r|\n/);
}

const RUT_FORMATTED_PATTERN = /\d{1,2}\.\d{3}\.\d{3}-[\dkK]/g;
const RUT_UNFORMATTED_PATTERN = /\b\d{7,8}-[\dkK]\b/g;
const CREDENTIAL_KEY_PATTERN = /^\s*-?\s*(password|clave|contraseña|contrasena|secret|token|apiKey)\s*:\s*(.+?)\s*$/;
const INPUT_TEXT_PATTERN = /^\s*-?\s*inputText\s*:\s*(.+?)\s*$/;
// `text` is included alongside the command names themselves (found on device): `tapOn:`/
// `assertVisible:` also accept an object form (`tapOn: { text: '...', optional: true }`), whose
// nested `text:` key carries the actual selector literal and would otherwise escape this scan
// entirely — a blind spot, not merely a missed convenience.
const SELECTOR_KEY_PATTERN = /^\s*-?\s*(tapOn|assertVisible|below|above|text)\s*:\s*(.+?)\s*$/;

/**
 * Extracts a YAML scalar's actual value from the raw "rest of line after the colon" text,
 * stopping at a trailing inline comment (` # …`) when the value is unquoted, and — for a quoted
 * value — reading only up to the matching closing quote so a trailing `# …` comment after the
 * closing quote is never folded into the value (found while wiring this scanner: `'RUT' # note`
 * was read as `RUT' # note` without this). Handles YAML's doubled-quote escape (`''` inside a
 * single-quoted scalar is one literal `'`) — sufficient for this repository's flows, which use no
 * other escape form.
 */
function extractYamlScalarValue(raw) {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return '';

  const quote = trimmed.charAt(0);
  if (quote === "'" || quote === '"') {
    let value = '';
    let i = 1;
    while (i < trimmed.length) {
      const ch = trimmed.charAt(i);
      if (ch === quote) {
        if (quote === "'" && trimmed.charAt(i + 1) === "'") {
          value += "'";
          i += 2;
          continue;
        }
        break;
      }
      value += ch;
      i += 1;
    }
    return value;
  }

  // Unquoted: an inline comment starts at a `#` preceded by whitespace (YAML's own rule) — a
  // bare `${VAR}` reference contains no `#`, so this never truncates one.
  const commentMatch = /\s#.*$/.exec(trimmed);
  return (commentMatch ? trimmed.slice(0, commentMatch.index) : trimmed).trim();
}

function isVariableReference(value) {
  return value.startsWith('${') && value.endsWith('}');
}

const INDENT_PATTERN = /^\s*/;
const COMMAND_KEY_PATTERN = /^\s*-?\s*([A-Za-z][\w]*)\s*:/;

function indentOf(lineText) {
  return (INDENT_PATTERN.exec(lineText)?.[0] ?? '').length;
}

/**
 * `copyTextFrom:`'s own `text:` value is a regex pattern for *finding* an element, not a literal
 * copy string (unlike `tapOn:`/`assertVisible:`'s object form) — D10's "must equal an es.json
 * value" rule does not apply to it. Walks backward from a `text:` line to the nearest
 * shallower-indented command line to find its enclosing command, the same way a YAML mapping's
 * key nesting resolves.
 */
function isTextKeyUnderCopyTextFrom(lines, index) {
  const textIndent = indentOf(lines[index] ?? '');
  for (let i = index - 1; i >= 0; i -= 1) {
    const candidate = lines[i] ?? '';
    if (candidate.trim().length === 0) continue;
    const candidateIndent = indentOf(candidate);
    if (candidateIndent >= textIndent) continue;
    const commandMatch = COMMAND_KEY_PATTERN.exec(candidate);
    return commandMatch?.[1] === 'copyTextFrom';
  }
  return false;
}

/** For `tapOn:`/`assertVisible:`/`below:`/`above:` with an *object* value on the same line — e.g.
 * `below: 'RUT'` under a `tapOn:` mapping — the pattern already captures the nested key's own
 * literal; a bare `tapOn:` (mapping continues on the next line) has nothing after the colon and
 * simply does not match `SELECTOR_KEY_PATTERN`, which requires a non-empty capture. */
function scanFile(relativePath, source, context) {
  const findings = [];
  const lines = splitLines(source);
  const isExemptFromCredentialRules = relativePath === CREDENTIAL_RULES_EXEMPT_FILE;

  lines.forEach((lineText, index) => {
    const lineNumber = index + 1;

    if (!isExemptFromCredentialRules) {
      // R1 — RUT shape, per-occurrence (E1-E6): every match on the line, not just the first.
      for (const pattern of [RUT_FORMATTED_PATTERN, RUT_UNFORMATTED_PATTERN]) {
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(lineText)) !== null) {
          const matched = match[0];
          if (matched.toLowerCase() !== context.fixtureRut.toLowerCase()) {
            findings.push({
              file: relativePath,
              line: lineNumber,
              column: match.index + 1,
              rule: 'R1',
              detail: `Non-fixture RUT-shaped literal "${matched}"`,
            });
          }
        }
      }

      // R2 — credential-shaped YAML key with a literal scalar value (E7-E11).
      const credentialKeyMatch = CREDENTIAL_KEY_PATTERN.exec(lineText);
      if (credentialKeyMatch) {
        const value = extractYamlScalarValue(credentialKeyMatch[2] ?? '');
        if (!isVariableReference(value)) {
          if (value !== context.fixturePassword) {
            findings.push({
              file: relativePath,
              line: lineNumber,
              column: lineText.indexOf(credentialKeyMatch[1]) + 1,
              rule: 'R2',
              detail: `Credential-shaped key "${credentialKeyMatch[1]}" with an undeclared literal value`,
            });
          }
        }
      }

      // R3 — typed input allowlist (E12-E14): the rule that actually closes the credential path.
      const inputTextMatch = INPUT_TEXT_PATTERN.exec(lineText);
      if (inputTextMatch) {
        const value = extractYamlScalarValue(inputTextMatch[1] ?? '');
        if (!isVariableReference(value)) {
          const allowed = value === context.fixtureRut || value === context.fixturePassword || context.inputValues.has(value);
          if (!allowed) {
            findings.push({
              file: relativePath,
              line: lineNumber,
              column: lineText.indexOf('inputText') + 1,
              rule: 'R3',
              detail: `Undeclared typed literal "${value}" — declare it in credential_fixtures or input_values`,
            });
          }
        }
      }

      // R4 — real-bank host (E15, E16): matches hosts only, anywhere in the line.
      for (const host of context.forbiddenHosts) {
        let searchIndex = 0;
        while (true) {
          const foundIndex = lineText.indexOf(host, searchIndex);
          if (foundIndex === -1) break;
          findings.push({
            file: relativePath,
            line: lineNumber,
            column: foundIndex + 1,
            rule: 'R4',
            detail: `Forbidden host "${host}"`,
          });
          searchIndex = foundIndex + host.length;
        }
      }
    }

    // Selector rule (D10, E19-E22) — every screen this suite reaches without a testID is matched
    // by copy; a selector must be a real catalogue value or a declared data_selectors entry.
    const selectorMatch = SELECTOR_KEY_PATTERN.exec(lineText);
    if (selectorMatch && !(selectorMatch[1] === 'text' && isTextKeyUnderCopyTextFrom(lines, index))) {
      const value = extractYamlScalarValue(selectorMatch[2] ?? '');
      if (!isVariableReference(value)) {
        if (value.includes('{{')) {
          findings.push({
            file: relativePath,
            line: lineNumber,
            column: lineText.indexOf(selectorMatch[1]) + 1,
            rule: 'SELECTOR',
            detail: `Selector "${value}" contains an interpolation placeholder — not a legal selector (D10)`,
          });
        } else if (!context.catalogueValues.has(value) && !context.dataSelectors.has(value)) {
          findings.push({
            file: relativePath,
            line: lineNumber,
            column: lineText.indexOf(selectorMatch[1]) + 1,
            rule: 'SELECTOR',
            detail: `Selector "${value}" matches no es.json value and no declared data_selectors entry`,
          });
        }
      }
    }
  });

  return findings;
}

/**
 * @param {object} [options]
 * @param {string} [options.root]
 * @param {object} [options.contract] — pass a pre-loaded contract object for isolated testing;
 *   defaults to reading the real `.maestro/flow-contract.json`.
 * @param {Set<string>} [options.catalogueValues] — pass a synthetic catalogue for isolated
 *   testing; defaults to the real `apps/mobile/src/i18n/es.json`.
 * @param {(dir: string) => string[]} [options.walk] — override the file walk, for the
 *   empty-tree test (E23).
 */
export function scanFlows({ root = REPO_ROOT, contract, catalogueValues, walk = listFilesRecursive } = {}) {
  const maestroDir = path.join(root, MAESTRO_DIR);
  if (!fs.existsSync(maestroDir)) {
    fail(`"${MAESTRO_DIR}" does not exist — nothing to scan`);
  }

  const resolvedContract = contract ?? JSON.parse(fs.readFileSync(path.join(root, CONTRACT_PATH), 'utf8'));
  const resolvedCatalogue = catalogueValues ?? readEs2sCatalogueValues(root);

  const context = {
    fixtureRut: resolvedContract.credential_fixtures?.rut ?? '',
    fixturePassword: resolvedContract.credential_fixtures?.password ?? '',
    forbiddenHosts: resolvedContract.forbidden_hosts ?? [],
    inputValues: new Set((resolvedContract.input_values ?? []).map((entry) => entry.text)),
    dataSelectors: new Set((resolvedContract.data_selectors ?? []).map((entry) => entry.text)),
    catalogueValues: resolvedCatalogue,
  };

  const files = walk(maestroDir);
  if (files.length === 0) {
    fail(`"${MAESTRO_DIR}" contains no files — a broken walk must not pass vacuously`);
  }

  const findings = [];
  for (const filePath of files) {
    const relativePath = path.relative(root, filePath).split(path.sep).join('/');
    const source = fs.readFileSync(filePath, 'utf8');
    findings.push(...scanFile(relativePath, source, context));
  }
  return findings;
}

function parseCli(argv) {
  const args = new Set(argv.slice(2));
  const allowed = new Set(['--help', '-h']);
  for (const arg of args) if (!allowed.has(arg)) fail(`Unknown argument: ${arg}`);
  if (args.has('--help') || args.has('-h')) {
    console.log('Usage: node scripts/e2e/flow-lint.mjs');
    return null;
  }
  return {};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = parseCli(process.argv);
    if (options) {
      const findings = scanFlows({});
      if (findings.length === 0) {
        console.log('Flow lint clean: no credential-shaped literal and no unknown selector found under .maestro/.');
      } else {
        for (const finding of findings) {
          console.error(`${finding.file}:${finding.line}:${finding.rule}: ${finding.detail}`);
        }
        console.error(`\n${findings.length} finding(s).`);
        process.exit(1);
      }
    }
  } catch (error) {
    console.error(`Flow lint failed: ${error.message}`);
    process.exit(1);
  }
}
