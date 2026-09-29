import { randomUUID } from 'crypto';
import * as vscode from 'vscode';
import docs from '../assets/p5-docs.json';
import * as parser from './code-parser';
import { createHtml } from './html';
import {
  p5Scripts,
  p5Version,
} from './p5-version';
import { transpile } from './transpile';

const supportedLanguages = ['javascript', 'typescript'];

interface Preview {
  panel: vscode.WebviewPanel;
  document: vscode.TextDocument;
}

let preview: Preview | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const assetsPath = vscode.Uri.joinPath(context.extensionUri, 'assets');
  const output = vscode.window.createOutputChannel('Live p5', { log: true });

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
      () => openPreview(assetsPath, output),
    ),
    output,
    vscode.languages.registerCompletionItemProvider(supportedLanguages, {
      provideCompletionItems: () => completions,
    }),
  );
}

function openPreview(
  assetsPath: vscode.Uri,
  output: vscode.LogOutputChannel,
): void {
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
  preview = createPreview(document, assetsPath, output);
}

function createPreview(
  document: vscode.TextDocument,
  assetsPath: vscode.Uri,
  output: vscode.LogOutputChannel,
): Preview {
  const sketchFolder = document.isUntitled
    ? undefined
    : vscode.Uri.joinPath(document.uri, '..');

  // sketches can load files next to them, or anywhere in their workspace
  const sketchRoots = [
    sketchFolder,
    vscode.workspace.getWorkspaceFolder(document.uri)?.uri,
  ].filter(uri => uri !== undefined);

  const panel = vscode.window.createWebviewPanel(
    'extension.live-p5',
    'Live p5',
    { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
    {
      enableScripts: true,
      localResourceRoots: [assetsPath, ...sketchRoots],
      // messages sent to a hidden webview are dropped, and a restored one
      // would restart the sketch
      retainContextWhenHidden: true,
    },
  );

  const bundledUri = (file: string) =>
    panel.webview.asWebviewUri(vscode.Uri.joinPath(assetsPath, file))
      .toString();

  const bundled = {
    p5: bundledUri('p5.min.js'),
    sound: bundledUri('p5.sound.min.js'),
  };

  const baseUri = sketchFolder
    && panel.webview.asWebviewUri(sketchFolder).toString() + '/';

  let renderedVersion: string | undefined;

  const render = (text: string) => {
    const version = p5Version(document.getText());
    const html = createHtml({
      code: parser.parseCode(text),
      scriptUris: p5Scripts(version, bundled),
      cspSource: panel.webview.cspSource,
      nonce: randomUUID(),
      baseUri,
    });
    // the sketch restarts, so its earlier output no longer applies
    output.clear();
    panel.webview.html = html;
    renderedVersion = version;
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
      const versionChanged = p5Version(document.getText()) !== renderedVersion;
      if (parser.codeHasChanged(text) || versionChanged) {
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

  panel.webview.onDidReceiveMessage(message => {
    if (message?.log) {
      log(output, message.log.level, message.log.text);
    }
  });

  panel.onDidDispose(() => {
    listeners.forEach(l => l.dispose());
    if (preview?.panel === panel) {
      preview = undefined;
    }
  });

  output.show(true);
  reload();

  return { panel, document };
}

function log(
  output: vscode.LogOutputChannel,
  level: string,
  text: string,
): void {
  switch (level) {
    case 'error':
      return output.error(text);
    case 'warn':
      return output.warn(text);
    default:
      return output.info(text);
  }
}

function getText(document: vscode.TextDocument): string {
  return transpile(document.getText(), document.languageId);
}

export function deactivate(): void {
  preview?.panel.dispose();
}
