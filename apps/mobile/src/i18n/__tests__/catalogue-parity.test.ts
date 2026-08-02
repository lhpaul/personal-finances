/** Scenario 5 of the implementation plan's Testing Strategy (AC3, Decision 8). */
import es from '../es.json';
import en from '../en.json';

const KEY_PATTERN = /^[a-z0-9]+(?:_[a-z0-9]+)*(?:\.[a-z0-9]+(?:_[a-z0-9]+)*)*$/;

describe('catalogue parity (AC3)', () => {
  const esKeys = Object.keys(es).sort();
  const enKeys = Object.keys(en).sort();

  it('found catalogue keys to check', () => {
    expect(esKeys.length).toBeGreaterThan(0);
  });

  it('es and en have identical key sets', () => {
    expect(enKeys).toEqual(esKeys);
  });

  it.each(esKeys)('%s is a non-empty string in es', (key) => {
    const value = (es as Record<string, unknown>)[key];
    expect(typeof value).toBe('string');
    expect((value as string).length).toBeGreaterThan(0);
  });

  it.each(esKeys)('%s is a non-empty string in en', (key) => {
    const value = (en as Record<string, unknown>)[key];
    expect(typeof value).toBe('string');
    expect((value as string).length).toBeGreaterThan(0);
  });

  it.each(esKeys)('%s matches the flat snake_case key pattern', (key) => {
    expect(key).toMatch(KEY_PATTERN);
  });

  it('no value is a nested object or array in es', () => {
    for (const value of Object.values(es)) {
      expect(typeof value).toBe('string');
    }
  });

  it('no value is a nested object or array in en', () => {
    for (const value of Object.values(en)) {
      expect(typeof value).toBe('string');
    }
  });
});
