import fs from 'node:fs';
import path from 'node:path';

/**
 * Found in CodeRabbit review (PR #88): `dashboard.tsx` must re-read its own clock on every
 * focus, not only at mount, so a stale `now` cannot survive a round trip to `/settings` and back
 * across a local day/week/month boundary. `@testing-library/react-native` is not installed
 * (Decision 11 precedent) and no route file in this codebase is rendered in a test today, so —
 * mirroring `memoization.test.ts`'s source-scan style for the same reason — this proves the
 * wiring is present rather than mounting the route. The date-boundary arithmetic itself (a
 * `month`/`week` period crossing February, a leap year, or a year boundary) is already fully
 * covered by `dashboard-period.test.ts`'s direct, renderer-free tests of
 * `resolveDashboardPeriods`; what this suite adds is proof that the route actually calls that
 * function with a freshly re-derived date on every focus, not a date frozen at mount.
 */
describe('dashboard route: clock re-derivation on focus', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '..', '..', '..', '..', 'app', 'dashboard.tsx'),
    'utf8',
  );

  it('re-derives `now` via useFocusEffect, not only at mount', () => {
    expect(source).toMatch(/const \[now, setNow\] = useState\(\(\) => new Date\(\)\)/);
    expect(source).toMatch(/useFocusEffect\(useCallback\(\(\) => setNow\(new Date\(\)\), \[\]\)\)/);
  });

  it('derives dateLocal from the re-derived now, not a frozen constant', () => {
    expect(source).toMatch(/const dateLocal = deriveDateLocal\(now\)/);
  });
});
