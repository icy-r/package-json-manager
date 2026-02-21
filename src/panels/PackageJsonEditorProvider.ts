import * as vscode from 'vscode';
import { HtmlTemplateBuilder } from '../utils/HtmlTemplateBuilder';
import { isValidMessage } from '../utils/webviewUtils';
import { PackageJsonService } from '../services/PackageJsonService';
import { NpmRegistryService } from '../services/NpmRegistryService';

export class PackageJsonEditorProvider implements vscode.CustomTextEditorProvider {
  private static readonly viewType = 'packageJsonManager.packageJsonEditor';

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly htmlBuilder: HtmlTemplateBuilder,
    private readonly packageJsonService: PackageJsonService,
    private readonly npmService: NpmRegistryService
  ) {}

  static register(
    context: vscode.ExtensionContext,
    htmlBuilder: HtmlTemplateBuilder,
    packageJsonService: PackageJsonService,
    npmService: NpmRegistryService
  ): vscode.Disposable {
    const provider = new PackageJsonEditorProvider(
      context.extensionUri,
      htmlBuilder,
      packageJsonService,
      npmService
    );
    return vscode.window.registerCustomEditorProvider(
      PackageJsonEditorProvider.viewType,
      provider,
      { webviewOptions: { retainContextWhenHidden: false } }
    );
  }

  async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')]
    };

    webviewPanel.webview.html = this.htmlBuilder.build({
      webview: webviewPanel.webview,
      extensionUri: this.extensionUri,
      stylePaths: [['media', 'packageJsonEditor.css']],
      scriptPaths: [['media', 'packageJsonEditor.js']],
      title: 'Package.json Editor',
      bodyContent: '<div id="root"><div class="loading">Loading...</div></div>'
    });

    const changeDocSub = vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.uri.toString() === document.uri.toString()) {
        this.postUpdate(webviewPanel.webview, document);
      }
    });

    webviewPanel.webview.onDidReceiveMessage(msg => this.handleMessage(msg, document, webviewPanel.webview));
    webviewPanel.onDidDispose(() => changeDocSub.dispose());
  }

  private postUpdate(webview: vscode.Webview, document: vscode.TextDocument): void {
    webview.postMessage({ type: 'update', content: document.getText() });
  }

  private async handleMessage(
    msg: unknown,
    document: vscode.TextDocument,
    webview: vscode.Webview
  ): Promise<void> {
    if (!isValidMessage(msg)) {
      return;
    }

    try {
      switch (msg.type) {
        case 'ready':
          this.postUpdate(webview, document);
          break;

        case 'updateField': {
          const data = this.packageJsonService.parse(document.getText());
          const updated = this.packageJsonService.updateField(
            data,
            msg.field as string,
            msg.value
          );
          await this.packageJsonService.applyEdit(document, this.packageJsonService.stringify(updated));
          break;
        }

        case 'addDependency': {
          const data = this.packageJsonService.parse(document.getText());
          const updated = this.packageJsonService.addDependency(
            data,
            msg.name as string,
            msg.version as string,
            msg.isDev as boolean
          );
          await this.packageJsonService.applyEdit(document, this.packageJsonService.stringify(updated));
          break;
        }

        case 'removeDependency': {
          const data = this.packageJsonService.parse(document.getText());
          const updated = this.packageJsonService.removeDependency(data, msg.name as string);
          await this.packageJsonService.applyEdit(document, this.packageJsonService.stringify(updated));
          break;
        }

        case 'moveDependency': {
          const data = this.packageJsonService.parse(document.getText());
          const updated = this.packageJsonService.moveDependency(
            data,
            msg.name as string,
            msg.toDev as boolean
          );
          await this.packageJsonService.applyEdit(document, this.packageJsonService.stringify(updated));
          break;
        }

        case 'addScript': {
          const data = this.packageJsonService.parse(document.getText());
          const updated = this.packageJsonService.addScript(
            data,
            msg.name as string,
            msg.command as string
          );
          await this.packageJsonService.applyEdit(document, this.packageJsonService.stringify(updated));
          break;
        }

        case 'removeScript': {
          const data = this.packageJsonService.parse(document.getText());
          const updated = this.packageJsonService.removeScript(data, msg.name as string);
          await this.packageJsonService.applyEdit(document, this.packageJsonService.stringify(updated));
          break;
        }

        case 'editScript': {
          const data = this.packageJsonService.parse(document.getText());
          const updated = this.packageJsonService.addScript(
            data,
            msg.name as string,
            msg.command as string
          );
          await this.packageJsonService.applyEdit(document, this.packageJsonService.stringify(updated));
          break;
        }

        case 'runScript': {
          const terminal = vscode.window.createTerminal(`npm: ${msg.name}`);
          terminal.show();
          terminal.sendText(`npm run ${msg.name as string}`);
          break;
        }

        case 'searchNpm': {
          const results = await this.npmService.searchPackages(msg.query as string);
          webview.postMessage({ type: 'searchResults', results });
          break;
        }

        case 'getPackageDetails': {
          const details = await this.npmService.getPackageDetails(msg.name as string);
          webview.postMessage({ type: 'packageDetails', details });
          break;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      vscode.window.showErrorMessage(`Package.json Manager: ${message}`);
      webview.postMessage({ type: 'error', message });
    }
  }
}
