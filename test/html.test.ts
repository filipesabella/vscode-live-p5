import {
  describe,
  expect,
  it,
} from 'vitest';
import { createHtml } from '../src/html';

describe('createHtml', () => {
  const html = (code: string) =>
    createHtml(code, ['https://assets/p5.min.js'], 'vscode-resource:', 'n0nce');

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
});
