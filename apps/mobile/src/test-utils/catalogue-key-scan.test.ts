import { findTranslationKeys } from './catalogue-key-scan';

describe('findTranslationKeys (Parser-risk addendum E1-E12)', () => {
  it('returns no keys and no dynamic findings for empty input', () => {
    expect(findTranslationKeys('')).toEqual({ keys: [], dynamic: [] });
  });

  it('returns no keys and no dynamic findings for whitespace-only input', () => {
    expect(findTranslationKeys('   \n\t\n   ')).toEqual({ keys: [], dynamic: [] });
  });

  it('is safe to call repeatedly in the same process (module-level regex resets lastIndex on every call)', () => {
    const source = `t('ds.a');\n`;
    const first = findTranslationKeys(source);
    const second = findTranslationKeys(source);
    expect(first).toEqual(second);
    expect(first.keys).toEqual(['ds.a']);
  });

  it("E1: t('ds.section.buttons') extracts one key", () => {
    const result = findTranslationKeys(`t('ds.section.buttons')`);
    expect(result.keys).toEqual(['ds.section.buttons']);
    expect(result.dynamic).toEqual([]);
  });

  it('E2: double quotes are accepted and extract the same key', () => {
    const result = findTranslationKeys(`t("ds.section.buttons")`);
    expect(result.keys).toEqual(['ds.section.buttons']);
    expect(result.dynamic).toEqual([]);
  });

  it('E3: two calls on one line both extract — the scan is global, not first-match', () => {
    const result = findTranslationKeys(`label={t('ds.a')} icon={t('ds.b')}`);
    expect(result.keys).toEqual(['ds.a', 'ds.b']);
    expect(result.dynamic).toEqual([]);
  });

  it('E4: a trailing options argument is ignored', () => {
    const result = findTranslationKeys(`t('dev.placeholder.screen', { screenId })`);
    expect(result.keys).toEqual(['dev.placeholder.screen']);
    expect(result.dynamic).toEqual([]);
  });

  it('E5: a bare identifier argument yields zero keys and one dynamic finding', () => {
    const result = findTranslationKeys(`t(someVariable)`);
    expect(result.keys).toEqual([]);
    expect(result.dynamic).toHaveLength(1);
  });

  it('E6: a template literal argument yields zero keys and one dynamic finding', () => {
    const result = findTranslationKeys('t(`ds.${x}`)');
    expect(result.keys).toEqual([]);
    expect(result.dynamic).toHaveLength(1);
  });

  it("E7: t('') is one dynamic finding, not an empty-string key", () => {
    const result = findTranslationKeys(`t('')`);
    expect(result.keys).toEqual([]);
    expect(result.dynamic).toHaveLength(1);
  });

  it('E8: a non-t callee (expect/require/print/useT/format) is never matched', () => {
    const source = [
      `expect('x')`,
      `require('x')`,
      `print('x')`,
      `useT('x')`,
      `format('x')`,
    ].join('\n');
    const result = findTranslationKeys(source);
    expect(result.keys).toEqual([]);
    expect(result.dynamic).toEqual([]);
  });

  it('E9: a member-expression callee (obj.t(...)) is still t', () => {
    const result = findTranslationKeys(`obj.t('ds.a')`);
    expect(result.keys).toEqual(['ds.a']);
    expect(result.dynamic).toEqual([]);
  });

  it('E10: a commented-out call is still matched (documented limitation)', () => {
    const result = findTranslationKeys(`// t('ds.removed')`);
    expect(result.keys).toEqual(['ds.removed']);
    expect(result.dynamic).toEqual([]);
  });

  it('E11: a conditional (ternary) key argument yields zero keys and one dynamic finding', () => {
    const result = findTranslationKeys(`t(cond ? 'ds.a' : 'ds.b')`);
    expect(result.keys).toEqual([]);
    expect(result.dynamic).toHaveLength(1);
  });

  it('E12: a multi-line call with the literal on its own line still extracts the key', () => {
    const source = `t(\n  'ds.a'\n)`;
    const result = findTranslationKeys(source);
    expect(result.keys).toEqual(['ds.a']);
    expect(result.dynamic).toEqual([]);
  });
});
