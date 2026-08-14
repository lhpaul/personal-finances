import { resolveWebViewSource } from './webview-source';

const config = { url: 'https://bank.example' };

describe('resolveWebViewSource', () => {
  it('does not emit uri about:blank (that source crashes iOS WKWebView)', () => {
    expect(resolveWebViewSource('about:blank', config)).toEqual({
      html: '<html><body></body></html>',
    });
  });

  it('loads a remote bank URL as uri', () => {
    expect(resolveWebViewSource('https://bank.example/login', config)).toEqual({
      uri: 'https://bank.example/login',
    });
  });

  it('loads synthetic-bank HTML with the config url as baseUrl after leaving about:blank', () => {
    const synthetic = {
      url: 'https://example.test',
      inlineHtml: '<html><body>lab</body></html>',
    };
    expect(resolveWebViewSource('https://example.test', synthetic)).toEqual({
      html: '<html><body>lab</body></html>',
      baseUrl: 'https://example.test',
    });
    expect(resolveWebViewSource('about:blank', synthetic)).toEqual({
      html: '<html><body></body></html>',
    });
  });
});
