import { findUnguardedPesoTotals } from '../peso-total-scan';

/**
 * Implementation plan Testing Strategy, "Parser-risk addendum" (issue #10, Decision 15): the
 * eleven enumerated edge cases for `peso-total-scan.ts`, plus case 12 (the line-number drift fix)
 * and case 13 (the nested-generic `sql<Array<number>>` fix).
 *
 * Every fixture below builds its sample "source" text by interpolating a `BACKTICK` variable
 * rather than writing a literal `` sql`...` `` sequence directly in this file's own source. This
 * is not cosmetic: `src/db/checks/inclusion-rule-scan.ts`'s Rule A independently extracts
 * `` sql`...` `` tagged-template bodies from *any* file (this one is not on its allowlist — the
 * plan explicitly rejects adding it, see this file's own Testing Strategy "Interaction with the
 * shipped inclusion-rule scanner" note) and flags a bare `includedAmount` inside one. A literal
 * `` sql`select sum(${includedAmount})...` `` written directly in this file — even to build a
 * fixture string — would trip that *other* scanner's Rule A. Building the same fixture value at
 * runtime, with no contiguous `` sql` `` text anywhere in this file's own source, avoids the trap
 * without weakening either scanner.
 */

const BACKTICK = String.fromCharCode(96);

describe('findUnguardedPesoTotals — parser-risk edge cases', () => {
  it('1. fires on the real violation: sum(${includedAmount}) with no isPesoDenominated in the file', () => {
    const source = `export const total = sql${BACKTICK}select sum(\${includedAmount}) from transactions${BACKTICK};`;
    const findings = findUnguardedPesoTotals(source, 'src/db/repositories/example.ts');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.line).toBe(1);
  });

  it('2. does not over-fire on a guarded total: the same file also names isPesoDenominated', () => {
    const source = `export const total = sql${BACKTICK}select sum(\${includedAmount}) from transactions where \${isPesoDenominated}${BACKTICK};`;
    expect(findUnguardedPesoTotals(source, 'src/db/repositories/example.ts')).toEqual([]);
  });

  it('3. multiple occurrences on one line: two distinct findings with distinct offsets', () => {
    const source = `export const q = sql${BACKTICK}sum(\${includedAmount}) as a, sum(\${includedAmount}) as b${BACKTICK};`;
    const findings = findUnguardedPesoTotals(source, 'src/db/repositories/example.ts');
    expect(findings).toHaveLength(2);
    expect(findings[0]?.line).toBe(1);
    expect(findings[1]?.line).toBe(1);
  });

  it('4. comments are stripped: a line comment and a block comment both containing the pattern produce no finding', () => {
    const source = [
      '// sum(${includedAmount})',
      '/* sum(${includedAmount}) */',
      'export const x = 1;',
    ].join('\n');
    expect(findUnguardedPesoTotals(source, 'src/db/repositories/example.ts')).toEqual([]);
  });

  it('5. a plain quoted string outside any sql tag is a negative lookalike, not a finding', () => {
    const source = "export const label = 'sum(includedAmount)';";
    expect(findUnguardedPesoTotals(source, 'src/db/repositories/example.ts')).toEqual([]);
  });

  it('6. nested call wrapping: coalesce(sum(${includedAmount}), 0) still fires once', () => {
    const source = `export const total = sql${BACKTICK}coalesce(sum(\${includedAmount}), 0)${BACKTICK};`;
    const findings = findUnguardedPesoTotals(source, 'src/db/repositories/example.ts');
    expect(findings).toHaveLength(1);
  });

  it('7. a nested sql tag inside a ${…} interpolation is attributed to its own (nested) line', () => {
    const source = [
      `export const outer = sql${BACKTICK}select * from (`,
      `  \${sql${BACKTICK}select sum(\${includedAmount}) from transactions${BACKTICK}}`,
      `) as sub${BACKTICK};`,
    ].join('\n');
    const findings = findUnguardedPesoTotals(source, 'src/db/repositories/example.ts');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.line).toBe(2);
  });

  it('8. only summation is guarded: count(${includedAmount}) and avg(${includedAmount}) produce no finding', () => {
    const source = `export const q = sql${BACKTICK}select count(\${includedAmount}), avg(\${includedAmount}) from transactions${BACKTICK};`;
    expect(findUnguardedPesoTotals(source, 'src/db/repositories/example.ts')).toEqual([]);
  });

  it('9. case and whitespace variants: SUM( and sum ( each fire', () => {
    const source = `export const q = sql${BACKTICK}SUM(\${includedAmount}) + sum (\${includedAmount})${BACKTICK};`;
    const findings = findUnguardedPesoTotals(source, 'src/db/repositories/example.ts');
    expect(findings).toHaveLength(2);
  });

  it('10. allowlisted paths produce no finding even containing every violating form', () => {
    const source = `export const q = sql${BACKTICK}SUM(\${includedAmount}) + sum (\${includedAmount})${BACKTICK};`;
    expect(findUnguardedPesoTotals(source, 'src/db/fragments.ts')).toEqual([]);
    expect(findUnguardedPesoTotals(source, 'src/db/checks/peso-total-scan.ts')).toEqual([]);
    expect(findUnguardedPesoTotals(source, 'src/db/checks/__tests__/peso-total-scan.test.ts')).toEqual([]);
  });

  it('11. degenerate inputs terminate without throwing: empty file, and an unterminated template literal', () => {
    expect(() => findUnguardedPesoTotals('', 'src/db/repositories/example.ts')).not.toThrow();
    expect(findUnguardedPesoTotals('', 'src/db/repositories/example.ts')).toEqual([]);

    const unterminated = `export const q = sql${BACKTICK}select sum(\${includedAmount}) from transactions`;
    expect(() => findUnguardedPesoTotals(unterminated, 'src/db/repositories/example.ts')).not.toThrow();
  });

  it('12. a multi-line template whose sum( follows an earlier interpolation reports the correct line (line-number drift fix)', () => {
    // Without padding for the two characters `scanTemplateBody` skips (`${`) and the one
    // character `scanExpression` consumes (`}`), `body` drifts three characters short of its
    // matching `stripped` span per interpolation — enough, here, to land the line lookup on the
    // newline *before* line 3 and misattribute the finding to line 2.
    const source = [
      `export const q = sql${BACKTICK}`,
      `  select \${otherThing}`,
      `  sum(\${includedAmount})`,
      `${BACKTICK};`,
    ].join('\n');
    const findings = findUnguardedPesoTotals(source, 'src/db/repositories/example.ts');
    expect(findings).toHaveLength(1);
    expect(findings[0]?.line).toBe(3);
  });

  it('13. a nested-generic sql tag (sql<Array<number>>) is still recognised as a tag body (nested-generic fix)', () => {
    const source = `export const total = sql<Array<number>>${BACKTICK}select sum(\${includedAmount}) from transactions${BACKTICK};`;
    const findings = findUnguardedPesoTotals(source, 'src/db/repositories/example.ts');
    expect(findings).toHaveLength(1);
  });
});
