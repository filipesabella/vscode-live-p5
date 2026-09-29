// sketches commonly load images, fonts, sounds and data from anywhere
const sketchAssetSources = 'https: http: data: blob:';

export interface HtmlOptions {
  code: string;
  scriptUris: string[];
  cspSource: string;
  nonce: string;
  // relative paths in the sketch, like `loadImage('cat.png')`, resolve
  // against this; unsaved sketches have none
  baseUri?: string;
}

export function createHtml(
  { code, scriptUris, cspSource, nonce, baseUri }: HtmlOptions,
): string {
  const csp = [
    `default-src 'none'`,
    `img-src ${cspSource} ${sketchAssetSources}`,
    `media-src ${cspSource} ${sketchAssetSources}`,
    `font-src ${cspSource} ${sketchAssetSources}`,
    `connect-src ${cspSource} ${sketchAssetSources}`,
    `style-src ${cspSource} 'unsafe-inline'`,
    // p5.strands compiles shaders with `new Function`, p5.sound loads its
    // audio worklets and worker from blob URLs
    `script-src 'nonce-${nonce}' 'unsafe-eval' blob:`,
    `worker-src blob:`,
  ].join('; ');

  const scriptTags = scriptUris
    .map(uri => `<script nonce="${nonce}" src="${uri}"></script>`)
    .join('\n');

  return `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta http-equiv="Content-Security-Policy" content="${csp}">
        ${baseUri ? `<base href="${escapeAttribute(baseUri)}">` : ''}
        <script nonce="${nonce}">${forwardConsole}</script>
        ${scriptTags}
        <style>body { padding: 0; margin: 0; }</style>
      </head>
      <body>
        <script nonce="${nonce}">${runSketch(code)}</script>
        <script nonce="${nonce}">
          window.addEventListener('message', event => {
            Object.assign(__AllVars, event.data.vars);
          });
        </script>
      </body>
    </html>`;
}

/**
 * Sends console output and uncaught errors to the extension, which shows them
 * in an output channel. The console keeps working as usual.
 */
const forwardConsole = `(() => {
  const vscode = acquireVsCodeApi();

  const show = value => {
    if (typeof value !== 'object' || value === null) return String(value);
    if (value instanceof Error) return value.stack || String(value);
    try {
      return JSON.stringify(value) ?? String(value);
    } catch {
      return String(value);
    }
  };

  // drops %c styling, which only makes sense in the dev tools
  const format = args => {
    if (typeof args[0] !== 'string' || !args[0].includes('%c')) {
      return args.map(show).join(' ');
    }
    const styles = args[0].split('%c').length - 1;
    return [args[0].replaceAll('%c', ''), ...args.slice(1 + styles)]
      .map(show).join(' ');
  };

  const send = (level, text) => {
    try {
      vscode.postMessage({ log: { level, text } });
    } catch {}
  };

  ['log', 'info', 'debug', 'warn', 'error'].forEach(level => {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      original(...args);
      send(level, format(args));
    };
  });

  // capturing, as a script or image that fails to load fires an error event
  // on itself, which doesn't bubble up to the window
  window.addEventListener('error', e => send('error', e instanceof ErrorEvent
    ? show(e.error ?? e.message)
    : 'Could not load ' + (e.target.src ?? e.target.outerHTML)), true);
  window.addEventListener('unhandledrejection', e => send('error', show(e.reason)));
})();`;

/**
 * Runs the sketch from a blob, so nothing in its code, like a `</script>` in a
 * string, can end the script tag early or otherwise change how the page
 * parses.
 */
function runSketch(code: string): string {
  // `<` escaped, as the JSON string sits inside a script tag itself
  const source = JSON.stringify(code).replace(/</g, '\\u003c');
  return `(() => {
    const script = document.createElement('script');
    script.src = URL.createObjectURL(
      new Blob([${source}], { type: 'text/javascript' }));
    document.body.append(script);
  })();`;
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}
