import {
  describe,
  expect,
  it,
} from 'vitest';
import {
  p5Scripts,
  p5Version,
} from '../src/p5-version';

const bundled = { p5: 'bundled/p5.min.js', sound: 'bundled/p5.sound.min.js' };
const cdn = 'https://cdn.jsdelivr.net/npm/';

describe('p5Version', () => {
  it('reads the version from a @p5 comment', () => {
    expect(p5Version('// @p5 1.11.13\nfunction setup() {}')).toBe('1.11.13');
    expect(p5Version('let a;\n  //@p5 latest  \n')).toBe('latest');
  });

  it('is undefined without a @p5 comment', () => {
    expect(p5Version('function setup() {}')).toBeUndefined();
    expect(p5Version('// uses @p5 1.0.0 somewhere')).toBeUndefined();
  });

  it('ignores versions that could change the url', () => {
    expect(p5Version('// @p5 1.0.0/../evil')).toBeUndefined();
  });
});

describe('p5Scripts', () => {
  it('uses the bundled scripts without a version', () => {
    expect(p5Scripts(undefined, bundled)).toEqual([
      bundled.p5,
      bundled.sound,
    ]);
  });

  it('loads p5 1.x with its own p5.sound', () => {
    expect(p5Scripts('1.11.13', bundled)).toEqual([
      cdn + 'p5@1.11.13/lib/p5.min.js',
      cdn + 'p5@1.11.13/lib/addons/p5.sound.min.js',
    ]);
  });

  it('loads p5 2.x with the bundled p5.sound', () => {
    expect(p5Scripts('2.0.0', bundled)).toEqual([
      cdn + 'p5@2.0.0/lib/p5.min.js',
      bundled.sound,
    ]);
    expect(p5Scripts('latest', bundled)).toEqual([
      cdn + 'p5@latest/lib/p5.min.js',
      bundled.sound,
    ]);
  });
});
