#!/usr/bin/env node
/**
 * Promotes the `node -e "…"` one-liner in `design/mockups/mobile/README.md` to a real, tested
 * script. Loads `mockup-manifest.js` in a `node:vm` sandbox, scans `index.html` markup, and
 * `design/tokens.json` against the mockup's `:root` block, reporting every violation of the
 * mockup PR checklist in `design/mockups/README.md` under ten stable check codes (`M001`–`M010`).
 *
 * Deliberately does not import `scripts/mobile-ui/load-manifest.mjs` — see implementation plan
 * Decision 2. That loader's `loadManifest(root)` signature cannot point at a fixture directory,
 * which the planted-violation tests here require.
 *
 * Public surface: `verifyMockup({ mockupDir, tokensPath })`, pure — reads files, returns
 * findings, never calls `process.exit`. The CLI wrapper below owns process exit codes.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';

const FORBIDDEN_STATE_FIELDS = ['screen_id', 'route', 'dom_id', 'nav_screen', 'kind', 'states'];
const TOTAL_CHECKS = 10;

/**
 * Evaluates `manifestPath` — a classic `<script>`-tag file, not JSON — in a sandboxed `node:vm`
 * context and returns `window.__MOCKUP_MANIFEST__`. Throws for every `M001` failure mode: file
 * missing, syntax error, or a missing/malformed `window.__MOCKUP_MANIFEST__` assignment.
 */
export function loadManifest(manifestPath) {
  let source;
  try {
    source = fs.readFileSync(manifestPath, 'utf8');
  } catch (error) {
    throw new Error(`failed to read manifest at "${manifestPath}": ${error.message}`);
  }
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  try {
    new vm.Script(source, { filename: manifestPath }).runInContext(sandbox, { timeout: 2000 });
  } catch (error) {
    throw new Error(`manifest at "${manifestPath}" failed to evaluate: ${error.message}`);
  }
  const manifest = sandbox.window.__MOCKUP_MANIFEST__;
  if (
    manifest == null ||
    typeof manifest !== 'object' ||
    !Array.isArray(manifest.screens) ||
    manifest.screens.length === 0
  ) {
    throw new Error(
      `manifest at "${manifestPath}" did not assign window.__MOCKUP_MANIFEST__ to an object ` +
        'with a non-empty "screens" array',
    );
  }
  return manifest;
}

/**
 * Blanks out `<script>…</script>` blocks and `<!-- … -->` comments, replacing each with
 * equal-length whitespace so a match offset in the returned text still maps to the same offset —
 * and therefore the same line number — in the original file (implementation plan Decision 5).
 */
export function stripNonMarkup(html) {
  const blank = (match) => match.replace(/[^\n]/g, ' ');
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, blank)
    .replace(/<!--[\s\S]*?-->/g, blank);
}

/** Recursively collects every `screen_id` in the `navigation[].items[]` tree. */
export function collectNavScreenIds(navigation) {
  const ids = [];
  const walk = (items) => {
    for (const item of items || []) {
      if (item && item.screen_id) {
        ids.push(item.screen_id);
      }
      if (item && Array.isArray(item.items)) {
        walk(item.items);
      }
    }
  };
  for (const group of navigation || []) {
    walk(group && group.items);
  }
  return ids;
}

/** The DOM node id a screen is expected to render as: an explicit `dom_id`, or `s-{screen_id}`. */
export function domIdFor(screen) {
  return screen.dom_id ?? `s-${screen.screen_id}`;
}

/**
 * Normalises a CSS value for comparison: lower-cases it, strips all whitespace, and rewrites
 * leading-zero-less decimals (`.45` → `0.45`) so `rgba(15, 23, 42, .45)` and
 * `rgba(15,23,42,0.45)` compare equal (implementation plan Decision 4).
 */
export function normalizeCssValue(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/(\d)?\.(\d+)/g, (_match, intPart, fracPart) => `${intPart || '0'}.${fracPart}`);
}

/** Builds a sorted list of newline offsets so a character offset can be converted to a line. */
function buildLineIndex(text) {
  const offsets = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      offsets.push(i + 1);
    }
  }
  return offsets;
}

/** Binary-searches `lineOffsets` for the 1-based line number containing `offset`. */
function lineForOffset(lineOffsets, offset) {
  let lo = 0;
  let hi = lineOffsets.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (lineOffsets[mid] <= offset) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo + 1;
}

