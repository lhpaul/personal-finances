import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import { verifyMockup } from './verify-manifest.mjs';

// ---------------------------------------------------------------------------
// Good synthetic fixture — three screens (Seed Data in the implementation plan):
//   - `home`: stateful, states `filled` (initial) / `empty`
//   - `about`: stateless (no `states` key), contains a nested plain `<section>` and the
//     "negative lookalike" decoys
//   - `profile`: declares an explicit `dom_id` that is not `s-{screen_id}`
// The `index.html` also carries every decoy shape the parser-risk addendum enumerates:
// a `<script>` block whose comment contains `data-states="a b"` and `go(screenId, stateId)`,
// an HTML-comment decoy, a computed `go()` state argument, two `data-states` on one line, two
// `go()` calls on one line, and a `:root` block followed by a nested `@media` block.
// `tokens.json` mirrors three semantic colours (one exercising rgba leading-zero normalisation,
// one exercising hex-case normalisation) and one `colors.palette.*` leaf deliberately absent
// from `:root`.
// ---------------------------------------------------------------------------

const GOOD_MANIFEST_JS = `window.__MOCKUP_MANIFEST__ = {
  $status: 'complete',
  screens: [
    {
      screen_id: 'home',
      route: '/home',
      nav_screen: 'home',
      kind: 'html',
      states: [
        { state_id: 'filled', label: 'Filled', initial: true },
        { state_id: 'empty', label: 'Empty' },
      ],
    },
    {
      screen_id: 'about',
      route: '/about',
      kind: 'html',
    },
    {
      screen_id: 'profile',
      route: '/profile',
      kind: 'html',
      dom_id: 'custom-profile-node',
    },
  ],
  navigation: [
    {
      label: 'Main',
      items: [
        { screen_id: 'home' },
        { screen_id: 'about' },
        { screen_id: 'profile' },
      ],
    },
  ],
};
`;

const GOOD_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
<style>
:root {
  --brand: #6366f1;
  --overlay-scrim: rgba(15, 23, 42, .45);
  --accent: #ABCDEF;
}

@media (max-width: 600px) {
  .nested { color: red; }
}
</style>
</head>
<body>

<!-- <div data-states="nope"></div> -->

<section class="app-screen" id="s-home">
  <div data-states="filled   empty"></div>
  <div data-states="filled"></div><div data-states="empty"></div>
  <div data-statesX="ignored"></div>
  <button onclick="go('about')">About</button><button onclick="go('profile')">Profile</button>
  <button onclick="cargo('nonexistent')">Decoy</button>
  <button onclick="go('home', flag ? 'filled' : 'empty')">Toggle</button>
</section>

<section class="app-screen" id="s-about">
  <p>About screen, no states.</p>
  <section>
    <p>Nested plain section — must not split the "about" screen.</p>
  </section>
  <button onclick="go('home')">Home</button>
  <button onclick="go('home', 'filled')">Home Filled</button>
</section>

<section class="app-screen" id="custom-profile-node">
  <p>Profile screen with explicit dom_id.</p>
</section>

<script>
  // decoy comment: data-states="a b"
  // decoy comment: go(screenId, stateId)
</script>

