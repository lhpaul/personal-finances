import fs from 'node:fs';
import path from 'node:path';

/**
 * Implementation plan (issue #20) Testing Strategy, Scenario 10; Residual verification strategy
 * ("No credential value can reach a log or an error payload"); BR1; Decision 1 ("no DELETE
 * anywhere in this feature"). The repo-wide `expo-secure-store` import boundary
 * (`secure-store-boundary.test.ts`) already covers this folder; this scan adds the guarantees
 * that one does not: no call that could read a credential's plaintext value, no `console.*` call,
 * no `DELETE` against a Drizzle table, and no timer/listener (concurrency checklist: "there are
 * no timers, no subscriptions and no event emitters in this item").
 */
const FEATURE_ROOT = path.resolve(__dirname, '..');

function listSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listSourceFiles(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = listSourceFiles(FEATURE_ROOT);

describe('src/features/banks/** contains no credential-reading call and no console.* (BR1)', () => {
  it('found at least one file to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((file) => [path.relative(FEATURE_ROOT, file), file] as const))(
    '%s calls no readCredentials, no bare getItem, and no console.*',
    (_label, file) => {
      const source = fs.readFileSync(file, 'utf8');
      expect(source).not.toMatch(/\breadCredentials\s*\(/);
      // `getItem(` alone (not `.getItem(` on a port instance, which credential-store.ts itself
      // legitimately calls) would indicate a bare, unauthorized keychain read from this feature —
      // this feature never imports SecureStorePort directly except through disconnectBank's
      // injected `deps.secureStore`, which this scan does not need to special-case because it
      // never calls `.getItem` at all (only `.deleteItem`, via `deleteCredentials`).
      expect(source).not.toMatch(/[^.]\bgetItem\s*\(/);
      expect(source).not.toMatch(/console\s*\./);
    },
  );
});

describe('src/features/banks/** issues no DELETE against a Drizzle table (Decision 1, BR3)', () => {
  it.each(files.map((file) => [path.relative(FEATURE_ROOT, file), file] as const))(
    '%s contains no delete( call',
    (_label, file) => {
      const source = fs.readFileSync(file, 'utf8');
      expect(source).not.toMatch(/\.delete\s*\(/);
    },
  );
});

describe('src/features/banks/** has no timer, subscription or event emitter (concurrency checklist)', () => {
  it.each(files.map((file) => [path.relative(FEATURE_ROOT, file), file] as const))(
    '%s contains no setTimeout/setInterval/addEventListener',
    (_label, file) => {
      const source = fs.readFileSync(file, 'utf8');
      expect(source).not.toMatch(/\b(setTimeout|setInterval|addEventListener)\s*\(/);
    },
  );
});
