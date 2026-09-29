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
  return parseInt(version) < 2
    ? [cdn('lib/p5.min.js'), cdn('lib/addons/p5.sound.min.js')]
    : [cdn('lib/p5.min.js'), bundled.sound];
}

export const lastP5v1 = '1.11.13';

/**
 * Where a sketch declares `preload`, which p5.js 2 no longer calls, when it
 * would run on p5.js 2.
 */
export function removedPreload(
  code: string,
): { start: number, end: number } | undefined {
  const version = p5Version(code);
  if (version && parseInt(version) < 2) {
    return undefined;
  }

  const match = code.match(/^[ \t]*(?:async\s+)?function\s+(preload)\s*\(/m);
  if (!match) {
    return undefined;
  }

  const start = match.index + match[0].lastIndexOf('preload');
  return { start, end: start + 'preload'.length };
}
