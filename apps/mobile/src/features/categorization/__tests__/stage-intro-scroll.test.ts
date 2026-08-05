/**
 * Fix #103 — `StageIntroScreen.tsx`'s CTA was unreachable on the reference device profile
 * (393×852) because the screen's content sat in a plain `View`, not a `ScrollView`: on a
 * shorter viewport the "🚀 ¡Empezar mi primera etapa!" CTA rendered entirely off-screen with no
 * way to scroll to it (found by E2E flow 03 on a real simulator, item #22, PR #102 — see
 * `docs/testing/mobile/22-maestro-e2e-flows.smoke-test.md`'s "Blocked flows" section, finding 2).
 *
 * This is a static source-scan test, following this repository's established convention for
 * layout/structure guards that do not warrant a full renderer (`advanced-absent.test.ts`,
 * `fidelity-wiring.test.ts` in this same feature area). It proves two things about the real
 * screen file, each with its own planted-violation proof so the check cannot pass vacuously:
 *
 * 1. The screen imports and renders a `ScrollView` from `react-native`.
 * 2. The CTA button (`stage_intro.start`) sits *inside* that `ScrollView`'s open/close tags, not
 *    outside it — a `ScrollView` present elsewhere in the file with the CTA left outside it would
 *    not actually fix the reported bug.
 */
import fs from 'node:fs';
import path from 'node:path';

const SCREEN_FILE = path.resolve(__dirname, '..', 'StageIntroScreen.tsx');

/** Scope: does the source import `ScrollView` from `react-native`? */
export function importsScrollView(source: string): boolean {
  return /import\s*\{[^}]*\bScrollView\b[^}]*\}\s*from\s*['"]react-native['"]/.test(source);
}

export interface ScrollWrapCheckResult {
  hasScrollView: boolean;
  ctaInsideScrollView: boolean;
}

/**
 * Finds the first top-level `<ScrollView` open tag and its matching `</ScrollView>` close tag,
 * then checks whether the CTA marker (`stage_intro.start`, the button's translation key) falls
 * between them. A single-ScrollView screen (this one) never needs real JSX-depth tracking to
 * find "the matching close tag" — the first `<ScrollView` and the first `</ScrollView>` after it
 * are already the right pair.
 */
export function checkCtaInsideScrollView(source: string, ctaMarker: string): ScrollWrapCheckResult {
  const openIndex = source.indexOf('<ScrollView');
  if (openIndex === -1) {
    return { hasScrollView: false, ctaInsideScrollView: false };
  }
  const closeIndex = source.indexOf('</ScrollView>', openIndex);
  const ctaIndex = source.indexOf(ctaMarker);
  if (closeIndex === -1 || ctaIndex === -1) {
    return { hasScrollView: true, ctaInsideScrollView: false };
  }
  return {
    hasScrollView: true,
    ctaInsideScrollView: ctaIndex > openIndex && ctaIndex < closeIndex,
  };
}

const CTA_MARKER = 'stage_intro.start';

describe('StageIntroScreen wraps its content in a ScrollView with the CTA reachable inside it (#103)', () => {
  const source = fs.readFileSync(SCREEN_FILE, 'utf8');

  it('the real screen file exists and is non-empty (E10: an empty scope cannot pass vacuously)', () => {
    expect(source.length).toBeGreaterThan(0);
  });

  it('imports ScrollView from react-native', () => {
    expect(importsScrollView(source)).toBe(true);
  });

  it('renders a ScrollView, with the CTA (stage_intro.start) inside it', () => {
    const result = checkCtaInsideScrollView(source, CTA_MARKER);
    expect(result.hasScrollView).toBe(true);
    expect(result.ctaInsideScrollView).toBe(true);
  });

  it('planted-violation proof: a screen with no ScrollView at all is flagged', () => {
    const planted = `
      import { View } from 'react-native';
      export function StageIntroScreen() {
        return (
          <View>
            <Button label={t('stage_intro.start')} />
          </View>
        );
      }
    `;
    const result = checkCtaInsideScrollView(planted, CTA_MARKER);
    expect(result.hasScrollView).toBe(false);
    expect(result.ctaInsideScrollView).toBe(false);
    expect(importsScrollView(planted)).toBe(false);
  });

  it('planted-violation proof: a ScrollView present but the CTA left outside it is flagged', () => {
    const planted = `
      import { ScrollView, View } from 'react-native';
      export function StageIntroScreen() {
        return (
          <View>
            <ScrollView>
              <Text>content</Text>
            </ScrollView>
            <View>
              <Button label={t('stage_intro.start')} />
            </View>
          </View>
        );
      }
    `;
    const result = checkCtaInsideScrollView(planted, CTA_MARKER);
    expect(result.hasScrollView).toBe(true);
    expect(result.ctaInsideScrollView).toBe(false);
  });
});
