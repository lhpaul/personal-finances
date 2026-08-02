import fs from 'node:fs';
import path from 'node:path';

import { theme } from '../theme';

const TOKENS_PATH = path.resolve(__dirname, '..', '..', '..', '..', 'design', 'tokens.json');

/** The ten `design/tokens.json` groups `theme` mirrors verbatim (Decision 1). */
const MIRRORED_GROUPS = [
  'colors',
  'gradients',
  'chart',
  'typography',
  'space',
  'radius',
  'shadow',
  'layout',
  'touchTarget',
  'categoryIcons',
] as const;

/** `categoryLabels` is es/en display copy for seeded categories, not a visual token (Decision
 * 1, "Resolved" row). This is the plan's one intentional exclusion. */
const EXCLUDED_GROUPS = ['categoryLabels'] as const;

function loadTokens(): Record<string, unknown> {
  const raw = fs.readFileSync(TOKENS_PATH, 'utf8');
  return JSON.parse(raw) as Record<string, unknown>;
}

function nonMetaKeys(obj: Record<string, unknown>): string[] {
  return Object.keys(obj).filter((key) => !key.startsWith('$'));
}

/** Recursively strips `$`-prefixed metadata keys (`$description`, `$version`, `$source`), which
 * are excluded from the mirror everywhere (Decision 1) — some `tokens.json` groups (e.g.
 * `gradients`, `categoryIcons`) carry a nested `$description` alongside their token values. */
function stripMeta(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripMeta);
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (key.startsWith('$')) continue;
      result[key] = stripMeta(val);
    }
    return result;
  }
  return value;
}

describe('theme ↔ design/tokens.json parity (AC1)', () => {
  const tokens = loadTokens();

  it.each(MIRRORED_GROUPS)('theme.%s deep-equals tokens.json\'s %s group', (group) => {
    expect((theme as Record<string, unknown>)[group]).toEqual(stripMeta(tokens[group]));
  });

  it('theme has no key outside the mirrored-group list', () => {
    expect(Object.keys(theme).sort()).toEqual([...MIRRORED_GROUPS].sort());
  });

  it('the mirrored groups plus the named exclusion list cover every top-level tokens.json key', () => {
    const tokenGroups = nonMetaKeys(tokens);
    const covered = [...MIRRORED_GROUPS, ...EXCLUDED_GROUPS].sort();
    expect(tokenGroups.sort()).toEqual(covered);
  });
});