</body>
</html>
`;

const GOOD_TOKENS_JSON = JSON.stringify(
  {
    colors: {
      brandPrimary: '#6366f1',
      overlayScrim: 'rgba(15, 23, 42, 0.45)',
      accent: '#abcdef',
      palette: {
        blue: {
          500: '#3b82f6',
        },
      },
    },
  },
  null,
  2,
);

const createdDirs = [];

after(() => {
  for (const dir of createdDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/** Writes a fixture (manifest + html + tokens) to a fresh temp directory and returns its paths. */
function writeFixture({
  manifestJs = GOOD_MANIFEST_JS,
  html = GOOD_HTML,
  tokensJson = GOOD_TOKENS_JSON,
} = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-manifest-'));
  createdDirs.push(dir);
  const mockupDir = path.join(dir, 'mockup');
  fs.mkdirSync(mockupDir, { recursive: true });
  fs.writeFileSync(path.join(mockupDir, 'mockup-manifest.js'), manifestJs);
  fs.writeFileSync(path.join(mockupDir, 'index.html'), html);
  const tokensPath = path.join(dir, 'tokens.json');
  fs.writeFileSync(tokensPath, tokensJson);
  return { mockupDir, tokensPath };
}

/** Replaces `search` with `replacement` in `text`, failing loudly if `search` is not found. */
function mustReplace(text, search, replacement) {
  assert.ok(text.includes(search), `fixture anchor not found: ${JSON.stringify(search)}`);
  return text.replace(search, replacement);
}

function codesOf(violations) {
  return violations.map((v) => v.code);
}

// ---------------------------------------------------------------------------
// Scenario 1 — the real mockup (brief AC 1)
// ---------------------------------------------------------------------------

test('real mockup passes with no false positives', () => {
  const { violations, stats } = verifyMockup({
    mockupDir: 'design/mockups/mobile',
    tokensPath: 'design/tokens.json',
  });
  assert.deepEqual(violations, []);
  assert.equal(stats.screens, 36);
  assert.equal(stats.states, 78);
});

// ---------------------------------------------------------------------------
// Scenario 2 — the good synthetic fixture passes
// ---------------------------------------------------------------------------

test('good synthetic fixture passes with no violations', () => {
  const { violations, stats } = verifyMockup(writeFixture());
  assert.deepEqual(violations, []);
  assert.equal(stats.screens, 3);
  assert.equal(stats.states, 2);
});

// ---------------------------------------------------------------------------
// Planted-violation matrix — both directions for every check.
// ---------------------------------------------------------------------------

test('M001 fires when the manifest does not assign window.__MOCKUP_MANIFEST__', () => {
  const { violations } = verifyMockup(
    writeFixture({ manifestJs: `window.__OTHER__ = {};\n` }),
  );
  assert.equal(violations.length, 1);
  assert.equal(violations[0].code, 'M001');
  assert.match(violations[0].message, /__MOCKUP_MANIFEST__/);
});

test('M002 fires when navigation references a screen that does not exist', () => {
  const manifestJs = mustReplace(
    GOOD_MANIFEST_JS,
    "{ screen_id: 'profile' },\n      ],",
    "{ screen_id: 'profile' },\n        { screen_id: 'ghost-screen' },\n      ],",
  );
  const { violations } = verifyMockup(writeFixture({ manifestJs }));
  assert.deepEqual(codesOf(violations), ['M002']);
  assert.match(violations[0].message, /ghost-screen/);
});

test('M003 fires when two screens share a screen_id', () => {
  const aboutBlock = `    {
      screen_id: 'about',
      route: '/about',
      kind: 'html',
    },`;
  const manifestJs = mustReplace(GOOD_MANIFEST_JS, aboutBlock, `${aboutBlock}\n${aboutBlock}`);
  const { violations } = verifyMockup(writeFixture({ manifestJs }));
  assert.deepEqual(codesOf(violations), ['M003']);
  assert.match(violations[0].message, /duplicate screen_id "about"/);
});

test('M004 fires when a screen has a duplicate state_id', () => {
  const manifestJs = mustReplace(
    GOOD_MANIFEST_JS,
    "        { state_id: 'empty', label: 'Empty' },\n      ],",
    "        { state_id: 'empty', label: 'Empty' },\n        { state_id: 'empty', label: 'Empty (dup)' },\n      ],",
  );
  const { violations } = verifyMockup(writeFixture({ manifestJs }));
  assert.deepEqual(codesOf(violations), ['M004']);
  assert.match(violations[0].message, /"home"/);
  assert.match(violations[0].message, /"empty"/);
});

test('M005a fires with "0 initial states" when no state is initial', () => {
  const manifestJs = mustReplace(
    GOOD_MANIFEST_JS,
    "{ state_id: 'filled', label: 'Filled', initial: true },",
    "{ state_id: 'filled', label: 'Filled' },",
  );
  const { violations } = verifyMockup(writeFixture({ manifestJs }));
  assert.deepEqual(codesOf(violations), ['M005']);
  assert.match(violations[0].message, /0 initial states/);
});

test('M005b fires with "2 initial states" when two states are initial', () => {
  const manifestJs = mustReplace(
    GOOD_MANIFEST_JS,
    "{ state_id: 'empty', label: 'Empty' },",
    "{ state_id: 'empty', label: 'Empty', initial: true },",
  );
  const { violations } = verifyMockup(writeFixture({ manifestJs }));
  assert.deepEqual(codesOf(violations), ['M005']);
  assert.match(violations[0].message, /2 initial states/);
});

test('M006 fires when a state declares a screen-level field', () => {
  const manifestJs = mustReplace(
    GOOD_MANIFEST_JS,
    "{ state_id: 'empty', label: 'Empty' },",
    "{ state_id: 'empty', label: 'Empty', route: '/leaked' },",
  );
  const { violations } = verifyMockup(writeFixture({ manifestJs }));
  assert.deepEqual(codesOf(violations), ['M006']);
  assert.match(violations[0].message, /"empty"/);
  assert.match(violations[0].message, /"route"/);
});

test('M007a fires when a declared screen has no DOM node', () => {
  const aboutSection = `<section class="app-screen" id="s-about">
  <p>About screen, no states.</p>
  <section>
    <p>Nested plain section — must not split the "about" screen.</p>
  </section>
  <button onclick="go('home')">Home</button>
  <button onclick="go('home', 'filled')">Home Filled</button>
