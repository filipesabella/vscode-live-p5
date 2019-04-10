import * as vscode from 'vscode';
import TextDocumentContentProvider from './TextDocumentContentProvider';
import WebSocketServer from './WebSocketServer';
import * as parser from './code-parser';

let websocket: WebSocketServer;

export function activate(context: vscode.ExtensionContext): void {
  const previewUri = vscode.Uri.parse('live-p5://authority/live-p5');

  websocket = new WebSocketServer(webSocketServerUrl => {
    const provider = new TextDocumentContentProvider(webSocketServerUrl);
    vscode.workspace.registerTextDocumentContentProvider('live-p5', provider);

    vscode.workspace.onDidSaveTextDocument(e => {
      provider.update(previewUri);
    });

    vscode.workspace.onDidChangeTextDocument(e => {
      const text = vscode.window.activeTextEditor.document.getText();
      try {
        if (parser.codeHasChanged(text)) {
          provider.update(previewUri);
        } else {
          websocket.send(JSON.stringify(parser.getVars(text)));
        }
      } catch (e) { }
    });
  });


  const disposable = vscode.commands.registerCommand('extension.live-p5', () => {
    vscode.commands
      .executeCommand('vscode.previewHtml', previewUri, vscode.ViewColumn.Two, 'live-p5')
      .then(() => { }, vscode.window.showErrorMessage);
  });

  context.subscriptions.push(disposable);
}

export function deactivate(): void {
  websocket.dispose();
}
