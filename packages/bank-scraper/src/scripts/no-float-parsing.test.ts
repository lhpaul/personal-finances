import { allGeneratedScriptSources } from './all-generated-scripts';

/**
 * `parseFloat` is banned in every injected script, checked here because ESLint's
 * `no-restricted-globals` cannot see inside a template literal (implementation plan Decision 10,
 * Escalation Check). A peso amount that parses through a float is a defect, not a rounding
 * question (spec Business Rule 9).
 */
const FORBIDDEN_PATTERN = /parseFloat|Number\.parseFloat|\.toFixed\(/u;

describe('no-float-parsing', () => {
  const sources = allGeneratedScriptSources();

  it.each(Object.entries(sources))('%s does not contain parseFloat, Number.parseFloat or toFixed', (_name, source) => {
    expect(FORBIDDEN_PATTERN.test(source)).toBe(false);
  });

  it('fires on a planted violation (recorded in the PR): adding parseFloat(x) to a generated source', () => {
    const plantedSource = `${sources.commonHelperFunctions}\nconst x = parseFloat('1.5');`;
    expect(FORBIDDEN_PATTERN.test(plantedSource)).toBe(true);
  });

  it('does not over-fire: a source containing the substring "float" in a comment/identifier, but not parseFloat, passes', () => {
    const benignSource = "// this variable is not a floating point value\nconst floatingPointFree = 1;";
    expect(FORBIDDEN_PATTERN.test(benignSource)).toBe(false);
  });
});
