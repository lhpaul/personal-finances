/**
 * Ambient module declaration for a `.sql` file imported via ES `import` syntax, inlined to a
 * plain string at bundle time by `babel-plugin-inline-import` (`apps/mobile/babel.config.js`)
 * plus the `sql` entry in `metro.config.js`'s `resolver.sourceExts` — the mechanism
 * `drizzle/migrations.js` (untyped, `.js`) already relies on, and that
 * `apps/mobile/src/dev/sample-store.ts` (implementation plan for issue #12, Decision 11) is the
 * first **typed** consumer of.
 */
declare module '*.sql' {
  const content: string;
  export default content;
}
