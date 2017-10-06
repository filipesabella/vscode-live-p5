import 'mocha';
import { expect } from 'chai';
import { getVars, codeHasChanged, parseCode } from '../src/code-parser';

describe('code-parser', () => {
  xdescribe('getVars', () => {
    it('hashes variables', () => {
      expect(getVars('let a = 1;')).to.deep.eq({ a1: 1 });
      expect(getVars('const a = 1;')).to.deep.eq({ a1: 1 });
      expect(getVars('const a = 1; const b = 1;')).to.deep.eq({ a1: 1, a2: 1 });
      expect(getVars('const a = 1;\nconst b = 1;')).to.deep.eq({ a1: 1, a2: 1 });

      // illegal but lets handle it
      expect(getVars('const a = 1;const a = 1;')).to.deep.eq({ a1: 1, a2: 1 });
      expect(getVars('const a = 1;\nconst a = 1;')).to.deep.eq({ a1: 1, a2: 1 });
    });

    it('hashes simple method calls', () => {
      expect(getVars('m(1);')).to.deep.eq({ a1: 1 });
      expect(getVars('m(1, 1);')).to.deep.eq({ a1: 1, a1_1: 1 });
      expect(getVars('m(1,\n1);')).to.deep.eq({ a1: 1, a1_1: 1 });
      expect(getVars('m(1,\n\t\t1);')).to.deep.eq({ a1: 1, a1_1: 1 });
    });

    it('hashes nested method calls', () => {
      expect(getVars('m(1, m2(1));')).to.deep.eq({ a1: 1, a1_1: 1 });
      expect(getVars('m(1, m(1));')).to.deep.eq({ a1: 1, a1_1: 1 });
    });
  });

  describe('codeHasChanged', () => {
    it('detects if the code has changed', () => {
      parseCode(`
        let a = 1;
      `);
      expect(codeHasChanged(`
        let a = 1;
      `)).to.be.false;

      parseCode(`
        let a = 1;
      `);
      expect(codeHasChanged(`
        let b = 1;
      `)).to.be.true;

      parseCode(`
        console.log('a');
        `);
      expect(codeHasChanged(`
        console.log('a', 'b');
      `)).to.be.true;
    });

    it('ignores formatting changes', () => {
      parseCode(`
        let a = 1;
        console.log(a);
      `);
      expect(codeHasChanged(`
        let a = 1;

             console.log(a);
      `)).to.be.false;
    });

    it('ignores literal value changes', () => {
      parseCode(`
        let a = 1;
        console.log('a');
        `);
      expect(codeHasChanged(`
        let a = 11;
        console.log('b');
      `)).to.be.false;
    });
  });
});
