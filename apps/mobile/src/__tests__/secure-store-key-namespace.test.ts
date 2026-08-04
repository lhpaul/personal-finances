import fs from 'node:fs';
import path from 'node:path';

import { DB_KEY_STORAGE_KEY } from '../db/encryption/constants';

/**
 * AC1 residual verification (implementation plan for issue #19, Decision 2 — widened by issue
 * #25's Decision 11): the claim "every `setItem(` call site under `src/**` writes into one of the
 * two namespaces `collectSecureStoreKeys` (`src/features/settings/wipe-local-data.ts`) covers" is
 * what makes that function's derivation a *complete* cover of the written key space, rather than
 * a guess. This scanner holds that claim mechanically — every `setItem(` call site must pass
 * either a key produced by `credentialsKeyFor(...)` (the original namespace, #9) or the bare
 * `DB_KEY_STORAGE_KEY` identifier (the database key, #25), or be on the allowlist.
 *
 * Edge-case enumeration K1-K8 (the original credential-namespace cases) plus E1-E5 (issue #25's
 * parser-risk addendum for the widened matcher) from the implementation plan's Testing Strategy →
 * Parser-risk addendum. Suppression is an explicit, reviewable allowlist constant
 * (`ALLOWLISTED_FILES`) — repository-relative paths only, no globs, no regexes, no per-line
 * escapes — and the allowlist itself is asserted to contain only files that still exist, so it
 * cannot rot into references to deleted files.
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

/** A first argument is "in the credential namespace" only if it is exactly a
 * `credentialsKeyFor(...)` call — a hand-built string that happens to produce the same value (K3)
 * or an opaque variable (K4) are both rejected, because neither can be *shown* to be in the
 * namespace by this scan. */
function isCredentialsKeyForCall(firstArg: string): boolean {
  return /^credentialsKeyFor\s*\(/.test(firstArg);
}

/** A first argument is "in the database-key namespace" (issue #25, Decision 11) only if it is
 * exactly the bare `DB_KEY_STORAGE_KEY` identifier — a hard-coded literal reproducing the same
 * string (E3) or a template literal built from it (E5) are both rejected for the same reason K3
 * rejects a hand-built credential key: neither can be *shown* to be the constant by this scan. */
function isDbKeyStorageKeyIdentifier(firstArg: string): boolean {
  return firstArg === 'DB_KEY_STORAGE_KEY';
}

/** The widened acceptance check (issue #25, Decision 11 point 2): either namespace's own
 * constructor, nothing else. */
function isAcceptedKeyArgument(firstArg: string): boolean {
  return isCredentialsKeyForCall(firstArg) || isDbKeyStorageKeyIdentifier(firstArg);
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
    '%s only calls setItem() with a credentialsKeyFor(...) or DB_KEY_STORAGE_KEY key',
    (_label, file) => {
      const source = fs.readFileSync(file, 'utf8');
      const args = findSetItemFirstArgs(source);
      const offenders = args.filter((arg) => !isAcceptedKeyArgument(arg));
      expect(offenders).toEqual([]);
    },
  );

  it('collectSecureStoreKeys covers both namespaces — the credential keys and DB_KEY_STORAGE_KEY (issue #25, Decision 11)', () => {
    // A dynamic require, not a static import, avoids a module-load-order risk between this
    // scanner and the feature module it is verifying a claim about.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { collectSecureStoreKeys } = require('../features/settings/wipe-local-data') as {
      collectSecureStoreKeys: (db: unknown) => string[];
    };
    // A minimal fake `AppDatabase`-shaped object is enough: `collectCredentialKeys`'s two
    // Drizzle reads both resolve to an empty array against it, so this only exercises the
    // DB_KEY_STORAGE_KEY half — the credential half is `wipe-local-data.node.test.ts`'s job
    // (scenario 4).
    const fakeDb = {
      select: () => ({
        from: () => ({ all: () => [], orderBy: () => ({ all: () => [] }) }),
      }),
    };
    const keys = collectSecureStoreKeys(fakeDb);
    expect(keys).toContain(DB_KEY_STORAGE_KEY);
  });

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

  describe('scanner edge cases for the widened database-key namespace (E1-E5, issue #25 Decision 11)', () => {
    it('E1: port.setItem(credentialsKeyFor(id), value) is still accepted (unchanged #9 behaviour)', () => {
      const args = findSetItemFirstArgs('port.setItem(credentialsKeyFor(id), value);');
      expect(args.every(isAcceptedKeyArgument)).toBe(true);
    });

    it('E2: port.setItem(DB_KEY_STORAGE_KEY, keyHex) is accepted', () => {
      const args = findSetItemFirstArgs('port.setItem(DB_KEY_STORAGE_KEY, keyHex);');
      expect(args).toEqual(['DB_KEY_STORAGE_KEY']);
      expect(args.every(isAcceptedKeyArgument)).toBe(true);
    });

    it("E3: port.setItem('db_key.main', keyHex) is rejected — a hard-coded literal bypasses the constant", () => {
      const args = findSetItemFirstArgs("port.setItem('db_key.main', keyHex);");
      expect(args.every(isAcceptedKeyArgument)).toBe(false);
    });

    it('E4: port.setItem(someOtherKey, value) is rejected — an unknown third namespace', () => {
      const args = findSetItemFirstArgs('port.setItem(someOtherKey, value);');
      expect(args.every(isAcceptedKeyArgument)).toBe(false);
    });

    it('E5: port.setItem(`db_key.${scope}`, value) is rejected — a template literal is not an enumerable namespace', () => {
      const args = findSetItemFirstArgs('port.setItem(`db_key.${scope}`, value);');
      expect(args.every(isAcceptedKeyArgument)).toBe(false);
    });

    it('a call split across lines with DB_KEY_STORAGE_KEY is read as one (mirrors K7)', () => {
      const source = 'setItem(\n  DB_KEY_STORAGE_KEY,\n  keyHex,\n)';
      expect(findSetItemFirstArgs(source)).toEqual(['DB_KEY_STORAGE_KEY']);
    });

    it('deleteItem(DB_KEY_STORAGE_KEY) is not a setItem call site and is ignored by this scanner', () => {
      expect(findSetItemFirstArgs('deleteItem(DB_KEY_STORAGE_KEY);')).toEqual([]);
    });
  });
});
