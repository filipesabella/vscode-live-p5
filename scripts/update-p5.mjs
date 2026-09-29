// Downloads p5 and p5.sound into assets/ and regenerates the completion docs.
// Usage: node scripts/update-p5.mjs <p5 version> <p5.sound version>
import { NodeHtmlMarkdown } from 'node-html-markdown';
import { writeFile } from 'node:fs/promises';

const [p5Version, soundVersion] = process.argv.slice(2);

if (!p5Version || !soundVersion) {
  console.error(
    'Usage: node scripts/update-p5.mjs <p5 version> <p5.sound version>',
  );
  process.exit(1);
}

const npmFile = (pkg, version, path) =>
  `https://cdn.jsdelivr.net/npm/${pkg}@${version}/${path}`;

const download = async url => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${response.status} ${url}`);
  }
  return response.text();
};

const [p5, sound, soundSource, reference] = await Promise.all([
  download(npmFile('p5', p5Version, 'lib/p5.min.js')),
  download(npmFile('p5.sound', soundVersion, 'dist/p5.sound.min.js')),
  download(npmFile('p5.sound', soundVersion, 'dist/p5.sound.js')),
  download(
    'https://raw.githubusercontent.com/processing/p5.js/'
      + `v${p5Version}/docs/converted.json`,
  ).then(JSON.parse),
]);

const toMarkdown = html =>
  NodeHtmlMarkdown.translate(
    html
      .replace(/href="#\/(p5\/)?/g, 'href="https://p5js.org/reference/p5/')
      .replace(/href="\//g, 'href="https://p5js.org/'),
  );

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

const soundDocs = [...soundSource.matchAll(/\/\*\*([\s\S]*?)\*\//g)]
  .map(m => m[1].replace(/^\s*\* ?/gm, ''))
  .map(comment => ({
    name: comment.match(/^@method (\w+)/m)?.[1],
    description: comment.split(/^@/m)[0].trim(),
  }))
  .filter(d => soundGlobals.has(d.name) && d.description)
  .map(d => ({
    name: d.name,
    module: 'p5.sound',
    description: toMarkdown(d.description),
  }));

const docs = [...coreDocs, ...soundDocs]
  .filter((d, i, all) => all.findIndex(o => o.name === d.name) === i);

await Promise.all([
  writeFile('assets/p5.min.js', p5),
  writeFile('assets/p5.sound.min.js', sound),
  writeFile('assets/p5-docs.json', JSON.stringify(docs, null, 2) + '\n'),
]);

console.log(
  `p5 ${p5Version}, p5.sound ${soundVersion}, ${docs.length} completions`,
);
