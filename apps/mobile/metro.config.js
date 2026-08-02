// Monorepo Metro resolution: the app must see the workspace root's node_modules and the
// hoisted (pnpm-workspace.yaml `nodeLinker: hoisted`, enforced by `pnpm check:layout`)
// packages, or it fails to resolve `@finanzas/shared-domain` / `@finanzas/shared-utils` /
// `@finanzas/bank-scraper`.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// `drizzle-kit generate` (with `driver: 'expo'`) emits `drizzle/migrations.js`, which imports
// each migration's `.sql` file directly (`import m0000 from './0000_<tag>.sql'`). Metro does not
// resolve `.sql` as a source extension by default; `babel-plugin-inline-import`
// (`apps/mobile/babel.config.js`) is the transform that turns that import into an inlined string
// at bundle time (implementation plan Decision 6, Verification Log).
config.resolver.sourceExts = [...config.resolver.sourceExts, 'sql'];

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
