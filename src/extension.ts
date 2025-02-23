import * as fs from 'fs';
import * as ts from 'typescript';
import * as vscode from 'vscode';
import * as parser from './code-parser';

let panel: any;

export function activate(context: vscode.ExtensionContext): void {
  const assetsPath = vscode.Uri.joinPath(context.extensionUri, 'assets');

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

  const completions = JSON.parse(
    fs.readFileSync(vscode.Uri.joinPath(assetsPath, 'p5-docs.json').fsPath, 'utf8'))
    .map((d: any) => {
      const item = new vscode.CompletionItem(
        d.name,
        vscode.CompletionItemKind.Function,
      );
      item.detail = 'p5: ' + d.module;

      const link = 'p5js.org/reference/p5/' + d.name;
      const documentation = new vscode.MarkdownString(
        `[${link}](https://${link})\n\n${d.description}`
      );
      item.documentation = documentation;

      return item;
    });

  const provider = vscode.languages.registerCompletionItemProvider(
    ['javascript', 'typescript'],
    {
      provideCompletionItems() {
        return completions;
      }
    },
  );
  context.subscriptions.push(provider);
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
      panel.webview.asWebviewUri(vscode.Uri.joinPath(assetsPath, s)))
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
