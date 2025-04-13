import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';

export class PackageJsonEditorProvider implements vscode.CustomTextEditorProvider {
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

  private readonly context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // Setup webview
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this.context.extensionPath, 'media')),
        vscode.Uri.file(path.join(this.context.extensionPath, 'dist'))
      ]
    };

    // Initialize HTML content for the webview
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    // Set up communication between the webview and extension
    this.setWebviewMessageListener(webviewPanel, document);
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    // Get path to webview resources
    const extensionPath = this.context.extensionPath;
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(extensionPath, 'media', 'packageJsonEditor.js'))
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(extensionPath, 'media', 'packageJsonEditor.css'))
    );

    // Use a nonce to whitelist which scripts can be run
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline';">
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
                <!-- Package Info Tab -->
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
                
                <!-- Dependencies Tab -->
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
                            <!-- Dependencies will be rendered here -->
                            <div class="empty-state">No dependencies found.</div>
                        </div>
                    </div>
                    
                    <div id="dependencies-dev" class="subtab-content">
                        <div class="search-bar">
                            <input type="text" id="search-dev-dependencies" placeholder="Search dev dependencies...">
                        </div>
                        <div id="dev-dependencies-list" class="dependencies-list">
                            <!-- Dev Dependencies will be rendered here -->
                            <div class="empty-state">No dev dependencies found.</div>
                        </div>
                    </div>
                </section>
                
                <!-- Scripts Tab -->
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
                        <!-- Scripts will be rendered here -->
                        <div class="empty-state">No scripts found.</div>
                    </div>
                </section>
            </main>
            
            <!-- Modal Templates -->
            <div id="modal-overlay" class="modal-overlay hidden">
                <div class="modal">
                    <div class="modal-header">
                        <h2 id="modal-title">Modal Title</h2>
                        <button id="modal-close" class="modal-close">&times;</button>
                    </div>
                    <div id="modal-content" class="modal-content">
                        <!-- Modal content will be dynamically inserted here -->
                    </div>
                </div>
            </div>
        </div>
        
        <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
  }

  private setWebviewMessageListener(webviewPanel: vscode.WebviewPanel, document: vscode.TextDocument) {
    webviewPanel.webview.onDidReceiveMessage(async (message) => {
      switch (message.command) {
        case 'getPackageJson':
          // Send package.json content to the webview
          try {
            const text = document.getText();
            const packageJson = JSON.parse(text);
            webviewPanel.webview.postMessage({
              command: 'packageJson',
              packageJson
            });
          } catch (error) {
            webviewPanel.webview.postMessage({
              command: 'error',
              error: 'Failed to parse package.json'
            });
          }
          break;

        case 'updatePackageJson':
          // Update the document with the modified package.json
          this.updateTextDocument(document, message.packageJson);
          break;

        case 'searchNpmPackage':
          // Search for packages in npm registry
          try {
            const searchResults = await this.searchNpmPackages(message.query);
            webviewPanel.webview.postMessage({
              command: 'searchResults',
              results: searchResults
            });
          } catch (error) {
            webviewPanel.webview.postMessage({
              command: 'error',
              error: 'Failed to search npm registry'
            });
          }
          break;

        case 'executeScript':
          // Execute an npm script in the integrated terminal
          try {
            const terminal = vscode.window.createTerminal('Package.json Manager');
            terminal.sendText(`npm run ${message.script}`);
            terminal.show();
            webviewPanel.webview.postMessage({
              command: 'scriptExecuted',
              script: message.script
            });
          } catch (error) {
            webviewPanel.webview.postMessage({
              command: 'error',
              error: 'Failed to execute script'
            });
          }
          break;

        case 'toggleView':
          // Toggle between visual and text editor
          vscode.commands.executeCommand('packageJsonManager.toggleView');
          break;

        case 'showDependencyGraph':
          // Show the dependency graph view
          vscode.commands.executeCommand('packageJsonManager.showDependencyGraph');
          break;
      }
    });

    // Initial load: Send the document content to the webview
    const initialContent = document.getText();
    try {
      const packageJson = JSON.parse(initialContent);
      webviewPanel.webview.postMessage({
        command: 'packageJson',
        packageJson
      });
    } catch (error) {
      webviewPanel.webview.postMessage({
        command: 'error',
        error: 'Failed to parse package.json'
      });
    }
  }

  private async searchNpmPackages(query: string): Promise<any[]> {
    try {
      // Use the npm registry API to search for packages
      const response = await axios.get(`https://registry.npmjs.org/-/v1/search`, {
        params: {
          text: query,
          size: 10,
          popularity: 1.0,
          quality: 1.0,
          maintenance: 1.0
        },
        timeout: 10000 // 10 seconds timeout
      });
      
      // Transform the response into the format our UI expects
      return response.data.objects.map((item: any) => {
        return {
          name: item.package.name,
          version: item.package.version,
          description: item.package.description,
          author: item.package.publisher?.username || item.package.author?.name || item.package.maintainers?.[0]?.username || '',
          date: item.package.date,
          keywords: item.package.keywords || [],
          links: item.package.links,
          score: item.score
        };
      });
    } catch (error) {
      console.error('Error searching npm registry:', error);
      
      // Show an error notification
      vscode.window.showErrorMessage(`Failed to search npm registry: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Return an empty array on error
      return [];
    }
  }

  private updateTextDocument(document: vscode.TextDocument, packageJson: any) {
    const edit = new vscode.WorkspaceEdit();
    
    // Format the JSON with 2 spaces indentation
    const formatted = JSON.stringify(packageJson, null, 2);
    
    // Replace the entire document with the updated JSON
    edit.replace(
      document.uri,
      new vscode.Range(0, 0, document.lineCount, 0),
      formatted
    );
    
    // Apply the edits
    vscode.workspace.applyEdit(edit);
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}