import fs from 'node:fs';
import path from 'node:path';

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
});
