import { randomUUID } from 'crypto';
import * as vscode from 'vscode';
import docs from '../assets/p5-docs.json';
import * as parser from './code-parser';
import { createHtml } from './html';
import { transpile } from './transpile';

const supportedLanguages = ['javascript', 'typescript'];

interface Preview {
  panel: vscode.WebviewPanel;
  document: vscode.TextDocument;
}

let preview: Preview | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const assetsPath = vscode.Uri.joinPath(context.extensionUri, 'assets');

  const completions = docs.map(d => {
    const item = new vscode.CompletionItem(
      d.name,
      vscode.CompletionItemKind.Function,
    );
    item.detail = 'p5: ' + d.module;

    const link = 'p5js.org/reference/p5/' + d.name;
    item.documentation = new vscode.MarkdownString(
      `[${link}](https://${link})\n\n${d.description}`,
    );

    return item;
  });

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'extension.live-p5',
      () => openPreview(assetsPath),
    ),
    vscode.languages.registerCompletionItemProvider(supportedLanguages, {
      provideCompletionItems: () => completions,
    }),
  );
}

function openPreview(assetsPath: vscode.Uri): void {
  const document = vscode.window.activeTextEditor?.document;

  if (!document || !supportedLanguages.includes(document.languageId)) {
    vscode.window.showErrorMessage(
      'Live p5: open a JavaScript or TypeScript sketch first.',
    );
    return;
  }

  if (preview?.document === document) {
    preview.panel.reveal(undefined, true);
    return;
  }

  preview?.panel.dispose();
  preview = createPreview(document, assetsPath);
}

function createPreview(
  document: vscode.TextDocument,
  assetsPath: vscode.Uri,
): Preview {
  const panel = vscode.window.createWebviewPanel(
    'extension.live-p5',
    'Live p5',
    { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
    {
      enableScripts: true,
      localResourceRoots: [assetsPath],
      // messages sent to a hidden webview are dropped, and a restored one
      // would restart the sketch
      retainContextWhenHidden: true,
    },
  );

  const scriptUris = [vscode.Uri.joinPath(assetsPath, 'p5.min.js')]
    .map(uri => panel.webview.asWebviewUri(uri).toString());

  const render = (text: string) => {
    panel.webview.html = createHtml(
      parser.parseCode(text),
      scriptUris,
      panel.webview.cspSource,
      randomUUID(),
    );
  };

  // both swallow errors from incomplete code while the user is typing, the
  // preview keeps showing the last version that worked
  const reload = () => {
    try {
      render(getText(document));
    } catch {}
  };

  const update = () => {
    try {
      const text = getText(document);
      if (parser.codeHasChanged(text)) {
        render(text);
      } else {
        panel.webview.postMessage({ vars: parser.getVars(text) });
      }
    } catch {}
  };

  const listeners = [
    vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document === document && e.contentChanges.length > 0) {
        update();
      }
    }),
    vscode.workspace.onDidSaveTextDocument(d => {
      if (d === document) {
        reload();
      }
    }),
    vscode.workspace.onDidCloseTextDocument(d => {
      if (d === document) {
        panel.dispose();
      }
    }),
  ];

  panel.onDidDispose(() => {
    listeners.forEach(l => l.dispose());
    if (preview?.panel === panel) {
      preview = undefined;
    }
  });

  reload();

  return { panel, document };
}

function getText(document: vscode.TextDocument): string {
  return transpile(document.getText(), document.languageId);
}

export function deactivate(): void {
  preview?.panel.dispose();
}
