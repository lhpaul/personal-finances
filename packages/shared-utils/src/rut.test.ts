import { computeRutCheckDigit, formatRut, isValidRut, normalizeRut } from './rut';

describe('rut', () => {
  describe('Group A — computeRutCheckDigit', () => {
    it.each([
      ['12345678', '5'],
      ['18456789', 'K'],
      ['999999', 'K'],
      ['9876543', '3'],
      ['7123456', '8'],
      ['11111111', '1'],
      ['30686957', '4'],
      ['5126663', '3'],
    ])('computeRutCheckDigit(%p) -> %p', (body, expected) => {
      expect(computeRutCheckDigit(body)).toBe(expected);
    });

    it.each(['', '12a45678', '12.345.678'])(
      'computeRutCheckDigit(%p) throws TypeError',
      (input) => {
        expect(() => computeRutCheckDigit(input)).toThrow(TypeError);
      },
    );
  });

  describe('Group B — the acceptance criterion, both halves, from the UI contract', () => {
    it("rejects the mockup's own wrong check digit", () => {
      expect(isValidRut('18.456.789-0')).toBe(false);
    });

    it('accepts K, both upper and lower case', () => {
      expect(isValidRut('18.456.789-K')).toBe(true);
      expect(isValidRut('18.456.789-k')).toBe(true);
    });

    it('rejects and accepts the placeholder RUT and its correction', () => {
      expect(isValidRut('12.345.678-9')).toBe(false);
      expect(isValidRut('12.345.678-5')).toBe(true);
    });

    it('rejects every other digit substituted for the correct check digit of 18456789', () => {
      const correct = 'K';
      for (const candidate of ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']) {
        expect(candidate).not.toBe(correct);
        expect(isValidRut(`18456789${candidate}`)).toBe(false);
      }
    });
  });

  describe('Group C — normalizeRut', () => {
    it.each([
      ['12.345.678-5', '123456785'],
      ['12345678-5', '123456785'],
      ['123456785', '123456785'],
      ['18.456.789-k', '18456789K'],
      ['  12.345.678 - 5  ', '123456785'],
    ])('normalizeRut(%p) -> %p', (input, expected) => {
      expect(normalizeRut(input)).toBe(expected);
    });

    it('strips non-breaking space (U+00A0) and thin space (U+2009)', () => {
      const withNbsp = `12.345.678${String.fromCharCode(0x00a0)}-${String.fromCharCode(0x00a0)}5`;
      const withThinSpace = `12.345.678${String.fromCharCode(0x2009)}-${String.fromCharCode(0x2009)}5`;
      expect(normalizeRut(withNbsp)).toBe('123456785');
      expect(normalizeRut(withThinSpace)).toBe('123456785');
    });

    it('does not validate — it normalizes non-numeric input too', () => {
      expect(normalizeRut('abc')).toBe('ABC');
    });
  });

  describe('Group D — isValidRut structural rejection (Decision 10)', () => {
    it.each([
      '',
      '-5',
      '5',
      '1-9',
      '12345-5',
      '123456789-0',
      '1234567X',
      '12.345.678-55',
      '--',
      '0-0',
    ])('isValidRut(%p) -> false, does not throw', (input) => {
      expect(() => isValidRut(input)).not.toThrow();
      expect(isValidRut(input)).toBe(false);
    });

    it('leading zeros are stripped: 07.123.456-8 behaves like 7.123.456-8', () => {
      expect(isValidRut('07.123.456-8')).toBe(isValidRut('7.123.456-8'));
    });

    it('an all-zero body reduces to nothing and is invalid', () => {
      expect(isValidRut('00000000-0')).toBe(false);
    });

    it('a 6-digit body is exactly at the floor and can be valid', () => {
      expect(isValidRut('999999-K')).toBe(true);
    });
  });

  describe('Group E — formatRut', () => {
    it.each([
      ['123456785', '12.345.678-5'],
      ['12345678-5', '12.345.678-5'],
      ['18456789K', '18.456.789-K'],
      ['18456789k', '18.456.789-K'],
      ['9876543-3', '9.876.543-3'],
      ['999999-K', '999.999-K'],
    ])('formatRut(%p) -> %p', (input, expected) => {
      expect(formatRut(input)).toBe(expected);
    });

    it("formats the mockup's arithmetically invalid RUT successfully (does not check the check digit)", () => {
      expect(formatRut('18456789-0')).toBe('18.456.789-0');
    });

    it.each(['', 'abc'])('formatRut(%p) throws TypeError', (input) => {
      expect(() => formatRut(input)).toThrow(TypeError);
    });
  });

  describe('Group F — privacy (Decision 9, AGENTS.md non-negotiable 1)', () => {
    // Empty string is excluded: it is vacuously "contained" in every string, so the
    // not-echoed-in-the-message assertion below is meaningless for it. '12.345.678' is excluded
    // too: it is structurally malformed for computeRutCheckDigit (contains non-digit separators)
    // but, after normalizeRut strips the separators, it is a structurally *well-formed* RUT body
    // for formatRut — so formatRut('12.345.678') does not throw and contributes no coverage to
    // this privacy-specific "never throws with the input in the message" guarantee. That
    // non-throwing behaviour is asserted separately below, in its own case. Every input kept in
    // `throwingInputs` is asserted (via `.toThrow`) to actually throw for *both* functions, so a
    // regression that stops either function from throwing fails this test instead of silently
    // passing.
    const throwingInputs = ['12a45678', 'abc'];

    it.each(throwingInputs)(
      'computeRutCheckDigit/formatRut error messages for %p never contain the input',
      (input) => {
        expect(() => computeRutCheckDigit(input)).toThrow(TypeError);
        try {
          computeRutCheckDigit(input);
        } catch (error) {
          expect((error as Error).message).not.toContain(input);
        }
        expect(() => formatRut(input)).toThrow(TypeError);
        try {
          formatRut(input);
        } catch (error) {
          expect((error as Error).message).not.toContain(input);
        }
      },
    );

    it("formatRut('12.345.678') does not throw — its normalized form is a structurally well-formed RUT body", () => {
      expect(formatRut('12.345.678')).toBe('1.234.567-8');
    });

    it('computeRutCheckDigit("") and formatRut("") both throw without a value to echo', () => {
      expect(() => computeRutCheckDigit('')).toThrow(TypeError);
      expect(() => formatRut('')).toThrow(TypeError);
    });

    it('no thrown message contains any 6-or-more-digit substring of the offending input', () => {
      const longDigitInput = '123456789012';
      const messages: string[] = [];
      try {
        computeRutCheckDigit(longDigitInput + 'X');
      } catch (error) {
        messages.push((error as Error).message);
      }
      try {
        formatRut('!!!' + longDigitInput + '9!!!-Z');
      } catch (error) {
        messages.push((error as Error).message);
      }
      for (const message of messages) {
        expect(message).not.toMatch(/[0-9]{6,}/);
      }
    });
  });

  describe('Parser-risk addendum — the full RUT edge-case enumeration (Group column in the plan)', () => {
    it.each([
      ['18.456.789-K', true, 'canonical accepted form'],
      ['18456789K', true, 'fully compact, no separators'],
      ['18.456.789-k', true, 'lowercase check digit (boundary character)'],
      ['18.456.789-0', false, "wrong check digit (mockup's own literal)"],
      ['12.345.678-9', false, 'wrong check digit (mockup placeholder)'],
      ['  12.345.678 - 5  ', true, 'leading/trailing/interior ASCII whitespace'],
      [
        `12.345.678${String.fromCharCode(0x2009)}-${String.fromCharCode(0x00a0)}5`,
        true,
        'non-breaking + thin space (boundary characters)',
      ],
      ['07.123.456-8', true, 'leading zero in the body'],
      ['00000000-0', false, 'body is all zeros — reduces to empty'],
      ['1-9', false, 'body far below the minimum length'],
      ['12345-5', false, 'just below the 6-digit floor'],
      ['999999-K', true, 'exactly at the 6-digit floor'],
      ['123456789-0', false, 'just above the 8-digit ceiling'],
      ['1234567X', false, 'check character that is neither a digit nor K'],
      ['12.345.678-55', false, 'two check characters'],
      ['12.345.678', false, 'missing check digit entirely'],
      ['K12345678', false, 'K in the body position (looks like a match, is not)'],
      ['12.345.678-5-9', false, 'multiple separators/segments on one value'],
      ['12,345,678-5', false, 'comma separators — must not normalize'],
      ['١٢٣٤٥٦٧٨-٥', false, 'non-ASCII (Arabic-Indic) digits must not be treated as digits'],
      ['', false, 'empty string'],
    ])('isValidRut(%p) -> %p (%s)', (input, expected) => {
      expect(isValidRut(input)).toBe(expected);
    });
  });
});
