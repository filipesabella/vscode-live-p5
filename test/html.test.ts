import {
  describe,
  expect,
  it,
} from 'vitest';
import { createHtml } from '../src/html';

describe('createHtml', () => {
  const html = (code: string, baseUri?: string) =>
    createHtml({
      code,
      scriptUris: ['https://assets/p5.min.js'],
      cspSource: 'vscode-resource:',
      nonce: 'n0nce',
      baseUri,
    });

  it('allows only nonced scripts', () => {
    expect(html('')).toContain(`script-src 'nonce-n0nce' 'unsafe-eval' blob:`);
    expect(html('').match(/<script(?! nonce="n0nce")/g)).toBeNull();
  });

  it('loads the given scripts', () => {
    expect(html('')).toContain(
      '<script nonce="n0nce" src="https://assets/p5.min.js"></script>',
    );
  });

  it('keeps a closing script tag in the code from ending the script', () => {
    const code = `const s = '</script><script>alert(1)</script>';`;
    expect(html(code)).toContain(
      `const s = '<\\/script><script>alert(1)<\\/script>';`,
    );
  });

  it('resolves relative paths against the sketch folder', () => {
    expect(html('', 'https://sketch/"folder/')).toContain(
      '<base href="https://sketch/&quot;folder/">',
    );
    expect(html('')).not.toContain('<base');
  });

  it('forwards console output before any other script runs', () => {
    const page = html('');
    expect(page.indexOf('acquireVsCodeApi')).toBeGreaterThan(-1);
    expect(page.indexOf('acquireVsCodeApi'))
      .toBeLessThan(page.indexOf('p5.min.js"'));
  });
});