/** Ordered `<section class="app-screen" id="…">` boundaries, derived from start offsets only, so
 * a nested plain `<section>` element never splits a screen. */
function findSections(markup) {
  const re = /<section\s+class="app-screen"\s+id="([^"]+)"/g;
  const starts = [];
  let match;
  while ((match = re.exec(markup))) {
    starts.push({ id: match[1], start: match.index });
  }
  return starts.map((entry, index) => ({
    id: entry.id,
    start: entry.start,
    end: index + 1 < starts.length ? starts[index + 1].start : markup.length,
  }));
}

/**
 * Parses the balanced argument list of a `go(...)` call starting right after its opening `(`.
 * Tracks paren depth and string-quote state so a nested call (e.g. `getElementById('x')`) inside
 * an argument does not end the scan early. Returns `null` when the parens never balance.
 */
function parseCallArgs(text, start) {
  let depth = 1;
  let i = start;
  let current = '';
  let quote = null;
  const args = [];
  while (i < text.length && depth > 0) {
    const ch = text[i];
    if (quote) {
      current += ch;
      if (ch === quote) {
        quote = null;
      }
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      current += ch;
    } else if (ch === '(') {
      depth++;
      current += ch;
    } else if (ch === ')') {
      depth--;
      if (depth > 0) {
        current += ch;
      }
    } else if (ch === ',' && depth === 1) {
      args.push(current);
      current = '';
    } else {
      current += ch;
    }
    i++;
  }
  if (depth !== 0) {
    return null;
  }
  if (current.trim().length > 0 || args.length > 0) {
    args.push(current);
  }
  return { args, end: i };
}

/** Matches a single-quoted string literal like `'home'`, trimmed of surrounding whitespace. */
function literalOf(raw) {
  if (raw == null) {
    return null;
  }
  const match = raw.trim().match(/^'([a-z0-9-]+)'$/);
  return match ? match[1] : null;
}

// M001 is handled inline in verifyMockup — it is a precondition, not a standalone check
// function, because every later check needs the manifest it produces.

function checkNavTargets(manifest, screenIds) {
  const violations = [];
  for (const id of collectNavScreenIds(manifest.navigation)) {
    if (!screenIds.has(id)) {
      violations.push({ code: 'M002', message: `navigation references unknown screen "${id}"` });
    }
  }
  return violations;
}

function checkScreenIdsUnique(screens) {
  const violations = [];
  const seen = new Set();
  for (const screen of screens) {
    const id = screen.screen_id;
    if (!id) {
      violations.push({ code: 'M003', message: 'a screen is missing a non-empty screen_id' });
      continue;
    }
    if (seen.has(id)) {
      violations.push({ code: 'M003', message: `duplicate screen_id "${id}"` });
    }
    seen.add(id);
    if (!screen.route) {
      violations.push({ code: 'M003', message: `screen "${id}" is missing a non-empty route` });
    }
  }
  return violations;
}

function checkStateIdsUnique(screens) {
  const violations = [];
  for (const screen of screens) {
    const states = Array.isArray(screen.states) ? screen.states : [];
    const seen = new Set();
    for (const state of states) {
      const id = state.state_id;
      if (!id) {
        violations.push({
          code: 'M004',
          message: `screen "${screen.screen_id}" has a state missing a non-empty state_id`,
        });
        continue;
      }
      if (seen.has(id)) {
        violations.push({
          code: 'M004',
          message: `screen "${screen.screen_id}" has a duplicate state_id "${id}"`,
        });
      }
      seen.add(id);
    }
  }
  return violations;
}

function checkSingleInitial(screens) {
  const violations = [];
  for (const screen of screens) {
    const states = screen.states;
    if (!Array.isArray(states) || states.length === 0) {
      continue;
    }
    const initialCount = states.filter((state) => state.initial === true).length;
    if (initialCount !== 1) {
      violations.push({
        code: 'M005',
        message: `screen "${screen.screen_id}" has ${initialCount} initial states, expected exactly 1`,
      });
    }
  }
  return violations;
}