</section>

`;
  const html = mustReplace(GOOD_HTML, aboutSection, '');
  const { violations } = verifyMockup(writeFixture({ html }));
  assert.deepEqual(codesOf(violations), ['M007']);
  assert.match(violations[0].message, /"about"/);
  assert.match(violations[0].message, /no DOM node/);
});

test('M007b fires when the markup has an orphan DOM node', () => {
  const html = mustReplace(
    GOOD_HTML,
    '<script>',
    '<section class="app-screen" id="s-orphan"></section>\n\n<script>',
  );
  const { violations } = verifyMockup(writeFixture({ html }));
  assert.deepEqual(codesOf(violations), ['M007']);
  assert.match(violations[0].message, /orphan DOM node "s-orphan"/);
  assert.match(violations[0].message, /index\.html:\d+/);
});

test('M008 fires when a data-states value is not declared', () => {
  const html = mustReplace(
    GOOD_HTML,
    '<div data-states="filled"></div><div data-states="empty"></div>',
    '<div data-states="filled bogus"></div><div data-states="empty"></div>',
  );
  const { violations } = verifyMockup(writeFixture({ html }));
  assert.deepEqual(codesOf(violations), ['M008']);
  assert.match(violations[0].message, /"home"/);
  assert.match(violations[0].message, /"bogus"/);
  assert.match(violations[0].message, /index\.html:\d+/);
});

test('M009a fires when go() targets a screen that does not exist', () => {
  const html = mustReplace(GOOD_HTML, `onclick="go('home')"`, `onclick="go('nowhere')"`);
  const { violations } = verifyMockup(writeFixture({ html }));
  assert.deepEqual(codesOf(violations), ['M009']);
  assert.match(violations[0].message, /"nowhere"/);
  assert.match(violations[0].message, /index\.html:\d+/);
});

test('M009b fires when go() targets a state that does not exist on its screen', () => {
  const html = mustReplace(
    GOOD_HTML,
    `onclick="go('home', 'filled')"`,
    `onclick="go('home', 'nostate')"`,
  );
  const { violations } = verifyMockup(writeFixture({ html }));
  assert.deepEqual(codesOf(violations), ['M009']);
  assert.match(violations[0].message, /"nostate"/);
  assert.match(violations[0].message, /"home"/);
  assert.match(violations[0].message, /index\.html:\d+/);
});

test('M010 fires when a semantic colour value changes without touching :root', () => {
  const tokensJson = mustReplace(GOOD_TOKENS_JSON, '"#6366f1"', '"#123456"');
  const { violations } = verifyMockup(writeFixture({ tokensJson }));
  assert.deepEqual(codesOf(violations), ['M010']);
  assert.match(violations[0].message, /colors\.brandPrimary/);
  assert.match(violations[0].message, /#123456/);
});

// ---------------------------------------------------------------------------
// Must-not-fire matrix — the false-positive shapes this script exists to eliminate.
// ---------------------------------------------------------------------------

test('must-not-fire: <script>-block decoy is not read by M008/M009', () => {
  // The good fixture's <script> block contains data-states="a b" and go(screenId, stateId)
  // in a comment; if stripNonMarkup were missing, both would misfire.
  assert.match(
    GOOD_HTML,
    /<script>[\s\S]*data-states="a b"[\s\S]*go\(screenId, stateId\)[\s\S]*<\/script>/,
    'fixture no longer contains the <script>-block decoy',
  );
  const { violations } = verifyMockup(writeFixture());
  assert.deepEqual(violations, []);
});

test('must-not-fire: HTML-comment decoy is not read by M008', () => {
  // The good fixture contains <!-- <div data-states="nope"> --> ahead of the first section.
  assert.ok(
    GOOD_HTML.includes('<!-- <div data-states="nope"></div> -->'),
    'fixture no longer contains the HTML-comment decoy',
  );
  const { violations } = verifyMockup(writeFixture());
  assert.deepEqual(violations, []);
});

test('must-not-fire: a computed go() second argument is not validated as a state', () => {
  // The good fixture's home section contains go('home', flag ? 'filled' : 'empty').
  assert.ok(
    GOOD_HTML.includes(`go('home', flag ? 'filled' : 'empty')`),
    'fixture no longer contains the computed go() state decoy',
  );
  const { violations } = verifyMockup(writeFixture());
  assert.deepEqual(
    violations.filter((v) => v.code === 'M009'),
    [],
  );
});

test('must-not-fire: colors.palette.* is excluded from M010', () => {
  // The good fixture's tokens.json has colors.palette.blue.500, absent from :root.
  assert.ok(
    GOOD_TOKENS_JSON.includes('"500": "#3b82f6"') && !GOOD_HTML.includes('#3b82f6'),
    'fixture no longer has an unmirrored colors.palette.* leaf',
  );
  const { violations } = verifyMockup(writeFixture());
  assert.deepEqual(
    violations.filter((v) => v.code === 'M010'),
    [],
  );
});

test('must-not-fire: a stateless screen does not require an initial state', () => {
  // The good fixture's "about" screen has no `states` key and no data-states in its section.
  assert.ok(
    GOOD_MANIFEST_JS.includes("      screen_id: 'about',\n      route: '/about',\n      kind: 'html',\n    },"),
    'fixture "about" screen no longer matches the expected stateless shape',
  );
  const aboutSectionOnly = GOOD_HTML.slice(
    GOOD_HTML.indexOf('id="s-about"'),
    GOOD_HTML.indexOf('id="custom-profile-node"'),
  );
  assert.ok(
    !aboutSectionOnly.includes('data-states'),
    'fixture "about" section unexpectedly gained a data-states attribute',
  );
  const { violations } = verifyMockup(writeFixture());
  assert.deepEqual(
    violations.filter((v) => v.code === 'M005'),
    [],
  );
});

// ---------------------------------------------------------------------------
// Parser-risk addendum — edge cases not already covered above.
// Rows 1, 2, 6, and 7 of the addendum are the must-not-fire tests above; the remaining rows
// each get their own test here.
// ---------------------------------------------------------------------------

test('data-states whitespace splitting: multiple spaces, empty tokens dropped', () => {
  // The good fixture's home section has data-states="filled   empty".
  assert.ok(
    GOOD_HTML.includes('data-states="filled   empty"'),
    'fixture no longer contains the multi-space data-states decoy',
  );
  const { violations } = verifyMockup(writeFixture());
  assert.deepEqual(
    violations.filter((v) => v.code === 'M008'),
    [],
  );
});

test('two data-states on one line are both scanned', () => {
  // The good fixture's home section has two adjacent <div data-states="…"> on one line.
  assert.ok(
    GOOD_HTML.includes('<div data-states="filled"></div><div data-states="empty"></div>'),
    'fixture no longer contains the two-data-states-on-one-line decoy',
  );
  const { violations } = verifyMockup(writeFixture());
  assert.deepEqual(
    violations.filter((v) => v.code === 'M008'),
    [],
  );
});

test('two go() calls on one line are both scanned', () => {
  // The good fixture's home section has go('about') and go('profile') in one line.
  assert.ok(
    GOOD_HTML.includes(`onclick="go('about')">About</button><button onclick="go('profile')">`),
    'fixture no longer contains the two-go()-calls-on-one-line decoy',
  );
  const { violations } = verifyMockup(writeFixture());
  assert.deepEqual(
    violations.filter((v) => v.code === 'M009'),
    [],
  );
});

test('negative lookalikes are not matched: data-statesX and cargo(...)', () => {
  // The good fixture's home section has data-statesX="ignored" and onclick="cargo('nonexistent')".
  assert.ok(
    GOOD_HTML.includes('data-statesX="ignored"') && GOOD_HTML.includes(`cargo('nonexistent')`),
    'fixture no longer contains the negative-lookalike decoys',
  );
  const { violations } = verifyMockup(writeFixture());
  assert.deepEqual(violations, []);
});

test('rgba leading-zero normalisation treats .45 and 0.45 as equal', () => {
  // The good fixture's :root uses "rgba(15, 23, 42, .45)"; tokens.json uses "0.45".
  assert.ok(
    GOOD_HTML.includes('rgba(15, 23, 42, .45)') && GOOD_TOKENS_JSON.includes('rgba(15, 23, 42, 0.45)'),
    'fixture no longer exercises rgba leading-zero normalisation',
  );
  const { violations } = verifyMockup(writeFixture());
  assert.deepEqual(
    violations.filter((v) => v.code === 'M010'),
    [],
  );
});

test('hex case normalisation treats #ABCDEF and #abcdef as equal', () => {
  // The good fixture's :root uses "#ABCDEF"; tokens.json uses "#abcdef".
  assert.ok(
    GOOD_HTML.includes('#ABCDEF') && GOOD_TOKENS_JSON.includes('#abcdef'),
    'fixture no longer exercises hex-case normalisation',
  );
  const { violations } = verifyMockup(writeFixture());
  assert.deepEqual(
    violations.filter((v) => v.code === 'M010'),
    [],
  );
});

test('multiple :root blocks are scanned: a value present in neither still reports M010', () => {
  // A dark-mode media query nesting a second, valid :root selector — not a bare declaration
  // directly inside @media, which is invalid CSS and would never be parsed as a :root block.
  const html = mustReplace(
    GOOD_HTML,
    `:root {
  --brand: #6366f1;
  --overlay-scrim: rgba(15, 23, 42, .45);
  --accent: #ABCDEF;
}

