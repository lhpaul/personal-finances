import fs from 'node:fs';
import path from 'node:path';

/**
 * Scenario 16 of the implementation plan for issue #19: the three settings routes no longer
 * render `RoutePlaceholder`, and `account.tsx` wires the confirmation modal to the wipe phase
 * machine. A full renderer-free element-tree walk (`src/test-utils/element-tree.ts`) is not used
 * here — unlike `ListRow`/`TopBar`, these routes call hooks (`useFocusEffect`, `useRouter`,
 * `useTranslation`), and `@testing-library/react-native` is not installed in this repository
 * (implementation plan Decision 11). This is a source-text assertion instead, in the same spirit
 * as `mu-class-coverage.test.ts` and `route-manifest-parity.test.ts` — a mechanical check over
 * the file, not a render.
 */

const ROUTES_DIR = path.resolve(__dirname, '..');

function read(fileName: string): string {
  return fs.readFileSync(path.join(ROUTES_DIR, fileName), 'utf8');
}

describe('settings routes no longer render RoutePlaceholder', () => {
  it.each(['index.tsx', 'account.tsx', 'about.tsx'])('%s does not import RoutePlaceholder', (fileName) => {
    const source = read(fileName);
    expect(source).not.toMatch(/RoutePlaceholder/);
  });

  it.each([
    ['index.tsx', 'fidelity-settings'],
    ['account.tsx', 'fidelity-settings-account'],
    ['about.tsx', 'fidelity-settings-about'],
  ])('%s carries testID={fidelityTestId(...)}', (fileName, _expectedId) => {
    const source = read(fileName);
    expect(source).toMatch(/fidelityTestId\(/);
  });
});

describe('account.tsx wires the confirmation modal to the wipe phase machine (Decision 7)', () => {
  const source = read('account.tsx');

  it('imports Modal and useWipeLocalData', () => {
    expect(source).toMatch(/\bModal\b/);
    expect(source).toMatch(/useWipeLocalData/);
  });

  it("the Modal's visible prop is derived from phase, not a hard-coded boolean", () => {
    expect(source).toMatch(/visible=\{phase === 'confirming'/);
  });

  it('the danger note is gated on both failure phases, with distinct copy per phase (Assumption A3; found in review)', () => {
    expect(source).toMatch(/phase === 'failed_credentials'/);
    expect(source).toMatch(/phase === 'failed_store'/);
    expect(source).toMatch(/delete_failed_store/);
  });
});
