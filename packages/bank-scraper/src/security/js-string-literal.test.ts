import { toJsStringLiteral } from './js-string-literal';

describe('toJsStringLiteral', () => {
  it('produces valid, evaluable JavaScript for a plain value', () => {
    const evaluated = new Function(`return ${toJsStringLiteral('12.345.678-9')};`)();
    expect(evaluated).toBe('12.345.678-9');
  });

  it('escapes a single quote so it cannot terminate a wrapping string (AC4)', () => {
    const literal = toJsStringLiteral(`o'brien`);
    const script = `const rutInput = { value: '' }; rutInput.value = ${literal}; return rutInput.value;`;
    expect(new Function(script)()).toBe(`o'brien`);
  });

  it('escapes backslashes, angle brackets and ampersands unchanged in effect (AC4)', () => {
    const value = `ZZ"\\'<>&ZZ`;
    const literal = toJsStringLiteral(value);
    expect(new Function(`return ${literal};`)()).toBe(value);
  });

  it('escapes U+2028 and U+2029 so the literal is not split across lines (CodeRabbit finding #33: escape sequences, not raw characters)', () => {
    // Escape sequences instead of the raw characters: both are invisible in review, and the two
    // raw code points were previously visually indistinguishable from each other in source.
    const value = 'a\u2028b\u2029c';
    const literal = toJsStringLiteral(value);
    expect(literal).not.toContain('\u2028');
    expect(literal).not.toContain('\u2029');
    expect(new Function(`return ${literal};`)()).toBe(value);
  });

  it('a credential value never changes what the script executes (AC4)', () => {
    const maliciousLookingPassword = `'; sendTrace({message: 'pwned'}); ('`;
    const literal = toJsStringLiteral(maliciousLookingPassword);
    let sideEffect = false;
    function sendTrace(): void {
      sideEffect = true;
    }
    const result = new Function('sendTrace', `const password = ${literal}; return password;`)(sendTrace);
    expect(result).toBe(maliciousLookingPassword);
    expect(sideEffect).toBe(false);
  });
});