@media (max-width: 600px) {
  .nested { color: red; }
}`,
    `:root {
  --brand: #111111;
}

@media (prefers-color-scheme: dark) {
  :root {
    --brand: #222222;
  }
}`,
  );
  const tokensJson = JSON.stringify({ colors: { brandPrimary: '#333333' } });
  const { violations } = verifyMockup(writeFixture({ html, tokensJson }));
  // Neither the outer (#111111) nor the nested dark-mode (#222222) block has #333333.
  assert.deepEqual(codesOf(violations), ['M010']);
  assert.match(violations[0].message, /colors\.brandPrimary/);
});

test('multiple :root blocks are scanned: a value present only in a nested dark-mode block is mirrored', () => {
  const html = mustReplace(
    GOOD_HTML,
    `:root {
  --brand: #6366f1;
  --overlay-scrim: rgba(15, 23, 42, .45);
  --accent: #ABCDEF;
}

@media (max-width: 600px) {
  .nested { color: red; }
}`,
    `:root {
  --brand: #111111;
}

@media (prefers-color-scheme: dark) {
  :root {
    --brand: #222222;
  }
}`,
  );
  const tokensJson = JSON.stringify({ colors: { brandPrimary: '#222222' } });
  const { violations } = verifyMockup(writeFixture({ html, tokensJson }));
  // #222222 only appears in the nested, dark-mode :root block — a scan of the first :root
  // block alone would wrongly report this as unmirrored.
  assert.deepEqual(violations, []);
});

test('nested section element does not split a screen', () => {
  const aboutSection = `<section class="app-screen" id="s-about">
  <p>About screen, no states.</p>
  <section>
    <p>Nested plain section — must not split the "about" screen.</p>
  </section>
  <button onclick="go('home')">Home</button>
  <button onclick="go('home', 'filled')">Home Filled</button>
