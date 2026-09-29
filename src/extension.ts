import { randomUUID } from 'crypto';
import * as vscode from 'vscode';
import p5Docs from '../assets/p5-docs.json';
import p5v1Docs from '../assets/p5-v1-docs.json';
import {
  createParser,
  getVars,
} from './code-parser';
import { createHtml } from './html';
import {
  isP5v1,
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

  const completions = completionItems(p5Docs);
  const p5v1Completions = completionItems(p5v1Docs);

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
      // sketches that pick p5.js 1 get its functions and docs instead
      provideCompletionItems: document =>
        isP5v1(p5Version(document.getText()))
          ? p5v1Completions
          : completions,
    }),
  );
}

interface Docs {
  version: string;
  docs: { name: string, module: string, description: string }[];
}

function completionItems({ version, docs }: Docs): vscode.CompletionItem[] {
  return docs.map(d => {
    const item = new vscode.CompletionItem(
      d.name,
      vscode.CompletionItemKind.Function,
    );
    item.detail = `p5 ${version}: ${d.module}`;

    const link = 'p5js.org/reference/p5/' + d.name;
    item.documentation = new vscode.MarkdownString(
      `[${link}](https://${link})\n\n${d.description}`,
    );

    return item;
  });
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

  const parser = createParser();
  let renderedVersion: string | undefined;

  const render = ({ raw, code }: Sketch) => {
    const version = p5Version(raw);
    const html = createHtml({
      code: parser.parseCode(code),
      scriptUris: p5Scripts(version, bundled),
      cspSource: panel.webview.cspSource,
      nonce: randomUUID(),
      baseUri,
    });
    // the sketch restarts, so its earlier output no longer applies
    output.clear();
    if (diagnostics.get(document.uri)?.length) {
      output.warn(`${preloadMessage} See ${compatibilityGuide}`);
    }
    panel.webview.html = html;
    renderedVersion = version;
  };

  // keeps the last warning while the code doesn't parse
  const checkPreload = ({ code }: Sketch) => {
    try {
      const position = removedPreload(code);
      diagnostics.set(
        document.uri,
        position ? [preloadDiagnostic(position)] : [],
      );
    } catch {}
  };

  // both swallow errors from incomplete code while the user is typing, the
  // preview keeps showing the last version that worked
  const reload = () => {
    try {
      const sketch = readSketch(document);
      checkPreload(sketch);
      render(sketch);
    } catch {}
  };

  const update = () => {
    try {
      const sketch = readSketch(document);
      checkPreload(sketch);
      const versionChanged = p5Version(sketch.raw) !== renderedVersion;
      if (parser.codeHasChanged(sketch.code) || versionChanged) {
        render(sketch);
      } else {
        panel.webview.postMessage({ vars: getVars(sketch.code) });
      }
    } catch {}
  };

  const listeners = [
    vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document === document && e.contentChanges.length > 0) {
        update();
      }
    }),
    // only saving by hand restarts the sketch; with auto save on, every pause
    // in typing would
    vscode.workspace.onWillSaveTextDocument(e => {
      if (
        e.document === document
        && e.reason === vscode.TextDocumentSaveReason.Manual
      ) {
        reload();
      }
    }),
    vscode.workspace.onDidCloseTextDocument(d => {
      // changing the language mode closes and reopens the same document
      if (d === document) {
        setTimeout(() => {
          if (document.isClosed) {
            panel.dispose();
          }
        });
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
  reload();

  return { panel, document };
}

function preloadDiagnostic(
  { line, column }: { line: number, column: number },
): vscode.Diagnostic {
  const start = new vscode.Position(line - 1, column);
  const diagnostic = new vscode.Diagnostic(
    new vscode.Range(start, start.translate(0, 'preload'.length)),
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

interface Sketch {
  // as typed, and as JavaScript
  raw: string;
  code: string;
}

function readSketch(document: vscode.TextDocument): Sketch {
  const raw = document.getText();
  return { raw, code: transpile(raw, document.languageId) };
}

export function deactivate(): void {
  preview?.panel.dispose();
}
