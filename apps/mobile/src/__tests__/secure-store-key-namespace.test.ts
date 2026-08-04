import fs from 'node:fs';
import path from 'node:path';

/**
 * AC1 residual verification (implementation plan for issue #19, Decision 2): the claim
 * "`bank_creds:<institutionId>` is the only key namespace this app ever writes" is what makes
 * `collectCredentialKeys`'s derivation (`src/features/settings/wipe-local-data.ts`) a *complete*
 * cover of the written key space, rather than a guess. This scanner holds that claim mechanically
 * — every `setItem(` call site under `src/**` must pass a key produced by
 * `credentialsKeyFor(...)`, or be on the allowlist.
 *
 * Edge-case enumeration K1-K8 from the implementation plan's Testing Strategy → Parser-risk
 * addendum. Suppression is an explicit, reviewable allowlist constant (`ALLOWLISTED_FILES`) —
 * repository-relative paths only, no globs, no regexes, no per-line escapes — and the allowlist
 * itself is asserted to contain only files that still exist, so it cannot rot into references to
 * deleted files.
 */

const ROOT = path.resolve(__dirname, '..');

/** The one allowed hand-built `setItem(key, ...)` call site: `credentialsKeyFor`'s own
 * definition and its direct callers inside `credential-store.ts` (K5). */
const ALLOWLISTED_FILES: readonly string[] = ['src/lib/secure-store/credential-store.ts'];

/** This file's own planted-violation fixtures (K1-K8 below) are `setItem(`-shaped source-text
 * strings by design — they would otherwise trip the very scan this suite runs over every other
 * file (mirrors `secure-store-boundary.test.ts`'s `SELF_EXCLUDED_PATHS`). */
const SELF_EXCLUDED_PATHS = [path.resolve(__filename)];

function listSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listSourceFiles(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

/** A parameter-list declaration's first entry looks like `key: string` — an identifier
 * immediately followed by a `:` type annotation. A real call's first argument (a string literal,
 * a bare identifier with no colon, or a `credentialsKeyFor(...)` call) never has this shape in
 * this codebase's style, so this is what tells `setItem(key: string, value: string): …` (an
 * interface member or a method-shorthand definition, e.g. `expo-secure-store.adapter.ts`) apart
 * from an actual call site. */
function isDeclarationParameter(firstArg: string): boolean {
  return /^[A-Za-z_$][\w$]*\s*:/.test(firstArg);
}

/**
 * Finds every `setItem(<firstArg>, ...)` **call site** and returns the first-argument text,
 * whitespace collapsed (K7: a call spread across multiple lines must still be read as one).
 * Declarations (`isDeclarationParameter`) are excluded — this scanner holds a claim about what
 * the app *calls*, not about a port's own method signatures. This is a lightweight brace-matching
 * scan, not a full parser — sufficient for this codebase's one `setItem` API (K6: there is no
 * other `setItem` receiver anywhere in this repository, by design).
 */
function findSetItemFirstArgs(source: string): string[] {
  const args: string[] = [];
  const callPattern = /\bsetItem\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = callPattern.exec(source)) !== null) {
    const start = match.index + match[0].length;
    let depth = 1;
    let i = start;
    for (; i < source.length && depth > 0; i += 1) {
      if (source[i] === '(') depth += 1;
      else if (source[i] === ')') depth -= 1;
    }
    const inside = source.slice(start, i - 1);
    const commaIndex = findTopLevelComma(inside);
    const firstArg = commaIndex === -1 ? inside : inside.slice(0, commaIndex);
    const normalized = firstArg.replace(/\s+/g, ' ').trim();
    if (!isDeclarationParameter(normalized)) {
      args.push(normalized);
    }
  }
  return args;
}

/** Finds the first comma at paren/bracket/brace depth 0, so a nested call's own commas (e.g.
 * `credentialsKeyFor(a, b)`, not that this repository has one, but defensively) do not split the
 * first argument early. */
function findTopLevelComma(text: string): number {
  let depth = 0;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '(' || char === '[' || char === '{') depth += 1;
    else if (char === ')' || char === ']' || char === '}') depth -= 1;
    else if (char === ',' && depth === 0) return i;
  }
  return -1;
}

