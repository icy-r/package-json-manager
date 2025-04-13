import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class DependencyGraphPanel {
  public static currentPanel: DependencyGraphPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private readonly packageJsonUri: vscode.Uri;
  private disposables: vscode.Disposable[] = [];

  /**
   * Creates or shows a dependency graph panel
   */
  public static createOrShow(extensionUri: vscode.Uri, packageJsonUri: vscode.Uri) {
    // If we already have a panel, show it
    if (DependencyGraphPanel.currentPanel) {
      DependencyGraphPanel.currentPanel.panel.reveal(vscode.ViewColumn.Beside);
      DependencyGraphPanel.currentPanel.update(packageJsonUri);
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      'dependencyGraphView',
      'Dependency Graph',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(extensionUri.fsPath, 'media')),
          vscode.Uri.file(path.join(extensionUri.fsPath, 'dist'))
        ]
      }
    );

    DependencyGraphPanel.currentPanel = new DependencyGraphPanel(panel, extensionUri, packageJsonUri);
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, packageJsonUri: vscode.Uri) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.packageJsonUri = packageJsonUri;

    // Set the webview's initial html content
    this.update(packageJsonUri);

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Update the content based on view changes
    this.panel.onDidChangeViewState(
      e => {
        if (this.panel.visible) {
          this.update(this.packageJsonUri);
        }
      },
      null,
      this.disposables
    );

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'refresh':
            this.update(this.packageJsonUri);
            break;
          case 'getPackageDetails':
            this.getPackageDetails(message.packageName).then(details => {
              this.panel.webview.postMessage({
                command: 'packageDetails',
                details,
                packageName: message.packageName
              });
            });
            break;
        }
      },
      null,
      this.disposables
    );
  }

  private async update(packageJsonUri: vscode.Uri) {
    try {
      // Read package.json content
      const document = await vscode.workspace.openTextDocument(packageJsonUri);
      const packageJson = JSON.parse(document.getText());

      // Generate dependency graph data
      const graphData = await this.generateDependencyGraphData(packageJson);

      // Update the webview with the graph data
      this.panel.webview.html = this.getHtmlForWebview(this.panel.webview, graphData);
    } catch (error) {
      this.panel.webview.html = this.getErrorHtml('Failed to generate dependency graph.');
    }
  }

  private getHtmlForWebview(webview: vscode.Webview, graphData: any): string {
    // Get paths to extension resources
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(this.extensionUri.fsPath, 'media', 'dependencyGraph.js'))
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(this.extensionUri.fsPath, 'media', 'dependencyGraph.css'))
    );
    const d3Uri = webview.asWebviewUri(
      vscode.Uri.file(path.join(this.extensionUri.fsPath, 'media', 'd3.min.js'))
    );

    // Log the paths to help with debugging
    console.log('D3 URI:', d3Uri.toString());
    console.log('Script URI:', scriptUri.toString());
    console.log('Style URI:', styleUri.toString());

    // Use a nonce to whitelist which scripts can be run
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}' 'unsafe-eval'; style-src ${webview.cspSource} 'unsafe-inline';">
        <link href="${styleUri}" rel="stylesheet">
        <title>Dependency Graph</title>
    </head>
    <body>
        <header class="header">
            <div class="header-title">
                <h1>Dependency Graph Visualization</h1>
            </div>
            <div class="header-actions">
                <button id="btn-refresh">Refresh</button>
                <select id="dependency-type">
                    <option value="all">All Dependencies</option>
                    <option value="dependencies">Dependencies</option>
                    <option value="devDependencies">Dev Dependencies</option>
                </select>
            </div>
        </header>

        <div class="search-container">
            <input type="text" id="search-input" placeholder="Search for a package...">
        </div>

        <main id="graph-container" class="graph-container">
            <!-- D3 Graph will be rendered here -->
            <div class="graph-loading">
                <p>Loading dependency graph...</p>
            </div>
        </main>

        <div id="package-info" class="package-info hidden">
            <div class="package-info-header">
                <h2 id="package-info-name">Package Name</h2>
                <button id="package-info-close">&times;</button>
            </div>
            <div id="package-info-content" class="package-info-content">
                <!-- Package details will be shown here -->
            </div>
        </div>

        <script nonce="${nonce}" src="${d3Uri}"></script>
        <script nonce="${nonce}">
            const graphData = ${JSON.stringify(graphData)};
        </script>
        <script nonce="${nonce}" src="${scriptUri}"></script>
    </body>
    </html>`;
  }

  private getErrorHtml(errorMessage: string): string {
    return `<!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body {
                font-family: var(--vscode-font-family);
                color: var(--vscode-editor-foreground);
                background-color: var(--vscode-editor-background);
                padding: 20px;
                text-align: center;
            }
            .error-container {
                margin-top: 50px;
            }
            .error-message {
                color: var(--vscode-errorForeground);
                font-size: 16px;
                margin-bottom: 20px;
            }
        </style>
    </head>
    <body>
        <div class="error-container">
            <h2>Error</h2>
            <div class="error-message">${errorMessage}</div>
        </div>
    </body>
    </html>`;
  }

  private async generateDependencyGraphData(packageJson: any): Promise<any> {
    // Extract dependencies
    const dependencies = packageJson.dependencies || {};
    const devDependencies = packageJson.devDependencies || {};

    // Create nodes for each dependency
    const nodes = [
      // Root node (current package)
      {
        id: packageJson.name || 'current-package',
        name: packageJson.name || 'Current Package',
        version: packageJson.version || '0.0.0',
        type: 'root'
      },
      // Regular dependencies
      ...Object.entries(dependencies).map(([name, version]) => ({
        id: name,
        name,
        version: typeof version === 'string' ? version : 'Unknown',
        type: 'dependency'
      })),
      // Dev dependencies
      ...Object.entries(devDependencies).map(([name, version]) => ({
        id: name,
        name,
        version: typeof version === 'string' ? version : 'Unknown',
        type: 'devDependency'
      }))
    ];

    // Create links from root to each direct dependency
    const links = [
      // Links to regular dependencies
      ...Object.keys(dependencies).map(name => ({
        source: packageJson.name || 'current-package',
        target: name,
        type: 'dependency'
      })),
      // Links to dev dependencies
      ...Object.keys(devDependencies).map(name => ({
        source: packageJson.name || 'current-package',
        target: name,
        type: 'devDependency'
      }))
    ];

    // In a real implementation, we would recursively resolve transitive dependencies
    // by analyzing node_modules, but for this example we'll just use direct dependencies

    return { nodes, links };
  }

  private async getPackageDetails(packageName: string): Promise<any> {
    // In a real implementation, this would fetch data from the npm registry
    // For now, return mock data
    return {
      name: packageName,
      description: 'Package description would be fetched from npm registry',
      versions: ['1.0.0', '1.0.1', '1.1.0'],
      author: 'Package Author',
      license: 'MIT',
      homepage: 'https://example.com',
      repository: 'https://github.com/example/repo'
    };
  }

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  private dispose() {
    DependencyGraphPanel.currentPanel = undefined;

    // Clean up resources
    this.panel.dispose();
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}