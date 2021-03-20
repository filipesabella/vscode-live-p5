import * as path from 'path';
import * as ts from 'typescript';
import * as vscode from 'vscode';
import * as parser from './code-parser';

let panel: any;

export function activate(context: vscode.ExtensionContext): void {
  const assetsPath = vscode.Uri.file(
    path.join(context.extensionPath, 'assets')
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('extension.live-p5', () => {
      // Property 'createWebviewPanel' does not exist on type window :(
      panel = vscode.window['createWebviewPanel'](
        'extension.live-p5',
        'Live p5',
        vscode.ViewColumn.Two,
        {
          enableScripts: true,
          localResourceRoots: [assetsPath],
        },
      );

      const fileName = vscode.window.activeTextEditor.document.fileName;
      vscode.workspace.createFileSystemWatcher(fileName).onDidChange(_ => {
        documentChanged(assetsPath);
      })

      panel.webview.html = createHtml(getText(), assetsPath);
    })
  );

  vscode.workspace.onDidSaveTextDocument(_ => {
    panel.webview.html = createHtml(getText(), assetsPath);
  });

  vscode.workspace.onDidChangeTextDocument(_ => documentChanged(assetsPath));
}

function documentChanged(assetsPath: vscode.Uri): void {
  const text = getText();

  if (parser.codeHasChanged(text)) {
    panel.webview.html = createHtml(text, assetsPath);
  } else {
    panel.webview.postMessage({
      vars: JSON.stringify(parser.getVars(text)),
    });
  }
}

function getText(): string {
  const text = vscode.window.activeTextEditor.document.getText();

  const languageId = vscode.window.activeTextEditor.document.languageId;

  if (languageId === 'typescript') {
    const result = ts.transpileModule(text, {
      compilerOptions: { module: ts.ModuleKind.CommonJS }
    });
    return result.outputText;
  }

  return text;
}

function createHtml(text: string, assetsPath: vscode.Uri) {
  const code = parser.parseCode(text);

  const scripts = [
    'p5.min.js',
  ];

  const scriptTags = scripts
    .map(s =>
      vscode.Uri.file(path.join(assetsPath.path, s))
        .with({ scheme: 'vscode-resource' }))
    .map(uri => `<script src="${uri}"></script>`)
    .join('\b');

  return `<!DOCTYPE html>
    <html>
      <head>
        ${scriptTags}
        <style>body { padding: 0; margin: 0; }</style>
      </head>
      <body></body>
      <script>${code}</script>
      <script>
        window.addEventListener('message', event => {
          const vars = JSON.parse(event.data.vars);
          for (k in vars) {
            __AllVars[k] = vars[k];
          }
        });
      </script>
    </html><!-- ${Math.random()} -->`;
}

export function deactivate(): void {
  panel = null;
}
