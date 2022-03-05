# live-p5

Provides a live preview panel of your P5 code.

It enables you to change variable values without reloading the P5 rendering, see the gif below:

![In action](image.gif)

## How to use it

* Open your javascript p5 code with a `draw` function
* Type **"live p5"** on the command palette and press enter
* When editing literal values, the preview is updated automatically
* When saving the document, the preview reloads

## Using it with typescript

Rudimentary typescript support has been added.

In order to vscode to typecheck your file, you need to install p5's types:

```
npm install @types/p5 --save-dev
```

Then create your sketch as a `.ts` file and add the following to it at the top:

```
/// <reference path="node_modules/@types/p5/global.d.ts" />
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

### Where do my `console.log`s and runtime errors go?

Because of how the preview panel works in vscode, prints and runtime errors get printed to the developer console (menu _Help > Toggle Developer Tools_).  

The original extension by pixelkind does a workaround for print statements, but there's no way around the runtime errors.  
Because of this I decided to remove the workaround completely and now it is necessary to have the developer console open when working with this extension.

Another caveat is that the preview panel does not implement `console.log` correctly, as it doesn't support multiple arguments. So sadly you must concatecate strings yourself, for example:

```javascript
console.log(1, 2, 3); // prints [Embedded page] 1
console.log("1, 2, 3"); // prints [Embedded page] 1, 2, 3
```

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
