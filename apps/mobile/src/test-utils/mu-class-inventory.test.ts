import { muClassInventory } from './mu-class-inventory';

function wrapStyle(css: string): string {
  return `<html><head><style>${css}</style></head><body></body></html>`;
}

describe('muClassInventory (Scanner A — Parser-risk addendum E1-E10)', () => {
  it('E1: dedupes classes across a comma-separated selector list', () => {
    const html = wrapStyle(
      '.mu-card + .mu-card, .mu-card + .mu-hero, .mu-hero + .mu-card { margin-top: 4px; }',
    );
    expect(muClassInventory(html)).toEqual(['mu-card', 'mu-hero']);
  });

  it('E2: strips a compound state-class suffix that is not itself a mu- class', () => {
    const html = wrapStyle('.mu-chip.is-selected { border-color: red; }');
    expect(muClassInventory(html)).toEqual(['mu-chip']);
  });

  it('E3: strips pseudo-element and pseudo-class suffixes', () => {
    const html = wrapStyle(
      '.mu-hero::after { content: ""; } .mu-radio.is-on::after { content: ""; } .mu-btn:hover { filter: none; }',
    );
    expect(muClassInventory(html)).toEqual(['mu-btn', 'mu-hero', 'mu-radio']);
  });

  it('E4: extracts every class from combinator selectors without duplicates', () => {
    const html = wrapStyle(
      '.mu-btn-row .mu-btn { flex: 1; } .mu-item + .mu-item { border-top: 1px solid; }',
    );
    expect(muClassInventory(html)).toEqual(['mu-btn', 'mu-btn-row', 'mu-item']);
  });

  it('E5: captures BEM element/modifier names in full, without truncating at - or __', () => {
    const html = wrapStyle(
      '.mu-tx__amount--in { color: green; } .mu-btn--danger-soft { color: red; } .mu-cat-row__fill { width: 10%; }',
    );
    expect(muClassInventory(html)).toEqual([
      'mu-btn--danger-soft',
      'mu-cat-row__fill',
      'mu-tx__amount--in',
    ]);
  });

  it('E6: ignores mu- tokens outside selector position (markup, comments, declaration bodies)', () => {
    const html = wrapStyle(
      `/* ── Buttons ─ */\n.mu-btn { background: var(--brand); }`,
    ).replace('<body></body>', '<body><div class="mu-btn mu-btn--sm"></div></body>');
    expect(muClassInventory(html)).toEqual(['mu-btn']);
  });

  it('E7: extracts both classes when two complete rules share one physical line', () => {
    const html = wrapStyle(
      '.mu-mt1 { margin-top: var(--sp1); } .mu-mt2 { margin-top: var(--sp2); }',
    );
    expect(muClassInventory(html)).toEqual(['mu-mt1', 'mu-mt2']);
  });

  it('E8: never captures a CSS custom property as a class', () => {
    const html = wrapStyle(':root { --sp5: 20px; --r-pill: 999px; } .mu-btn { color: var(--mu-anything); }');
    expect(muClassInventory(html)).toEqual(['mu-btn']);
  });

  it('E9: ignores a mu- token that appears only inside an HTML attribute', () => {
    const html = wrapStyle('.mu-btn { color: red; }').replace(
      '<body></body>',
      '<body><div data-states="mu-fake"></div></body>',
    );
    expect(muClassInventory(html)).toEqual(['mu-btn']);
  });

  it('E10: throws a descriptive error when there is no <style> block', () => {
    expect(() => muClassInventory('<html><body>no style here</body></html>')).toThrow(/<style>/);
  });

  it('E10: throws a descriptive error when the <style> block is empty', () => {
    expect(() => muClassInventory(wrapStyle(''))).toThrow(/<style>/);
  });
});
