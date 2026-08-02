import fs from 'node:fs';
import path from 'node:path';

import * as UiBarrel from '../components/ui';
import { muClassInventory } from '../test-utils/mu-class-inventory';
import { MU_CLASS_MAP } from '../test-utils/mu-class-map';

const MOCKUP_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'design',
  'mockups',
  'mobile',
  'index.html',
);

const UI_DIR = path.resolve(__dirname, '..', 'components', 'ui');
const BARREL_EXPORTS = new Set(Object.keys(UiBarrel));

function internalModuleExists(relativePath: string): boolean {
  return ['.ts', '.tsx'].some((ext) => fs.existsSync(path.resolve(UI_DIR, `${relativePath}${ext}`)));
}

describe('mu-class coverage (AC2)', () => {
  const html = fs.readFileSync(MOCKUP_PATH, 'utf8');
  const liveClasses = muClassInventory(html);

  it('classifies every live mu-* class exactly once (exhaustive classification)', () => {
    const mapped = Object.keys(MU_CLASS_MAP).sort();
    expect(liveClasses).toEqual(mapped);
  });

  it('reports the live class count and the per-status breakdown', () => {
    const byStatus = { primitive: 0, utility: 0, deferred: 0 };
    for (const entry of Object.values(MU_CLASS_MAP)) {
      byStatus[entry.status] += 1;
    }
    const total = byStatus.primitive + byStatus.utility + byStatus.deferred;

    expect(total).toBe(liveClasses.length);
    expect(Object.keys(MU_CLASS_MAP)).toHaveLength(liveClasses.length);

    // eslint-disable-next-line no-console -- residual-verification evidence for the PR body
    console.log(
      `mu-class-coverage: ${liveClasses.length} live classes — ` +
        `primitive=${byStatus.primitive} utility=${byStatus.utility} deferred=${byStatus.deferred}`,
    );
  });

  const primitiveEntries = Object.entries(MU_CLASS_MAP).filter(
    ([, entry]) => entry.status === 'primitive',
  );

  it('every primitive entry has a non-empty owners array', () => {
    for (const [className, entry] of primitiveEntries) {
      expect({ className, owners: entry.owners }).toEqual({
        className,
        owners: expect.arrayContaining([expect.any(String)]),
      });
      expect(entry.owners?.length).toBeGreaterThan(0);
    }
  });

  it.each(primitiveEntries)(
    '%s: every owner resolves to a barrel export of src/components/ui/index.ts',
    (className, entry) => {
      for (const owner of entry.owners ?? []) {
        expect(BARREL_EXPORTS.has(owner)).toBe(true);
      }
    },
  );

  it.each(primitiveEntries.filter(([, entry]) => entry.internalOwners !== undefined))(
    '%s: every internalOwners path resolves to a module that is NOT a barrel export',
    (className, entry) => {
      for (const internalPath of entry.internalOwners ?? []) {
        expect(internalModuleExists(internalPath)).toBe(true);
        const moduleName = internalPath.split('/').pop();
        expect(moduleName === undefined ? false : BARREL_EXPORTS.has(moduleName)).toBe(false);
      }
    },
  );
});