function checkStateHasNoScreenFields(screens) {
  const violations = [];
  for (const screen of screens) {
    const states = Array.isArray(screen.states) ? screen.states : [];
    for (const state of states) {
      for (const field of FORBIDDEN_STATE_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(state, field)) {
          violations.push({
            code: 'M006',
            message: `screen "${screen.screen_id}" state "${state.state_id}" declares screen-level field "${field}"`,
          });
        }
      }
    }
  }
  return violations;
}

function checkDomParity(screens, sections) {
  const violations = [];
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const expectedIds = new Set();
  for (const screen of screens) {
    if (screen.kind === 'image') {
      continue;
    }
    const domId = domIdFor(screen);
    expectedIds.add(domId);
    if (!sectionById.has(domId)) {
      violations.push({
        code: 'M007',
        message: `screen "${screen.screen_id}" has no DOM node (expected <section id="${domId}">)`,
      });
    }
  }
  for (const section of sections) {
    if (!expectedIds.has(section.id)) {
      violations.push({
        code: 'M007',
        message: `orphan DOM node "${section.id}" has no matching screen`,
        offset: section.start,
      });
    }
  }
  return violations;
}

function checkDataStatesAndGoTargets(screens, sections, markup, screenIds) {
  const violations = [];
  const domIdToScreen = new Map();
  for (const screen of screens) {
    if (screen.kind === 'image') {
      continue;
    }
    domIdToScreen.set(domIdFor(screen), screen);
  }

  const dataStatesRe = /data-states="([^"]*)"/g;
  const goRe = /(?<![A-Za-z0-9_])go\(/g;

  for (const section of sections) {
    const screen = domIdToScreen.get(section.id);
    const declaredStates =
      screen && Array.isArray(screen.states) ? screen.states.map((state) => state.state_id) : [];
    const screenLabel = screen ? screen.screen_id : section.id;
    const sectionText = markup.slice(section.start, section.end);

    dataStatesRe.lastIndex = 0;
    let dataStatesMatch;
    while ((dataStatesMatch = dataStatesRe.exec(sectionText))) {
      const tokens = dataStatesMatch[1].split(/\s+/).filter(Boolean);
      for (const token of tokens) {
        if (!declaredStates.includes(token)) {
          violations.push({
            code: 'M008',
            message: `screen "${screenLabel}" has undeclared data-states value "${token}"`,
            offset: section.start + dataStatesMatch.index,
          });
        }
      }
    }

    goRe.lastIndex = 0;
    let goMatch;
    while ((goMatch = goRe.exec(sectionText))) {
      const parsed = parseCallArgs(sectionText, goMatch.index + goMatch[0].length);
      if (!parsed) {
        continue;
      }
      const offset = section.start + goMatch.index;
      const targetScreenId = literalOf(parsed.args[0]);
      if (!targetScreenId) {
        // Defensive: a go() call whose first argument is not a string literal is not one of
        // the calls this checklist item covers (none exist in markup today).
        continue;
      }
      if (!screenIds.has(targetScreenId)) {
        violations.push({
          code: 'M009',
          message: `go() targets unknown screen "${targetScreenId}"`,
          offset,
        });
        continue;
      }
      if (parsed.args.length > 1) {
        const targetStateId = literalOf(parsed.args[1]);
        if (targetStateId) {
          const targetScreen = screens.find((s) => s.screen_id === targetScreenId);
          const targetStates =
            targetScreen && Array.isArray(targetScreen.states)
              ? targetScreen.states.map((state) => state.state_id)
              : [];
          if (!targetStates.includes(targetStateId)) {
            violations.push({
              code: 'M009',
              message: `go() targets unknown state "${targetStateId}" for screen "${targetScreenId}"`,
              offset,
            });
          }
        }
        // A non-literal second argument (e.g. a ternary) is validated on the screen only —
        // the one call in the real mockup that does this (index.html connect-bank-intro) is
        // computed at runtime and cannot be checked statically.
      }
    }
  }
  return violations;
}

/** Recursively collects every leaf under `node`, skipping `$`-prefixed metadata keys. */
function collectColorLeaves(node, prefix) {
  const leaves = [];
  for (const [key, value] of Object.entries(node || {})) {
    if (key.startsWith('$')) {
      continue;
    }
    const leafPath = `${prefix}.${key}`;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      leaves.push(...collectColorLeaves(value, leafPath));
    } else {
      leaves.push([leafPath, value]);
    }
  }
  return leaves;
}

