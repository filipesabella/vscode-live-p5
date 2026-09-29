// Downloads p5 and p5.sound into assets/ and regenerates the completion docs,
// for p5.js 2 and for sketches that pick p5.js 1 with a `// @p5` line.
// Usage: node scripts/update-p5.mjs <p5 version> <p5.sound version> <p5 1.x version>
import { NodeHtmlMarkdown } from 'node-html-markdown';
import { writeFile } from 'node:fs/promises';

const [p5Version, soundVersion, p5v1Version] = process.argv.slice(2);

if (!p5Version || !soundVersion || !p5v1Version) {
  console.error(
    'Usage: node scripts/update-p5.mjs '
      + '<p5 version> <p5.sound version> <p5 1.x version>',
  );
  process.exit(1);
}

const assets = new URL('../assets/', import.meta.url);

const npmFile = (pkg, version, path) =>
  `https://cdn.jsdelivr.net/npm/${pkg}@${version}/${path}`;

const download = async url => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${url}`);
  }
  return response.text();
};

const [p5, sound, soundSource, reference, p5v1Source] = await Promise.all([
  download(npmFile('p5', p5Version, 'lib/p5.min.js')),
  download(npmFile('p5.sound', soundVersion, 'dist/p5.sound.min.js')),
  download(npmFile('p5.sound', soundVersion, 'dist/p5.sound.js')),
  download(
    'https://raw.githubusercontent.com/processing/p5.js/'
      + `v${p5Version}/docs/converted.json`,
  ).then(JSON.parse),
  download(npmFile('p5', p5v1Version, 'lib/p5.js')),
]);

const absoluteLinks = html =>
  html
    .replace(/href="#\/(p5\/)?/g, 'href="https://p5js.org/reference/p5/')
    .replace(/href="\//g, 'href="https://p5js.org/');

const toMarkdown = html => NodeHtmlMarkdown.translate(absoluteLinks(html));

// p5.js 1 doc comments are Markdown already, apart from their links
const linksToMarkdown = text =>
  absoluteLinks(text)
    .replace(/<a href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, '[$2]($1)');

const docComments = source =>
  [...source.matchAll(/\/\*\*([\s\S]*?)\*\//g)]
    .map(m => m[1].replace(/^\s*\* ?/gm, ''));

const tag = (comment, name) =>
  comment.match(new RegExp(`^@${name}\\s+(.+)$`, 'm'))?.[1].trim();

const unique = docs =>
  docs.filter((d, i, all) => all.findIndex(o => o.name === d.name) === i);

const coreDocs = reference.classitems
  .filter(i => i.class === 'p5' && i.module && i.description)
  .map(i => ({
    name: i.name,
    module: i.module,
    description: toMarkdown(i.description),
  }));

// p5.sound publishes no reference data, so its globals are documented from
// the doc comments in the unminified build
const soundGlobals = new Set(
  [...soundSource.matchAll(/p5\.prototype\.(\w+)\s*=/g)].map(m => m[1]),
);

const soundDocs = docComments(soundSource)
  .map(comment => ({
    name: tag(comment, 'method'),
    description: comment.split(/^@/m)[0].trim(),
  }))
  .filter(d => soundGlobals.has(d.name) && d.description)
  .map(d => ({
    name: d.name,
    module: 'p5.sound',
    description: toMarkdown(d.description),
  }));

// neither does p5.js 1; its doc comments name a module and class once, and
// the methods and properties after them belong to those
const p5v1Docs = docComments(p5v1Source)
  .reduce(
    ({ module, cls, docs }, comment) => {
      // a @module comment starts a new source file, which documents p5
      // itself unless it names a class
      const startsFile = tag(comment, 'module') !== undefined;
      const current = {
        module: tag(comment, 'module') ?? module,
        cls: tag(comment, 'class') ?? (startsFile ? 'p5' : cls),
      };
      const name = comment
        .match(/^@(?:method|property)\s+(?:\{[^}]*\}\s+)?(\w+)/m)?.[1];
      const description = comment.split(/^@/m)[0].trim();
      const isGlobal = (tag(comment, 'for') ?? current.cls) === 'p5'
        && !/^@private/m.test(comment);

      return {
        ...current,
        docs: name && description && isGlobal
          ? [...docs, {
            name,
            module: current.module,
            description: linksToMarkdown(description),
          }]
          : docs,
      };
    },
    { module: undefined, cls: undefined, docs: [] },
  )
  .docs;

const writeDocs = (file, version, docs) =>
  writeFile(
    new URL(file, assets),
    JSON.stringify({ version, docs: unique(docs) }, null, 2) + '\n',
  );

await Promise.all([
  writeFile(new URL('p5.min.js', assets), p5),
  writeFile(new URL('p5.sound.min.js', assets), sound),
  writeDocs('p5-docs.json', p5Version, [...coreDocs, ...soundDocs]),
  writeDocs('p5-v1-docs.json', p5v1Version, p5v1Docs),
]);

console.log(
  `p5 ${p5Version}, p5.sound ${soundVersion}, `
    + `${unique([...coreDocs, ...soundDocs]).length} completions; `
    + `p5 ${p5v1Version} ${unique(p5v1Docs).length} completions`,
);
