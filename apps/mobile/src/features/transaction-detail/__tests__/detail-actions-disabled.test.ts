import fs from 'node:fs';
import path from 'node:path';

/**
 * Found in review on PR #84: the concurrent-event-source addendum requires "every action button
 * renders disabled while a write is in flight". No React renderer is available in this
 * repository (Verification Log), so this is asserted as a static source scan over
 * `DetailActions.tsx` — every `<Button` it renders must pass `disabled={disabled}` — mirroring
 * the same "assert over source text when no renderer exists" precedent
 * `db-access-boundary.test.ts` and `route-manifest-parity.test.ts` already use.
 */
const DETAIL_ACTIONS_FILE = path.resolve(__dirname, '..', 'components', 'DetailActions.tsx');

describe('DetailActions wires disabled to every rendered Button', () => {
  it('the file exists', () => {
    expect(fs.existsSync(DETAIL_ACTIONS_FILE)).toBe(true);
  });

  const source = fs.readFileSync(DETAIL_ACTIONS_FILE, 'utf8');
  const buttonOpenTagCount = (source.match(/<Button\b/g) ?? []).length;
  const disabledPropCount = (source.match(/disabled=\{disabled\}/g) ?? []).length;

  it('found at least one <Button> to check (a broken scan must not pass vacuously)', () => {
    expect(buttonOpenTagCount).toBeGreaterThan(0);
  });

  it('every <Button> passes disabled={disabled} — none is missing the wiring', () => {
    expect(disabledPropCount).toBe(buttonOpenTagCount);
  });

  it('DetailActionsProps declares an optional disabled boolean', () => {
    expect(source).toMatch(/disabled\?:\s*boolean/);
  });

  it('disabled defaults to false, so an omitted prop preserves prior (enabled) behaviour', () => {
    expect(source).toMatch(/disabled\s*=\s*false/);
  });
});
