# Changelog

## 2.0.0

### p5.js 2

The preview now runs **p5.js 2.3.4**, and loads **p5.sound 0.4.1**, so
sketches can use sound.

p5.js 2 is not fully compatible with sketches written for p5.js 1. For
example, `preload()` has been replaced by `async setup()`. See the
[compatibility guide](https://github.com/processing/p5.js-compatibility) to
update your sketches.

#### Using your own p5 version

To keep a sketch on p5.js 1, or to try any other version, add a
`// @p5 <version>` line to it. The preview then loads that version from
jsDelivr instead of the bundled one:

```js
// @p5 1.11.13
function setup() {
  createCanvas(400, 400);
}
```

Any published version works, including `latest`. Versions before 2.0 load the
p5.sound that shipped with them, and completions switch to p5.js 1's functions
and docs. If the version can't be loaded, the output panel says so.

This needs an internet connection; sketches without the line keep using the
bundled p5.js 2.3.4 and work offline.

Sketches that still declare `preload()` get a warning in the editor, with a
quick fix (Ctrl+. / Cmd+.) that adds `// @p5 1.11.13` for you, and a link to
the compatibility guide.

### Loading files

Sketches can now load images, fonts, sounds, models and data with paths
relative to the sketch file, like `loadImage('cat.png')`, or from anywhere in
the sketch's workspace folder. (#12)

### Console output

`console.log`, warnings, errors and uncaught exceptions now show up in the
**Live p5** output panel, instead of only in the developer tools. Logging
several values at once, like `console.log(x, y)`, works too, and values like
`NaN` and `Infinity` show as themselves. (#24)

### TypeScript

p5 now ships its own types, so `@types/p5` is no longer needed:

```
npm install p5 --save-dev
```

```
/// <reference path="node_modules/p5/types/global.d.ts" />
```

### Fixes

- The preview follows the sketch it was opened for, instead of whichever
  editor has focus.
- Closing the preview no longer causes errors on the next edit.
- Running the command again brings the existing preview forward instead of
  opening another one.
- Syntax errors while typing no longer throw; the preview keeps the last
  version that worked.
- Value changes made while the preview is hidden are no longer lost, and the
  sketch keeps running when you switch tabs.
- Sketches using names like `.constructor` or `.toString` now work; before,
  the preview silently kept showing the previous code.
- The preview opens beside the sketch without taking focus.
- The command now shows a message when run on a file that isn't JavaScript
  or TypeScript.
- With auto save on, the sketch no longer restarts every time you pause
  typing; only saving by hand restarts it.
- Changing a sketch's language mode no longer closes the preview.
- A sketch with a syntax error no longer shows the previous sketch's code.
- Sketch code containing `<!--` or `<script` in a string no longer stops the
  sketch from running.

### Completions

Completions now cover p5.js 2's global functions and properties, plus
p5.sound's, with links to the p5.js reference. Sketches with a `// @p5 1.x`
line get p5.js 1's completions instead.

### Other

- Requires VS Code 1.138 or later.
- The extension is much smaller (about 0.6 MB).