/** A first argument is "in the namespace" only if it is exactly a `credentialsKeyFor(...)` call
 * — a hand-built string that happens to produce the same value (K3) or an opaque variable (K4)
 * are both rejected, because neither can be *shown* to be in the namespace by this scan. */
function isCredentialsKeyForCall(firstArg: string): boolean {
  return /^credentialsKeyFor\s*\(/.test(firstArg);
}

describe('the credential key namespace is closed — every setItem() call passes credentialsKeyFor(...) (AC1 residual verification, Decision 2)', () => {
  it('every entry in ALLOWLISTED_FILES resolves to an existing file (the allowlist cannot rot)', () => {
    for (const relativePath of ALLOWLISTED_FILES) {
      const fullPath = path.resolve(ROOT, '..', relativePath);
      expect(fs.existsSync(fullPath)).toBe(true);
    }
  });

  const files = listSourceFiles(ROOT);

  it('found at least one file to scan (a broken file walk must not make this vacuously pass)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  const scannable = files.filter((file) => {
    const relative = path.relative(path.resolve(ROOT, '..'), file).replace(/\\/g, '/');
    return !ALLOWLISTED_FILES.includes(relative) && !SELF_EXCLUDED_PATHS.includes(path.resolve(file));
  });

  it.each(scannable.map((file) => [path.relative(process.cwd(), file), file] as const))(
    '%s only calls setItem() with a credentialsKeyFor(...) key',
    (_label, file) => {
      const source = fs.readFileSync(file, 'utf8');
      const args = findSetItemFirstArgs(source);
      const offenders = args.filter((arg) => !isCredentialsKeyForCall(arg));
      expect(offenders).toEqual([]);
    },
  );

  describe('scanner edge cases (K1-K8)', () => {
    it('K1: port.setItem(credentialsKeyFor(id), value) is allowed', () => {
      expect(findSetItemFirstArgs('port.setItem(credentialsKeyFor(id), value);')).toEqual([
        'credentialsKeyFor(id)',
      ]);
    });

    it('K2: await secureStore.setItem(credentialsKeyFor(institutionId), payload) is allowed — receiver name is irrelevant', () => {
      const args = findSetItemFirstArgs('await secureStore.setItem(credentialsKeyFor(institutionId), payload);');
      expect(args.every(isCredentialsKeyForCall)).toBe(true);
    });

    it('K3: port.setItem(\'bank_creds:\' + id, value) is flagged — a hand-built key bypasses the generator', () => {
      const args = findSetItemFirstArgs("port.setItem('bank_creds:' + id, value);");
      expect(args.every(isCredentialsKeyForCall)).toBe(false);
    });

    it('K4: port.setItem(someKey, value) is flagged — an opaque variable cannot be shown to be in the namespace', () => {
      const args = findSetItemFirstArgs('port.setItem(someKey, value);');
      expect(args.every(isCredentialsKeyForCall)).toBe(false);
    });

    it('K5: setItem(key, value) inside credential-store.ts is allowed by the allowlist, not the pattern', () => {
      expect(ALLOWLISTED_FILES).toContain('src/lib/secure-store/credential-store.ts');
    });

    it('K6: localStorage.setItem(...) / map.setItem(...) in unrelated code is flagged deliberately — this repository has no other setItem API', () => {
      const args = findSetItemFirstArgs("localStorage.setItem('theme', 'dark');");
      expect(args.every(isCredentialsKeyForCall)).toBe(false);
    });

    it('K7: a call spread across three lines is read as one', () => {
      const source = 'port.setItem(\n  credentialsKeyFor(id),\n  value,\n);';
      expect(findSetItemFirstArgs(source)).toEqual(['credentialsKeyFor(id)']);
    });

    it('K8: an empty file walk must fail, not vacuously pass (covered by the "found at least one file to scan" assertion above)', () => {
      expect(files.length).toBeGreaterThan(0);
    });

    it('a typed parameter list (an interface member or a method-shorthand definition) is not treated as a call site', () => {
      expect(findSetItemFirstArgs('setItem(key: string, value: string): Promise<void>;')).toEqual([]);
      expect(
        findSetItemFirstArgs('setItem(key: string, value: string): Promise<void> {\n  return real.setItemAsync(key, value);\n}'),
      ).toEqual([]);
    });
  });
});
