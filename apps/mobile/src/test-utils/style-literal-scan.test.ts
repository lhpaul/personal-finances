import { findStyleLiterals } from './style-literal-scan';

describe('findStyleLiterals (Scanner B — Parser-risk addendum L1-L10)', () => {
  it('returns an empty array for empty input', () => {
    expect(findStyleLiterals('')).toEqual([]);
  });

  it('returns an empty array for whitespace-only input', () => {
    expect(findStyleLiterals('   \n\t\n   ')).toEqual([]);
  });

  it('is safe to call repeatedly in the same process (module-level regexes reset lastIndex on every call)', () => {
    const source = `const style = { padding: 16 };\n`;
    const first = findStyleLiterals(source);
    const second = findStyleLiterals(source);
    expect(first).toEqual(second);
    expect(first).toHaveLength(1);
  });

  it('L1: flags 3-, 6- and 8-digit hex literals', () => {
    const source = `const a = '#fff';\nconst b = '#6366f1';\nconst c = '#6366f1ff';\n`;
    const result = findStyleLiterals(source);
    expect(result.filter((v) => v.kind === 'hex')).toHaveLength(3);
    expect(result.map((v) => v.text)).toEqual(['#fff', '#6366f1', '#6366f1ff']);
  });

  it('L2: flags rgb()/rgba() with arbitrary internal whitespace', () => {
    const source = `const a = 'rgba(0,0,0,0.05)';\nconst b = 'rgb( 15 , 23 , 42 )';\n`;
    const result = findStyleLiterals(source);
    expect(result.filter((v) => v.kind === 'rgb')).toHaveLength(2);
  });

  it('L3: does not flag keys outside the tracked property set', () => {
    const source = `const style = { flex: 1, opacity: 0.55, zIndex: 40 };\nconst el = <X numberOfLines={2} total={4} />;\n`;
    expect(findStyleLiterals(source)).toHaveLength(0);
  });

  it('L4: flags two violations on one line with distinct columns', () => {
    const source = `const style = { padding: 16, borderRadius: 20 };\n`;
    const result = findStyleLiterals(source);
    expect(result).toHaveLength(2);
    expect(result[0]?.line).toBe(1);
    expect(result[1]?.line).toBe(1);
    expect(result[0]?.column).not.toBe(result[1]?.column);
  });

  it('L5: does not flag a token-referencing value', () => {
    const source = `const style = { padding: theme.space[4], borderRadius: theme.radius.card };\n`;
    expect(findStyleLiterals(source)).toHaveLength(0);
  });

  it('L6: does not flag literals inside comments', () => {
    const source = `// padding: 16 — matches .mu-card\n/* #6366f1 */\nconst noop = true;\n`;
    expect(findStyleLiterals(source)).toHaveLength(0);
  });

  it('L7: does not flag padding: 0', () => {
    const source = `const style = { padding: 0 };\n`;
    expect(findStyleLiterals(source)).toHaveLength(0);
  });

  it('L8: a trailing directive exempts the violation on the same line', () => {
    const source = `const style = { padding: 16, /* style-literal-allow: mockup-only spacer */ };\n`;
    // Trailing directive uses a line comment form in the real contract; exercise that form:
    const sourceLineComment = `const style = { padding: 16 }; // style-literal-allow: mockup-only spacer\n`;
    expect(findStyleLiterals(sourceLineComment)).toHaveLength(0);
    // A block-comment directive is not a recognized suppression (only line comments qualify),
    // so it must still report the violation:
    expect(findStyleLiterals(source).some((v) => v.kind === 'style-number')).toBe(true);
  });

  it('L9: a directive alone on the line above exempts the line below', () => {
    const source = `// style-literal-allow: mockup-only spacer\nconst style = { padding: 16 };\n`;
    expect(findStyleLiterals(source)).toHaveLength(0);
  });

  it('L10: an empty-reason directive is itself a violation and exempts nothing', () => {
    const source = `// style-literal-allow:\n`;
    const result = findStyleLiterals(source);
    expect(result).toHaveLength(1);
    expect(result[0]?.kind).toBe('style-number');
    expect(result[0]?.text).toBe('missing suppression reason');
  });

  it('L10 (scope check): an empty-reason directive trailing a real violation still flags both', () => {
    const source = `const style = { padding: 16 }; // style-literal-allow:\n`;
    const result = findStyleLiterals(source);
    expect(result).toHaveLength(2);
    expect(result.some((v) => v.text === 'missing suppression reason')).toBe(true);
    expect(result.some((v) => v.text === 'padding: 16')).toBe(true);
  });
});