</section>`;
  const mutatedAboutSection = `<section class="app-screen" id="s-about">
  <p>About screen, no states.</p>
  <section>
    <div data-states="ghost"></div>
  </section>
  <button onclick="go('home')">Home</button>
  <button onclick="go('home', 'filled')">Home Filled</button>
</section>`;
  const html = mustReplace(GOOD_HTML, aboutSection, mutatedAboutSection);
  const { violations } = verifyMockup(writeFixture({ html }));
  // The data-states attribute sits inside a nested plain <section>. It must still be
  // attributed to "about" (which declares no states), not silently dropped.
  assert.deepEqual(codesOf(violations), ['M008']);
  assert.match(violations[0].message, /"about"/);
  assert.match(violations[0].message, /"ghost"/);
});

test('explicit dom_id is honoured', () => {
  // The good fixture's "profile" screen declares dom_id: 'custom-profile-node', not
  // the default s-profile — if dom_id were ignored, M007 would report "no DOM node".
  assert.ok(
    GOOD_MANIFEST_JS.includes("dom_id: 'custom-profile-node'") &&
      GOOD_HTML.includes('id="custom-profile-node"'),
    'fixture no longer declares an explicit dom_id for "profile"',
  );
  const { violations } = verifyMockup(writeFixture());
  assert.deepEqual(
    violations.filter((v) => v.code === 'M007'),
    [],
  );
});

test('manifest syntax error is reported as M001, without crashing', () => {
  const manifestJs = 'window.__MOCKUP_MANIFEST__ = { screens: [ ;;; broken';
  const { violations } = verifyMockup(writeFixture({ manifestJs }));
  assert.deepEqual(codesOf(violations), ['M001']);
  assert.ok(violations[0].message.length > 0);
});

test('an empty states array is not an M005 violation, but a data-states there is still M008', () => {
  const manifestJs = mustReplace(
    GOOD_MANIFEST_JS,
    "    {\n      screen_id: 'about',",
    "    {\n      screen_id: 'empty-states-screen',\n      route: '/empty-states-screen',\n      kind: 'html',\n      states: [],\n    },\n    {\n      screen_id: 'about',",
  );
  const html = mustReplace(
    GOOD_HTML,
    '<section class="app-screen" id="s-about">',
    '<section class="app-screen" id="s-empty-states-screen"><div data-states="ghost"></div></section>\n\n<section class="app-screen" id="s-about">',
  );
  const { violations } = verifyMockup(writeFixture({ manifestJs, html }));
  assert.deepEqual(codesOf(violations), ['M008']);
  assert.match(violations[0].message, /"empty-states-screen"/);
  assert.match(violations[0].message, /"ghost"/);
});

// ---------------------------------------------------------------------------
// CodeRabbit findings on PR #90 — section-tag tolerance, multi-:root scanning (above),
// pure-function error handling, and decoy-presence guards (above).
// ---------------------------------------------------------------------------

test('findSections tolerates reversed attribute order and an additional class', () => {
  const html = mustReplace(
    GOOD_HTML,
    '<section class="app-screen" id="s-about">',
    '<section id="s-about" class="mu-card app-screen">',
  );
  const { violations } = verifyMockup(writeFixture({ html }));
  assert.deepEqual(violations, []);
});

test('a missing index.html is reported as an M007 finding, not a thrown error', () => {
  const { mockupDir, tokensPath } = writeFixture();
  fs.rmSync(path.join(mockupDir, 'index.html'));
  const { violations, stats } = verifyMockup({ mockupDir, tokensPath });
  assert.deepEqual(codesOf(violations), ['M007']);
  assert.match(violations[0].message, /failed to read markup/);
  // Manifest-derived stats are still populated — only the markup-dependent checks are skipped.
  assert.equal(stats.screens, 3);
});

test('a malformed tokens.json is reported as an M010 finding, not a thrown error', () => {
  const { mockupDir, tokensPath } = writeFixture();
  fs.writeFileSync(tokensPath, '{ not valid json');
  const { violations } = verifyMockup({ mockupDir, tokensPath });
  assert.deepEqual(codesOf(violations), ['M010']);
  assert.match(violations[0].message, /failed to load tokens/);
});

test('a null entry in manifest "screens" is reported as an M001 finding, not a thrown error', () => {
  const manifestJs = mustReplace(
    GOOD_MANIFEST_JS,
    'screens: [\n',
    'screens: [\n    null,\n',
  );
  const { violations } = verifyMockup(writeFixture({ manifestJs }));
  assert.deepEqual(codesOf(violations), ['M001']);
  assert.match(violations[0].message, /screens.*1 entry.*not an object/);
});

test('a null entry in a screen\'s "states" is reported as an M004 finding, not a thrown error', () => {
  const manifestJs = mustReplace(
    GOOD_MANIFEST_JS,
    "      states: [\n        { state_id: 'filled', label: 'Filled', initial: true },",
    "      states: [\n        null,\n        { state_id: 'filled', label: 'Filled', initial: true },",
  );
  const { violations } = verifyMockup(writeFixture({ manifestJs }));
  assert.deepEqual(codesOf(violations), ['M004']);
  assert.match(violations[0].message, /"home"/);
  assert.match(violations[0].message, /malformed state entry at index 0/);
});
