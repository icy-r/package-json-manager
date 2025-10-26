import * as vscode from 'vscode';
import { NpmRegistryService } from '../services/NpmRegistryService';
import { PackageJsonService, PackageJsonData } from '../services/PackageJsonService';
import { FileSystemService } from '../services/FileSystemService';
import { WebviewMessageRouter, WebviewResourceManager } from '../utils/webviewUtils';

/**
 * Custom editor provider for package.json files
 * Provides a visual interface for editing package.json
 */
export class PackageJsonEditorProvider implements vscode.CustomTextEditorProvider {
  private readonly npmService: NpmRegistryService;
  private readonly packageJsonService: PackageJsonService;
  private readonly resourceManager: WebviewResourceManager;

  constructor(private readonly context: vscode.ExtensionContext) {
    const fileSystem = new FileSystemService();
    this.npmService = new NpmRegistryService();
    this.packageJsonService = new PackageJsonService(fileSystem);
    this.resourceManager = new WebviewResourceManager();
  }

  /**
   * Static factory method to register the provider
   */
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(
      'packageJsonManager.packageJsonEditor',
      new PackageJsonEditorProvider(context),
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false
      }
    );
  }

  /**
   * Resolve custom text editor
   */
  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token: vscode.CancellationToken
  ): Promise<void> {
    // Setup webview options
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'media'),
        vscode.Uri.joinPath(this.context.extensionUri, 'dist')
      ]
    };

    // Set HTML content
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    // Setup message handling
    this.setupMessageHandling(webviewPanel, document);

    // Don't send initial data here - wait for webview to request it via 'getPackageJson' message
    // This avoids race condition where message is sent before webview JS is ready

    // Watch for document changes
    const changeListener = vscode.workspace.onDidChangeTextDocument(e => {
      if (e.document.uri.toString() === document.uri.toString()) {
        this.sendPackageJsonToWebview(webviewPanel, document);
      }
    });

    // Cleanup on dispose
    webviewPanel.onDidDispose(() => {
      changeListener.dispose();
    });
  }

  /**
   * Generate HTML for webview
   */
  private getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'packageJsonEditor.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, 'media', 'packageJsonEditor.css')
    );
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline'; worker-src 'none'; child-src 'none';">
        <link href="${styleUri}" rel="stylesheet" />
        <title>Package.json Manager</title>
    </head>
    <body>
        <div id="app">
            <header class="header">
                <div class="header-title">
                    <h1>Package.json Manager</h1>
                </div>
                <div class="header-actions">
                    <button id="btn-toggle-view">Switch to Text View</button>
                </div>
            </header>
            
            <nav class="tabs">
                <button class="tab-btn active" data-tab="package-info">Package Info</button>
                <button class="tab-btn" data-tab="dependencies">Dependencies</button>
                <button class="tab-btn" data-tab="scripts">Scripts</button>
            </nav>
            
            <main class="content-area">
                <section id="package-info" class="tab-content active">
                    <div class="form-group">
                        <label for="package-name">Name</label>
                        <input type="text" id="package-name" name="name" placeholder="Package name">
                    </div>
                    <div class="form-group">
                        <label for="package-version">Version</label>
                        <input type="text" id="package-version" name="version" placeholder="1.0.0">
                    </div>
                    <div class="form-group">
                        <label for="package-description">Description</label>
                        <textarea id="package-description" name="description" placeholder="Description of package"></textarea>
                    </div>
                    <div class="form-group">
                        <label for="package-author">Author</label>
                        <input type="text" id="package-author" name="author" placeholder="Author">
                    </div>
                    <div class="form-group">
                        <label for="package-license">License</label>
                        <input type="text" id="package-license" name="license" placeholder="MIT">
                    </div>
                    <div class="form-group">
                        <label for="package-keywords">Keywords (comma-separated)</label>
                        <input type="text" id="package-keywords" name="keywords" placeholder="keyword1, keyword2">
                    </div>
                </section>
                
                <section id="dependencies" class="tab-content">
                    <div class="dependencies-header">
                        <div class="tabs">
                            <button class="subtab-btn active" data-subtab="dependencies-prod">Dependencies</button>
                            <button class="subtab-btn" data-subtab="dependencies-dev">Dev Dependencies</button>
                        </div>
                        <div class="actions">
                            <button id="btn-add-dependency" class="btn-primary">Add Dependency</button>
                            <button id="btn-show-graph" class="btn-secondary">View Dependency Graph</button>
                        </div>
                    </div>
                    
                    <div id="dependencies-prod" class="subtab-content active">
                        <div class="search-bar">
                            <input type="text" id="search-dependencies" placeholder="Search dependencies...">
                        </div>
                        <div id="dependencies-list" class="dependencies-list">
                            <div class="empty-state">No dependencies found.</div>
                        </div>
                    </div>
                    
                    <div id="dependencies-dev" class="subtab-content">
                        <div class="search-bar">
                            <input type="text" id="search-dev-dependencies" placeholder="Search dev dependencies...">
                        </div>
                        <div id="dev-dependencies-list" class="dependencies-list">
                            <div class="empty-state">No dev dependencies found.</div>
                        </div>
                    </div>
                </section>
                
                <section id="scripts" class="tab-content">
                    <div class="scripts-header">
                        <div class="search-bar">
                            <input type="text" id="search-scripts" placeholder="Search scripts...">
                        </div>
                        <div class="actions">
                            <button id="btn-add-script" class="btn-primary">Add Script</button>
                        </div>
                    </div>
                    
                    <div id="scripts-list" class="scripts-list">
                        <div class="empty-state">No scripts found.</div>
                    </div>
                </section>
            </main>
            
            <div id="modal-overlay" class="modal-overlay hidden">
                <div class="modal">
                    <div class="modal-header">
                        <h2 id="modal-title">Modal Title</h2>
                        <button id="modal-close" class="modal-close">&times;</button>
                    </div>
                    <div id="modal-content" class="modal-content"></div>
                </div>
            </div>
        </div>
        
        <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * Setup message handling between webview and extension
   */
  private setupMessageHandling(
    webviewPanel: vscode.WebviewPanel,
    document: vscode.TextDocument
  ): void {
    const router = new WebviewMessageRouter();

    router.on('getPackageJson', async () => {
      console.log('Received getPackageJson request from webview');
      await this.sendPackageJsonToWebview(webviewPanel, document);
    });

    router.on('updatePackageJson', async (message) => {
      console.log('Received updatePackageJson request from webview');
      await this.handleUpdatePackageJson(document, message.packageJson);
    });

    router.on('searchNpmPackage', async (message) => {
      await this.handleSearchNpmPackage(webviewPanel, message.query);
    });

    router.on('executeScript', async (message) => {
      await this.handleExecuteScript(webviewPanel, message.script);
    });

    router.on('toggleView', async () => {
      await vscode.commands.executeCommand('packageJsonManager.toggleView');
    });

    router.on('showDependencyGraph', async () => {
      await vscode.commands.executeCommand('packageJsonManager.showDependencyGraph');
    });

    webviewPanel.webview.onDidReceiveMessage(
      (message) => router.handle(message)
    );
  }

  /**
   * Send package.json data to webview
   */
  private async sendPackageJsonToWebview(
    webviewPanel: vscode.WebviewPanel,
    document: vscode.TextDocument
  ): Promise<void> {
    try {
      console.log('Reading package.json from:', document.uri.toString());
      const packageJson = await this.packageJsonService.readPackageJson(document.uri);
      console.log('Successfully read package.json, sending to webview');
      await webviewPanel.webview.postMessage({
        command: 'packageJson',
        packageJson
      });
    } catch (error) {
      console.error('Failed to read package.json:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to parse package.json';
      await webviewPanel.webview.postMessage({
        command: 'error',
        error: errorMessage
      });
      vscode.window.showErrorMessage(`Package.json Manager: ${errorMessage}`);
    }
  }

  /**
   * Handle package.json update from webview
   */
  private async handleUpdatePackageJson(
    document: vscode.TextDocument,
    packageJson: unknown
  ): Promise<void> {
    try {
      await this.packageJsonService.updateDocument(document, packageJson as PackageJsonData);
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to update package.json: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle npm package search
   */
  private async handleSearchNpmPackage(
    webviewPanel: vscode.WebviewPanel,
    query: string
  ): Promise<void> {
    try {
      const results = await this.npmService.searchPackages(query);
      await webviewPanel.webview.postMessage({
        command: 'searchResults',
        results
      });
    } catch (error) {
      await webviewPanel.webview.postMessage({
        command: 'error',
        error: 'Failed to search npm registry'
      });
      vscode.window.showErrorMessage(
        `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Handle script execution
   */
  private async handleExecuteScript(
    webviewPanel: vscode.WebviewPanel,
    script: string
  ): Promise<void> {
    try {
      const terminal = vscode.window.createTerminal('Package.json Manager');
      terminal.sendText(`npm run ${script}`);
      terminal.show();
      
      await webviewPanel.webview.postMessage({
        command: 'scriptExecuted',
        script
      });
    } catch (error) {
      await webviewPanel.webview.postMessage({
        command: 'error',
        error: 'Failed to execute script'
      });
    }
  }
}
