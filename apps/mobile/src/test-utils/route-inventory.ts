import fs from 'node:fs';
import path from 'node:path';

/**
 * Dev-only routes that exist in `apps/mobile/app` but are never part of the manifest's MVP
 * route set — subtracted from the derived route set before the route/manifest parity
 * set-equality assertion. Each entry must (a) resolve to an existing route file and (b) that
 * file's source must contain a `__DEV__` guard — see the implementation plan's Decision 6.
 */
export const DEV_ONLY_ROUTES = ['/(dev)/gallery', '/(dev)/sample-data', '/(dev)/connect-fixtures'] as const;

/**
 * Derives a manifest-style route path from a file path relative to `apps/mobile/app`.
 *
 * Returns `null` when the file is not a routable Expo Router file (layouts, non-route
 * extensions, dot/underscore/plus-prefixed special files, test files). Manifest routes keep
 * their group parentheses (`/(tabs)/home`) — groups are preserved verbatim, not stripped.
 */
export function toRoutePath(relativePath: string): string | null {
  const normalized = relativePath.split('\\').join('/').replace(/\/{2,}/g, '/');

  if (!/\.(ts|tsx)$/.test(normalized)) return null;
  if (/\.test\.(ts|tsx)$/.test(normalized)) return null;

  const withoutExt = normalized.replace(/\.(ts|tsx)$/, '');
  const segments = withoutExt.split('/');
  const last = segments[segments.length - 1];

  if (segments.some((segment) => segment.startsWith('_') || segment.startsWith('+'))) {
    return null;
  }
  if (segments.length === 1 && last === 'index') return null; // entry shim (Decision 7)
  if (last === 'index') segments.pop();

  return `/${segments.join('/')}`;
}

/**
 * Recursively lists every file under `appDir`, relative to `appDir`, with `/` separators
 * regardless of platform.
 */
export function listRouteFiles(appDir: string): string[] {
  const results: string[] = [];

  function walk(dir: string): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const relative = path.relative(appDir, fullPath).split(path.sep).join('/');
        results.push(relative);
      }
    }
  }

  walk(appDir);
  return results;
}
