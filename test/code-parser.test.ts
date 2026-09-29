import * as recast from 'recast';
import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  codeHasChanged,
  getVars,
  parseCode,
} from '../src/code-parser';

describe('code-parser', () => {
  describe('getVars', () => {
    it('hashes variables', () => {
      expect(getVars('let a = 1;')).toEqual({ a1: 1 });
      expect(getVars('const a = 1;')).toEqual({ a1: 1 });
      expect(getVars('const a = 1; const b = 1;')).toEqual({ a1: 1, a2: 1 });
      expect(getVars('const a = 1;\nconst b = 1;')).toEqual({ a1: 1, a2: 1 });

      // illegal but lets handle it
      expect(getVars('const a = 1;const a = 1;')).toEqual({ a1: 1, a2: 1 });
      expect(getVars('const a = 1;\nconst a = 1;')).toEqual({ a1: 1, a2: 1 });
    });

    it('hashes simple method calls', () => {
      expect(getVars('m(1);')).toEqual({ a1: 1 });
      expect(getVars('m(1, 1);')).toEqual({ a1: 1, a1_1: 1 });
      expect(getVars('m(1,\n1);')).toEqual({ a1: 1, a1_1: 1 });
      expect(getVars('m(1,\n\t\t1);')).toEqual({ a1: 1, a1_1: 1 });
    });

    it('hashes nested method calls', () => {
      expect(getVars('m(1, m2(1));')).toEqual({ a1: 1, a1_1: 1 });
      expect(getVars('m(1, m(1));')).toEqual({ a1: 1, a1_1: 1 });
    });
  });

  describe('parseCode on globals', () => {
    it('inlines globals', () => {
      const code = parseCode(`
      const ooo = 1;
      function draw() {
        const aaa = 2;
        console.log(ooo, aaa);
      }`);

      compareCode(
        code,
        `
      const __AllVars = {"a1":1,"a4":2}; const ooo = __AllVars.a1;
      function draw() {
        const aaa = __AllVars.a4;
        console.log(__AllVars.a1, aaa);
      }`,
      );
    });

    it('tries not to replace shadowed globals', () => {
      const code = parseCode(`
        let ooo = 1;
        function draw() {
          let ooo = 2;
          const aaa = 3;
          console.log(ooo, aaa);
        }`);

      compareCode(
        code,
        `
        const __AllVars = {"a1":1,"a4":2,"a5":3};
        let ooo = __AllVars.a1;
        function draw() {
          let ooo = __AllVars.a4;
          const aaa = __AllVars.a5;
          console.log(__AllVars.a4, aaa);
        }`,
      );
    });
  });

  describe('parseCode on syntax errors', () => {
    it('falls back to the last code that parsed', () => {
      const valid = parseCode('let a = 1;');
      expect(parseCode('let a = ;')).toBe(valid);
    });
  });

  describe('codeHasChanged', () => {
    it('detects if the code has changed', () => {
      parseCode(`
        let a = 1;
      `);
      expect(codeHasChanged(`
        let a = 1;
      `)).toBe(false);

      parseCode(`
        let a = 1;
      `);
      expect(codeHasChanged(`
        let b = 1;
      `)).toBe(true);

      parseCode(`
        console.log('a');
        `);
      expect(codeHasChanged(`
        console.log('a', 'b');
      `)).toBe(true);
    });

    it('ignores formatting changes', () => {
      parseCode(`
        let a = 1;
        console.log(a);
      `);
      expect(codeHasChanged(`
        let a = 1;

             console.log(a);
      `)).toBe(false);
    });

    it('ignores literal value changes', () => {
      parseCode(`
        let a = 1;
        console.log('a');
        `);
      expect(codeHasChanged(`
        let a = 11;
        console.log('b');
      `)).toBe(false);
    });
  });
});

function compareCode(actual: string, expected: string) {
  expect(
    recast.prettyPrint(recast.parse(actual)).code,
  ).toBe(
    recast.prettyPrint(recast.parse(expected)).code,
  );
}
