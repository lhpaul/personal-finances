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

  it('escapes U+2028 and U+2029 so the literal is not split across lines', () => {
    const value = 'a b c';
    const literal = toJsStringLiteral(value);
    expect(literal).not.toContain(' ');
    expect(literal).not.toContain(' ');
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
