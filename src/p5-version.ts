import * as recast from 'recast';
import p5v1Docs from '../assets/p5-v1-docs.json';

// a `// @p5 1.11.13` line makes the preview load that p5 version instead of
// the bundled one
const directive = /^\s*\/\/\s*@p5\s+([\w.-]+)\s*$/m;

export function p5Version(code: string): string | undefined {
  return code.match(directive)?.[1];
}

export interface BundledScripts {
  p5: string;
  sound: string;
}

export function p5Scripts(
  version: string | undefined,
  bundled: BundledScripts,
): string[] {
  if (!version) {
    return [bundled.p5, bundled.sound];
  }

  const cdn = (path: string) =>
    `https://cdn.jsdelivr.net/npm/p5@${version}/${path}`;

  // p5 1.x shipped its own p5.sound, the bundled one only works with 2.x
  return isP5v1(version)
    ? [cdn('lib/p5.min.js'), cdn('lib/addons/p5.sound.min.js')]
    : [cdn('lib/p5.min.js'), bundled.sound];
}

// the p5.js 1 release the completions document, and the quick fix picks
export const lastP5v1 = p5v1Docs.version;

export function isP5v1(version: string | undefined): boolean {
  return version !== undefined && parseInt(version) < 2;
}

/**
 * Where a sketch declares `preload`, which p5.js 2 no longer calls, when it
 * would run on p5.js 2. Takes JavaScript, and throws if it doesn't parse.
 */
export function removedPreload(
  code: string,
): { line: number, column: number } | undefined {
  if (isP5v1(p5Version(code))) {
    return undefined;
  }

  const preload = recast.parse(code).program.body.find(node =>
    node.type === 'FunctionDeclaration' && node.id?.name === 'preload'
  );

  return preload && {
    line: preload.id.loc.start.line,
    column: preload.id.loc.start.column,
  };
}
