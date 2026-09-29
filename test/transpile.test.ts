import {
  describe,
  expect,
  it,
} from 'vitest';
import { transpile } from '../src/transpile';

describe('transpile', () => {
  it('strips types from typescript', () => {
    const code = transpile(
      `
      enum Mode { A, B }
      let size: number = 10;
      function setup(): void {
        createCanvas(size as number, size);
      }`,
      'typescript',
    );

    expect(code).not.toMatch(/: number|: void| as number/);
    expect(code).not.toContain('use strict');
    expect(new Function(`${code}; return Mode.B;`)()).toBe(1);
  });

  it('leaves javascript untouched', () => {
    const code = 'let size = 10;';
    expect(transpile(code, 'javascript')).toBe(code);
  });
});
