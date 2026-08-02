import { findInclusionRuleRestatements } from '../inclusion-rule-scan';

/**
 * Implementation plan Testing Strategy, parser-risk addendum — "one `it(...)` per row of the
 * [inclusion-rule scanner] table (18 [sic; 20 as transcribed] cases), each asserting the exact
 * finding count and rule." This is that suite (AC20).
 */

const FILE = 'apps/mobile/src/db/repositories/transactions.ts';

describe('findInclusionRuleRestatements', () => {
  it('flags the canonical second definition inside a sql-tagged template (rule A)', () => {
    const source = 'where(sql`${transactions.excludedAt} is null`)';
    const findings = findInclusionRuleRestatements(source, FILE);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule).toBe('A');
  });

  it('flags the raw-string form via sql.raw, which evades rule A entirely (rule C)', () => {
    const source = "sql.raw('excluded_at IS NULL')";
    const findings = findInclusionRuleRestatements(source, FILE);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule).toBe('C');
  });

  it('flags the Drizzle isNull operator form, which contains no SQL text at all (rule B)', () => {
    const source = 'isNull(transactions.excludedAt)';
    const findings = findInclusionRuleRestatements(source, FILE);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule).toBe('B');
  });

  it('flags isNull through a local alias (rule B, an alias must not evade it)', () => {
    const source = 'const t = transactions;\nisNull(t.excludedAt)';
    const findings = findInclusionRuleRestatements(source, FILE);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule).toBe('B');
  });

  it('flags the negated isNotNull operator (rule B, boundary variant)', () => {
    const source = 'isNotNull(transactions.excludedAt)';
    const findings = findInclusionRuleRestatements(source, FILE);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule).toBe('B');
  });

  it('reports each occurrence on one line separately (2 findings, rule A)', () => {
    const source =
      'sql`${t.excludedAt} is null and coalesce(${t.includedAmount}, ${t.amount}) > 0`';
    const findings = findInclusionRuleRestatements(source, FILE);
    expect(findings).toHaveLength(2);
    expect(findings.every((f) => f.rule === 'A')).toBe(true);
  });

  it('scans nested tagged templates and reports only the inner occurrence (1 finding, rule A)', () => {
    const source = 'sql`select 1 from x where a in (${sql`${t.excludedAt} is null`})`';
    const findings = findInclusionRuleRestatements(source, FILE);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.rule).toBe('A');
  });

  it('never flags the correct use of the shared fragment (0 findings)', () => {
    const source = "where(isIncluded)\nsum(includedAmount)";
    expect(findInclusionRuleRestatements(source, FILE)).toEqual([]);
  });

  it('does not flag writing the value (0 findings)', () => {
    const source = ".set({ excludedAt: nowIso, exclusionReason: 'other' })";
    expect(findInclusionRuleRestatements(source, FILE)).toEqual([]);
  });

  it('does not flag reading the value in plain JavaScript (0 findings)', () => {
    const source = 'if (row.excludedAt !== null) { doSomething(); }';
    expect(findInclusionRuleRestatements(source, FILE)).toEqual([]);
  });

  it('strips line comments before scanning (0 findings)', () => {
    const source = '// excluded_at is null — see fragments.ts';
    expect(findInclusionRuleRestatements(source, FILE)).toEqual([]);
  });

  it('strips multi-line block comments before scanning (0 findings)', () => {
    const source = '/* excluded_at\n   is null */';
    expect(findInclusionRuleRestatements(source, FILE)).toEqual([]);
  });

  it('does not flag an untagged template literal (0 findings, negative lookalike)', () => {
    const source = '`plain template ${transactions.excludedAt}`';
    expect(findInclusionRuleRestatements(source, FILE)).toEqual([]);
  });

  it('does not flag a similarly-named tag (mysql / sqlish) (0 findings, negative lookalike)', () => {
    const source = 'mysql`${t.excludedAt} is null`;\nsqlish`whatever`;';
    expect(findInclusionRuleRestatements(source, FILE)).toEqual([]);
  });

  it('does not flag an import specifier (0 findings)', () => {
    const source = "import { isIncluded } from '../fragments';";
    expect(findInclusionRuleRestatements(source, FILE)).toEqual([]);
  });

  it('produces identical findings for CRLF line endings (boundary: line-ending normalisation)', () => {
    const lf = 'where(sql`${transactions.excludedAt} is null`)';
    const crlf = lf.replace(/\n/g, '\r\n');
    const lfFindings = findInclusionRuleRestatements(lf, FILE);
    const crlfFindings = findInclusionRuleRestatements(crlf, FILE);
    expect(crlfFindings.map((f) => f.rule)).toEqual(lfFindings.map((f) => f.rule));
    expect(crlfFindings).toHaveLength(lfFindings.length);
  });

  it('allowlists src/db/fragments.ts even when it contains all three forms (0 findings)', () => {
    const source = [
      "sql.raw('excluded_at IS NULL')",
      'isNull(transactions.excludedAt)',
      'sql`${transactions.excludedAt} is null`',
    ].join('\n');
    expect(findInclusionRuleRestatements(source, 'apps/mobile/src/db/fragments.ts')).toEqual([]);
  });

  it('allowlists src/db/schema.ts even when it declares the included_amount column (0 findings)', () => {
    const source = "includedAmount: integer('included_amount'),";
    expect(findInclusionRuleRestatements(source, 'apps/mobile/src/db/schema.ts')).toEqual([]);
  });

  it('allowlists its own source file, whose rule definitions contain the literal spellings (0 findings)', () => {
    const source = "const RULE_C_PATTERNS = [/excluded_at/gi, /included_amount/gi];";
    expect(
      findInclusionRuleRestatements(source, 'apps/mobile/src/db/checks/inclusion-rule-scan.ts'),
    ).toEqual([]);
  });

  it('allowlists its own test file, whose fixtures deliberately restate the rule as scanner input (0 findings)', () => {
    const source = "const source = \"sql.raw('excluded_at IS NULL')\";";
    expect(
      findInclusionRuleRestatements(
        source,
        'apps/mobile/src/db/checks/__tests__/inclusion-rule-scan.test.ts',
      ),
    ).toEqual([]);
  });
});
