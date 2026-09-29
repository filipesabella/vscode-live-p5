# live-p5

Provides a live preview panel of your P5 code.

It enables you to change variable values without reloading the P5 rendering, see the gif below:

![In action](image.gif)

## How to use it

* Open your javascript p5 code with a `draw` function
* Type **"live p5"** on the command palette and press enter
* When editing literal values, the preview is updated automatically
* When saving the document, the preview reloads

The preview runs p5.js 2.3.4 with p5.sound 0.4.1. p5.js 2 is not fully
compatible with sketches written for p5.js 1, see the
[compatibility guide](https://github.com/processing/p5.js-compatibility).

To use a different p5.js version, add a `// @p5 <version>` line to the sketch.
The preview then loads that version from [jsDelivr](https://www.jsdelivr.com/package/npm/p5):

```js
// @p5 1.11.13
function setup() {
  createCanvas(400, 400);
}
```

Any published version works, including `latest`. Versions before 2.0 use the
p5.sound that shipped with them.

If a sketch running on p5.js 2 declares `preload()`, which p5.js 2 no longer
calls, the extension marks it with a warning. Its quick fix adds the
`// @p5 1.11.13` line for you.

## Loading files

Images, fonts, sounds, models and data can be loaded with paths relative to the
sketch, like `loadImage('cat.png')`. Files anywhere in the sketch's workspace
folder work too, e.g. `loadImage('../shared/cat.png')`. Unsaved sketches can
only load files from URLs.

## Console output

`console.log`, `console.warn`, `console.error` and uncaught errors show up in
the **Live p5** output panel, which is cleared each time the sketch reloads.
They also still go to the developer console (_Help > Toggle Developer Tools_).

## Using it with typescript

Rudimentary typescript support has been added.

In order to vscode to typecheck your file, you need to install p5, which ships its types:

```
npm install p5 --save-dev
```

Then create your sketch as a `.ts` file and add the following to it at the top:

```
/// <reference path="node_modules/p5/types/global.d.ts" />
```

### Instanced mode with TS

Follow the steps [here](https://github.com/filipesabella/vscode-live-p5/issues/8).

## Watching documents

If you are using any other means of generating the final js file, the extension
watches the file that is currently open when you activate the extension.

External modifications to the file trigger the refresh in the live-p5 panel.

## Caveats

### When **not** reloading is not a good thing

The extension tries its best to only reload P5 when necessary; it does this by analysing if a code change only affected literal values (numbers, booleans, and strings).

This is a problem when changing literals that are not used in the `draw` loop. For instance, if you change a literal that affects how the `setup` function works, P5 will only be reloaded when you save your document.

## How does it work?

It is not very pretty.

Using the excellent [recast](https://github.com/benjamn/recast) library, the extension transforms the code you typed into something else:

```javascript
function draw() {
  console.log(1);
}
```

Becomes:

```javascript
const __AllVars = {
  aHash: 1
};

function draw() {
  console.log(__AllVars['aHash']);
}
```

When editing your code, if the `1` literal is changed to `11`, the extension sends an updated `__AllVars` hash to the preview panel using websockets, and updates the hash in memory, thus not reloading the panel but affecting what gets rendered.

If there are any changes to the code's structure, the panel is reloaded automatically.