function checkTokensMirrored(html, tokens) {
  const violations = [];
  const rootMatch = html.match(/:root\s*\{([\s\S]*?)\}/);
  if (!rootMatch) {
    violations.push({ code: 'M010', message: 'no :root block found in index.html' });
    return violations;
  }
  const rootValues = new Set();
  const varRe = /--[a-zA-Z0-9-]+\s*:\s*([^;]+);/g;
  let varMatch;
  while ((varMatch = varRe.exec(rootMatch[1]))) {
    rootValues.add(normalizeCssValue(varMatch[1]));
  }

  const colorLeaves = collectColorLeaves(tokens.colors, 'colors');
  const semanticLeaves = colorLeaves.filter(
    ([leafPath]) => leafPath !== 'colors.palette' && !leafPath.startsWith('colors.palette.'),
  );
  for (const [leafPath, value] of semanticLeaves) {
    if (!rootValues.has(normalizeCssValue(value))) {
      violations.push({
        code: 'M010',
        message: `token "${leafPath}" (value "${value}") is not mirrored in the :root block of index.html`,
      });
    }
  }
  return violations;
}

/**
 * Verifies a mockup against the mockup PR checklist. Pure: reads `mockupDir`'s
 * `mockup-manifest.js` and `index.html`, plus `tokensPath`, and returns findings — never calls
 * `process.exit`.
 *
 * @param {{ mockupDir: string, tokensPath: string }} options
 * @returns {{ violations: Array<{ code: string, message: string }>, stats: { screens: number, states: number, checks: number } }}
 */
export function verifyMockup({ mockupDir, tokensPath }) {
  const manifestPath = path.join(mockupDir, 'mockup-manifest.js');
  const htmlPath = path.join(mockupDir, 'index.html');

  let manifest;
  try {
    manifest = loadManifest(manifestPath);
  } catch (error) {
    return {
      violations: [{ code: 'M001', message: error.message }],
      stats: { screens: 0, states: 0, checks: TOTAL_CHECKS },
    };
  }

  const screens = manifest.screens;
  const screenIds = new Set(screens.map((screen) => screen.screen_id).filter(Boolean));
  const violations = [
    ...checkNavTargets(manifest, screenIds),
    ...checkScreenIdsUnique(screens),
    ...checkStateIdsUnique(screens),
    ...checkSingleInitial(screens),
    ...checkStateHasNoScreenFields(screens),
  ];

  const html = fs.readFileSync(htmlPath, 'utf8');
  const markup = stripNonMarkup(html);
  const sections = findSections(markup);
  const lineOffsets = buildLineIndex(html);

  for (const violation of [
    ...checkDomParity(screens, sections),
    ...checkDataStatesAndGoTargets(screens, sections, markup, screenIds),
  ]) {
    if (violation.offset != null) {
      const { offset, ...rest } = violation;
      violations.push({ ...rest, message: `${rest.message} (index.html:${lineForOffset(lineOffsets, offset)})` });
    } else {
      violations.push(violation);
    }
  }

  const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
  violations.push(...checkTokensMirrored(html, tokens));

  const totalStates = screens.reduce(
    (count, screen) => count + (Array.isArray(screen.states) ? screen.states.length : 0),
    0,
  );
  return {
    violations,
    stats: { screens: screens.length, states: totalStates, checks: TOTAL_CHECKS },
  };
}

function parseCliArgs(argv) {
  const options = { mockupDir: 'design/mockups/mobile', tokensPath: 'design/tokens.json' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--mockup-dir') {
      options.mockupDir = argv[++i];
    } else if (argv[i] === '--tokens') {
      options.tokensPath = argv[++i];
    }
  }
  return options;
}

function runCli() {
  const { mockupDir, tokensPath } = parseCliArgs(process.argv.slice(2));
  const { violations, stats } = verifyMockup({ mockupDir, tokensPath });
  for (const violation of violations) {
    console.log(`${violation.code}  ${violation.message}`);
  }
  if (violations.length === 0) {
    console.log(`OK — ${stats.screens} screens, ${stats.states} states, ${stats.checks} checks passed`);
    process.exitCode = 0;
  } else {
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    runCli();
  } catch (error) {
    console.error(`verify-manifest failed: ${error.message}`);
    process.exitCode = 1;
  }
}
