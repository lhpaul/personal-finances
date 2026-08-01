// Monorepo Metro resolution: the app must see the workspace root's node_modules and the
// hoisted (Decision 1, .npmrc `node-linker=hoisted`) packages, or it fails to resolve
// `@finanzas/shared-domain` / `@finanzas/shared-utils` / `@finanzas/bank-scraper`.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
