// Monorepo Metro resolution: the lab must see the workspace root's hoisted node_modules
// (`pnpm-workspace.yaml` `nodeLinker: hoisted`) or it fails to resolve `@finanzas/bank-scraper`
// and `@finanzas/shared-utils`.
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
