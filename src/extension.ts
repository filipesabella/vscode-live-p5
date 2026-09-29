import { randomUUID } from 'crypto';
import * as vscode from 'vscode';
import docs from '../assets/p5-docs.json';
import * as parser from './code-parser';
import { createHtml } from './html';
import {
  lastP5v1,
  p5Scripts,
  p5Version,
  removedPreload,
} from './p5-version';
import { transpile } from './transpile';

const supportedLanguages = ['javascript', 'typescript'];

const compatibilityGuide = 'https://github.com/processing/p5.js-compatibility';
const preloadMessage =
  'preload() was removed in p5.js 2, the preview never calls it.';

interface Services {
  assetsPath: vscode.Uri;
  output: vscode.LogOutputChannel;
  diagnostics: vscode.DiagnosticCollection;
}

interface Preview {
  panel: vscode.WebviewPanel;
  document: vscode.TextDocument;
}

let preview: Preview | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const assetsPath = vscode.Uri.joinPath(context.extensionUri, 'assets');
  const services: Services = {
    assetsPath,
    output: vscode.window.createOutputChannel('Live p5', { log: true }),
    diagnostics: vscode.languages.createDiagnosticCollection('live-p5'),
  };

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
      () => openPreview(services),
    ),
    services.output,
    services.diagnostics,
    vscode.languages.registerCodeActionsProvider(
      supportedLanguages,
      { provideCodeActions: preloadFixes },
      { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] },
    ),
    vscode.languages.registerCompletionItemProvider(supportedLanguages, {
      provideCompletionItems: () => completions,
    }),
  );
}

function openPreview(services: Services): void {
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
  preview = createPreview(document, services);
}

function createPreview(
  document: vscode.TextDocument,
  { assetsPath, output, diagnostics }: Services,
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
    if (removedPreload(document.getText())) {
      output.warn(`${preloadMessage} See ${compatibilityGuide}`);
    }
    panel.webview.html = html;
    renderedVersion = version;
  };

  const checkPreload = () => {
    const range = removedPreload(document.getText());
    diagnostics.set(
      document.uri,
      range ? [preloadDiagnostic(document, range)] : [],
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
        checkPreload();
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
    diagnostics.delete(document.uri);
    if (preview?.panel === panel) {
      preview = undefined;
    }
  });

  output.show(true);
  checkPreload();
  reload();

  return { panel, document };
}

function preloadDiagnostic(
  document: vscode.TextDocument,
  { start, end }: { start: number, end: number },
): vscode.Diagnostic {
  const diagnostic = new vscode.Diagnostic(
    new vscode.Range(document.positionAt(start), document.positionAt(end)),
    `${preloadMessage} Load files with \`await\` in \`async function setup()\`, `
      + `or run the sketch on p5.js 1 with a \`// @p5 ${lastP5v1}\` line.`,
    vscode.DiagnosticSeverity.Warning,
  );
  diagnostic.source = 'Live p5';
  diagnostic.code = {
    value: 'preload',
    target: vscode.Uri.parse(compatibilityGuide),
  };
  return diagnostic;
}

function preloadFixes(
  document: vscode.TextDocument,
  _range: vscode.Range,
  { diagnostics }: vscode.CodeActionContext,
): vscode.CodeAction[] {
  const diagnostic = diagnostics.find(d => d.source === 'Live p5');
  if (!diagnostic) {
    return [];
  }

  const useP5v1 = new vscode.CodeAction(
    `Run this sketch with p5.js ${lastP5v1}`,
    vscode.CodeActionKind.QuickFix,
  );
  useP5v1.diagnostics = [diagnostic];
  useP5v1.isPreferred = true;
  useP5v1.edit = new vscode.WorkspaceEdit();
  useP5v1.edit.insert(
    document.uri,
    new vscode.Position(0, 0),
    `// @p5 ${lastP5v1}\n`,
  );

  const openGuide = new vscode.CodeAction(
    'Open the p5.js 2 compatibility guide',
    vscode.CodeActionKind.QuickFix,
  );
  openGuide.diagnostics = [diagnostic];
  openGuide.command = {
    title: openGuide.title,
    command: 'vscode.open',
    arguments: [vscode.Uri.parse(compatibilityGuide)],
  };

  return [useP5v1, openGuide];
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
