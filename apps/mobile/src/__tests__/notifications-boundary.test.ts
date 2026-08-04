import fs from 'node:fs';
import path from 'node:path';

/**
 * Implementation plan for issue #18, Decision 1 / Decision 7: the notifications access boundary
 * is enforced by the `notificationsBoundary` lint rule (`eslint.config.mjs`, applied from
 * `apps/mobile/eslint.config.mjs`) **and** by this test, so the guarantee survives a lint-config
 * regression. Mirrors `src/__tests__/secure-store-boundary.test.ts`'s shape exactly, plus two
 * additional call-site scans Decision 7 requires:
 *
 * 1. No file outside `src/lib/notifications/` imports `expo-notifications`.
 * 2. `NotificationsPort.requestPermission()` is called from exactly one file:
 *    `src/features/reminders/use-notification-permission.ts`.
 * 3. The hook's returned `request()` is called from exactly two files: `notifications-intro`'s
 *    "Habilitar notificaciones" press and `settings-notifications`'s toggle.
 *
 * All three lists are printed via `it.each`, so a vacuous pass on a broken file walk is visible.
 */

const APP_ROOT = path.resolve(__dirname, '..', '..', 'app');
const SRC_ROOT = path.resolve(__dirname, '..');
const ROOTS = [APP_ROOT, SRC_ROOT];

const NOTIFICATIONS_DIR = path.resolve(__dirname, '..', 'lib', 'notifications');
const PERMISSION_HOOK_FILE = path.resolve(
  __dirname,
  '..',
  'features',
  'reminders',
  'use-notification-permission.ts',
);
const INTRO_SCREEN_FILE = path.resolve(
  __dirname,
  '..',
  '..',
  'app',
  '(onboarding)',
  'notifications',
  'index.tsx',
);
const SETTINGS_SCREEN_FILE = path.resolve(__dirname, '..', '..', 'app', 'settings', 'notifications.tsx');

