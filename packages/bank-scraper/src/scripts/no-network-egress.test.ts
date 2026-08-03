import { allGeneratedScriptSources } from './all-generated-scripts';

/**
 * No injected script talks to any server other than the bank's own site (spec Business Rule 8,
 * AC31; implementation plan Escalation Check). ESLint's `no-restricted-globals` covers the
 * TypeScript half; this scans the **generated script strings**, which ESLint cannot see inside.
 */
const FORBIDDEN_TOKENS = ['fetch(', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'sendBeacon'];

function findEgressTokens(source: string): string[] {
  return FORBIDDEN_TOKENS.filter((token) => source.includes(token));
}

describe('no-network-egress', () => {
  const sources = allGeneratedScriptSources();

  it.each(Object.entries(sources))('%s contains no network-egress token', (_name, source) => {
    expect(findEgressTokens(source)).toEqual([]);
  });

  it('fires on a planted violation (recorded in the PR): adding a fetch() call to a generated source', () => {
    const plantedSource = `${sources.commonHelperFunctions}\nfetch('https://example.com');`;
    expect(findEgressTokens(plantedSource)).toEqual(['fetch(']);
  });

  it('does not over-fire: window.ReactNativeWebView.postMessage — the only outbound channel — is untouched', () => {
    expect(findEgressTokens(sources.commonHelperFunctions ?? '')).toEqual([]);
    expect(sources.commonHelperFunctions).toContain('window.ReactNativeWebView.postMessage');
  });
});
