/**
 * Normalizes the drizzle-kit-generated `drizzle/migrations.js` to `{ journal, migrations }`
 * regardless of which CommonJS/ESM interop shape the caller's Babel/Metro transform produced.
 *
 * `drizzle/migrations.js` is authored as `export default { journal, migrations }` (drizzle-kit's
 * `expo` driver output — see that file's header comment). Under this project's real
 * `babel-preset-expo` config (`apps/mobile/babel.config.js`), `export default` compiles to
 * `exports.default = {...}`, confirmed by compiling the real file with the real config under
 * both a Metro-shaped caller (`supportsStaticESM: false`) and a `babel-jest`-shaped caller
 * (`src/db/__tests__/migrations-journal-interop.test.ts`): both produce the same `.default`
 * nesting. A plain `require('../../drizzle/migrations').journal` therefore reads `undefined` in
 * every real environment — no environment exposes a top-level `.journal` — which crashed
 * `getAppDatabase()` (`runtime.ts`) at first render on every device build (issue #95). This went
 * unnoticed because no test exercised this module's actual `require(...)` output against the
 * real compiled file: `migrations.test.ts` migrates through `drizzle-orm`'s folder-based
 * migrator instead, and the one test that imports `runtime.ts`
 * (`src/dev/__tests__/connect-fixtures-store.test.ts`) `jest.mock`s it away.
 *
 * Accepting either shape (flat or `.default`-nested) rather than assuming one keeps this working
 * regardless of which interop a future bundler/transform change produces.
 */
export type MigrationsConfig = {
  journal: {
    entries: { idx: number; when: number; tag: string; breakpoints: boolean }[];
  };
  migrations: Record<string, string>;
};

export function resolveMigrationsConfig(
  migrationsModule: MigrationsConfig | { default: MigrationsConfig },
): MigrationsConfig {
  return 'journal' in migrationsModule ? migrationsModule : migrationsModule.default;
}