function isUnder(dir: string, filePath: string): boolean {
  const relative = path.relative(dir, filePath);
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

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

/** Mirrors `secure-store-boundary.test.ts`'s `findForbiddenImports` pattern exactly, with
 * `expo-notifications` substituted for `expo-secure-store` — every edge case (S1-S12) that
 * pattern documents applies identically here. */
function findForbiddenImports(source: string): boolean {
  const pattern =
    /(?:import(?=\s|[{*'"])\s*(?:[^;]*?from\s*)?['"]expo-notifications(?:\/[^'"]*)?['"]|(?:import|require)\s*\(\s*['"]expo-notifications(?:\/[^'"]*)?['"])/;
  return pattern.test(source);
}

/** Matches `port.requestPermission(`, `deps.port.requestPermission(`, etc. — a member-access call
 * — but not a method **definition** such as `async requestPermission(): Promise<...> {` (no
 * leading `.`), so `types.ts`'s interface line, the adapter's implementation and the memory
 * double's implementation are correctly excluded. */
const REQUEST_PERMISSION_CALL_PATTERN = /\.requestPermission\s*\(/g;

/** Matches a bare `request(` call — the hook's returned function is deliberately named exactly
 * `request`, not `requestPermission`, so this narrow pattern cannot collide with the port method
 * above: after `request` the very next non-whitespace character must be `(`, which
 * `requestPermission(` never satisfies (`P` follows immediately). */
const REQUEST_CALL_PATTERN = /\brequest\s*\(/g;

function countMatches(source: string, pattern: RegExp): number {
  const withGlobal = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
  return (source.match(withGlobal) ?? []).length;
}

/** A regex-based scanner, not a parser (documented limitation, mirroring
 * `catalogue-key-scan.ts`'s own disclosed scope): it cannot distinguish real code from an English
 * sentence inside a string literal. `use-transactions-list.test.ts` has an unrelated `it(...)`
 * description reading "...after this request (a genuinely empty store)", which textually matches
 * `\brequest\s*\(` even though it has nothing to do with the notification-permission hook. Listed
 * here, by name, with the reason — the same pattern `secure-store-boundary.test.ts` uses for its
 * own sibling-file exclusions — so this exclusion is visible and cannot silently grow. */
const REQUEST_CALL_FALSE_POSITIVE_PATHS = [
  path.resolve(__dirname, '..', 'features', 'transactions', '__tests__', 'use-transactions-list.test.ts'),
];

/** This file's own doc comments and "sanity" test bodies contain literal `.requestPermission(`
 * and `request(` text (to prove the patterns match/don't match the shapes they document) — the
 * same self-exclusion `secure-store-boundary.test.ts` applies to its own S1-S12 fixture strings. */
const SELF_FILE = path.resolve(__dirname, 'notifications-boundary.test.ts');

describe('no file outside src/lib/notifications/ imports expo-notifications (implementation plan Decision 1)', () => {
  const files = ROOTS.flatMap((root) => (fs.existsSync(root) ? listSourceFiles(root) : [])).filter(
    (file) => !isUnder(NOTIFICATIONS_DIR, file) && file !== SELF_FILE,
  );

  it('found at least one file to scan (a broken file walk must not make this vacuously pass)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((file) => [path.relative(process.cwd(), file), file] as const))(
    '%s has no expo-notifications import',
    (_label, file) => {
      const source = fs.readFileSync(file, 'utf8');
      expect(findForbiddenImports(source)).toBe(false);
    },
  );

  it('the exemption covers exactly one file — the adapter itself', () => {
    const allFiles = ROOTS.flatMap((root) => (fs.existsSync(root) ? listSourceFiles(root) : []));
    const exempted = allFiles.filter((file) => isUnder(NOTIFICATIONS_DIR, file));
    const importers = exempted.filter((file) => findForbiddenImports(fs.readFileSync(file, 'utf8')));
    expect(importers).toEqual([path.join(NOTIFICATIONS_DIR, 'expo-notifications.adapter.ts')]);
  });

  describe('scanner edge cases (mirrors secure-store-boundary.test.ts S1-S12)', () => {
    it('flags a static namespace import', () => {
      expect(findForbiddenImports("import * as Notifications from 'expo-notifications';")).toBe(true);
    });

    it('flags a named import with double quotes', () => {
      expect(findForbiddenImports('import { scheduleNotificationAsync } from "expo-notifications";')).toBe(
        true,
      );
    });

    it('flags a require() call', () => {
      expect(findForbiddenImports("const x = require('expo-notifications');")).toBe(true);
    });

    it('flags a subpath import', () => {
      expect(findForbiddenImports("import { X } from 'expo-notifications/build/index';")).toBe(true);
    });

    it('does NOT flag a package whose name merely starts with the same prefix', () => {
      expect(findForbiddenImports("import x from 'expo-notifications-extra';")).toBe(false);
    });

    it('does NOT flag a bare mention inside a comment', () => {
      expect(findForbiddenImports('// expo-notifications is the only sanctioned import')).toBe(false);
    });

    it('flags a dynamic import()', () => {
      expect(findForbiddenImports("const m = await import('expo-notifications');")).toBe(true);
    });

    it('flags a zero-space compact import', () => {
      expect(findForbiddenImports("import{scheduleNotificationAsync}from 'expo-notifications';")).toBe(
        true,
      );
    });

    it('flags a side-effect import', () => {
      expect(findForbiddenImports("import 'expo-notifications';")).toBe(true);
    });

    it('does NOT flag an identifier that merely starts with the letters "import"', () => {
      expect(findForbiddenImports("importantly from 'expo-notifications';")).toBe(false);
    });
  });
});

describe('NotificationsPort.requestPermission() is called from exactly one file (Decision 7)', () => {
  const files = ROOTS.flatMap((root) => (fs.existsSync(root) ? listSourceFiles(root) : [])).filter(
    (file) => file !== SELF_FILE,
  );

  it('found at least one file to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  const callSites = files
    .map((file) => ({ file, count: countMatches(fs.readFileSync(file, 'utf8'), REQUEST_PERMISSION_CALL_PATTERN) }))
    .filter((entry) => entry.count > 0);

  it.each(callSites.map((entry) => [path.relative(process.cwd(), entry.file)] as const))(
    'call site printed: %s',
    () => {
      // Intentional no-op assertion — this `it.each` exists to print every call site the scan
      // found in the test output, per the plan's "both lists are printed" requirement.
      expect(true).toBe(true);
    },
  );

  it('the only file calling .requestPermission( is use-notification-permission.ts', () => {
    expect(callSites.map((entry) => entry.file)).toEqual([PERMISSION_HOOK_FILE]);
  });

  it('sanity: the pattern itself does match a real call-site shape', () => {
    expect(countMatches('await deps.port.requestPermission();', REQUEST_PERMISSION_CALL_PATTERN)).toBe(1);
  });

  it('sanity: the pattern does NOT match a method definition (no leading dot)', () => {
    expect(
      countMatches('async requestPermission(): Promise<PermissionState> {', REQUEST_PERMISSION_CALL_PATTERN),
    ).toBe(0);
  });
});

describe("the notification-permission hook's returned request() is called from exactly two screens (Decision 7)", () => {
  const files = ROOTS.flatMap((root) => (fs.existsSync(root) ? listSourceFiles(root) : [])).filter(
    (file) => !REQUEST_CALL_FALSE_POSITIVE_PATHS.includes(file) && file !== SELF_FILE,
  );

  it('found at least one file to scan', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  const callSites = files
    .map((file) => ({ file, count: countMatches(fs.readFileSync(file, 'utf8'), REQUEST_CALL_PATTERN) }))
    .filter((entry) => entry.count > 0);

  it.each(callSites.map((entry) => [path.relative(process.cwd(), entry.file)] as const))(
    'call site printed: %s',
    () => {
      expect(true).toBe(true);
    },
  );

  it('the only files calling request() are the two screens Decision 7 names', () => {
    expect(new Set(callSites.map((entry) => entry.file))).toEqual(
      new Set([INTRO_SCREEN_FILE, SETTINGS_SCREEN_FILE]),
    );
  });

  it('sanity: the pattern does NOT match requestPermission(', () => {
    expect(countMatches('await port.requestPermission();', REQUEST_CALL_PATTERN)).toBe(0);
  });
});
