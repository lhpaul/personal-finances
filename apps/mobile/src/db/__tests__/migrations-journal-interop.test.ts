import Module from 'node:module';
import path from 'node:path';

import * as babel from '@babel/core';

import { resolveMigrationsConfig } from '../migrations-config';

/**
 * Issue #95: `apps/mobile/src/db/runtime.ts` (`getAppDatabase()`) crashed the app at first
 * render on every device build because `require('../../drizzle/migrations').journal` read
 * `undefined` under this project's real Babel interop. This suite compiles the *real*
 * `drizzle/migrations.js` with the *real* `apps/mobile/babel.config.js` — not a mock, not a
 * `jest.mock` — the way `runtime.ts`'s `require(...)` call actually resolves at bundle time, so
 * a future regression in either the Babel config or `resolveMigrationsConfig` fails here instead
 * of only on a device.
 *
 * `migrations.test.ts` does not catch this: it migrates through `drizzle-orm`'s folder-based
 * migrator (`{ migrationsFolder }`), never through the pre-bundled `drizzle/migrations.js`
 * module `runtime.ts` requires. The one test that imports `runtime.ts`
 * (`src/dev/__tests__/connect-fixtures-store.test.ts`) `jest.mock`s it away. Neither test ever
 * exercised this module's actual compiled shape — this file is the first to do so.
 */
const MIGRATIONS_PATH = path.resolve(__dirname, '../../../drizzle/migrations.js');
const BABEL_CONFIG_FILE = path.resolve(__dirname, '../../../babel.config.js');

type LoadedMigrationsModule = { journal?: unknown; default?: { journal?: unknown } };

/**
 * Compiles the real `drizzle/migrations.js` with the real project Babel config, for a given
 * caller shape, then loads the compiled output through Node's `Module` machinery — using the
 * migrations file's own path/directory for module resolution — exactly the way
 * `require('../../drizzle/migrations')` resolves its own `require('./meta/_journal.json')` call.
 */
function compileAndLoad(caller: Record<string, unknown>): LoadedMigrationsModule {
  const result = babel.transformFileSync(MIGRATIONS_PATH, {
    configFile: BABEL_CONFIG_FILE,
    babelrc: false,
    caller: { name: 'migrations-journal-interop-test', ...caller },
  });
  const code = result?.code;
  if (!code) {
    throw new Error('babel.transformFileSync produced no code for drizzle/migrations.js');
  }

  // Node's `Module` typings omit the internal `_nodeModulePaths` / `_compile` this loader needs
  // to resolve and execute the compiled output relative to the real `drizzle/migrations.js` path.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ModuleInternals = Module as any;
  const compiledModule = new Module(MIGRATIONS_PATH, module);
  compiledModule.filename = MIGRATIONS_PATH;
  compiledModule.paths = ModuleInternals._nodeModulePaths(path.dirname(MIGRATIONS_PATH));
  (compiledModule as unknown as { _compile: (code: string, filename: string) => void })._compile(
    code,
    MIGRATIONS_PATH,
  );
  return compiledModule.exports as LoadedMigrationsModule;
}

describe('drizzle/migrations.js Babel interop (issue #95)', () => {
  const scenarios: { label: string; caller: Record<string, unknown> }[] = [
    { label: 'Metro-shaped caller', caller: { supportsStaticESM: false } },
    {
      // Matches this very test file's own transform (`jest.config.js`'s `db` project:
      // `babel-jest` + `babel-preset-expo`) — proves the interop divergence is not a Metro-only
      // artifact of this proof, but the actual environment Jest already ran under while green.
      label: 'babel-jest-shaped caller',
      caller: { name: 'babel-jest', supportsStaticESM: false },
    },
  ];

  it.each(scenarios)(
    '$label: the compiled module nests the export under `.default`, not the top level',
    ({ caller }) => {
      const migrationsModule = compileAndLoad(caller);
      expect(migrationsModule.journal).toBeUndefined();
      expect(migrationsModule.default?.journal).toBeDefined();
    },
  );

  it.each(scenarios)(
    '$label: the pre-fix accessor (`require(...).journal`) resolves undefined — this was the bug',
    ({ caller }) => {
      const migrationsModule = compileAndLoad(caller);
      const preFixJournal = migrationsModule.journal;
      expect(preFixJournal).toBeUndefined();
    },
  );

  it.each(scenarios)(
    '$label: resolveMigrationsConfig resolves a defined journal with at least one entry',
    ({ caller }) => {
      const migrationsModule = compileAndLoad(caller);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- shape asserted by the compiled fixture, not TS.
      const migrations = resolveMigrationsConfig(migrationsModule as any);
      expect(migrations.journal).toBeDefined();
      expect(Array.isArray(migrations.journal.entries)).toBe(true);
      expect(migrations.journal.entries.length).toBeGreaterThan(0);
      expect(migrations.migrations).toBeDefined();
    },
  );

  it('resolveMigrationsConfig also accepts an already-flat (non-`.default`) shape', () => {
    const flatShape = {
      journal: { entries: [{ idx: 0, when: 1, tag: '0000_x', breakpoints: false }] },
      migrations: { m0000: 'CREATE TABLE x (y INTEGER);' },
    };
    expect(resolveMigrationsConfig(flatShape)).toBe(flatShape);
  });
});
