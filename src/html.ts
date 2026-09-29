// sketches commonly load images, fonts, sounds and data from anywhere
const sketchAssetSources = 'https: http: data: blob:';

export function createHtml(
  code: string,
  scriptUris: string[],
  cspSource: string,
  nonce: string,
): string {
  const csp = [
    `default-src 'none'`,
    `img-src ${cspSource} ${sketchAssetSources}`,
    `media-src ${cspSource} ${sketchAssetSources}`,
    `font-src ${cspSource} ${sketchAssetSources}`,
    `connect-src ${cspSource} ${sketchAssetSources}`,
    `style-src ${cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
  ].join('; ');

  const scriptTags = scriptUris
    .map(uri => `<script nonce="${nonce}" src="${uri}"></script>`)
    .join('\n');

  return `<!DOCTYPE html>
    <html>
      <head>
        <meta http-equiv="Content-Security-Policy" content="${csp}">
        ${scriptTags}
        <style>body { padding: 0; margin: 0; }</style>
      </head>
      <body>
        <script nonce="${nonce}">${escapeScript(code)}</script>
        <script nonce="${nonce}">
          window.addEventListener('message', event => {
            Object.assign(__AllVars, event.data.vars);
          });
        </script>
      </body>
    </html>`;
}

/**
 * Stops a literal `</script>` in the user's code from closing the tag early.
 */
function escapeScript(code: string): string {
  return code.replace(/<\/(script)/gi, '<\\/$1');
}
