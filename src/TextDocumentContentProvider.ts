import * as vscode from 'vscode';
import * as parser from './code-parser';

export default class TextDocumentContentProvider implements vscode.TextDocumentContentProvider {
  private _onDidChange = new vscode.EventEmitter<vscode.Uri>();

  constructor(private readonly webSocketServer: string) { }

  public provideTextDocumentContent(uri: vscode.Uri): string {
    return this.createHtml();
  }

  get onDidChange(): vscode.Event<vscode.Uri> {
    return this._onDidChange.event;
  }

  public update(uri: vscode.Uri) {
    this._onDidChange.fire(uri);
  }

  private createHtml() {
    const editor = vscode.window.activeTextEditor;
    const text = editor.document.getText();
    const path = vscode.extensions.getExtension('filipesabella.live-p5').extensionPath;

    const code = parser.parseCode(text);

    return `<!DOCTYPE html>
      <html>
        <head>
          <script src="${path + '/assets/p5.min.js'}"></script>
          <script src="${path + '/assets/p5.dom.min.js'}"></script>
          <script src="${path + '/assets/p5.sound.min.js'}"></script>
          <script src="${path + "/assets/websocket-setup.js"}"></script>
          <script>setupWebsocket("${this.webSocketServer}");</script>
          <style>body { padding: 0; margin: 0; }</style>
        </head>
        <body></body>
        <script id="code">${code}</script>
      </html>`;
  }

  private errorHtml(error: string): string {
    return `<body>${error}</body>`;
  }
}
