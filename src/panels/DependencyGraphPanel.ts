import * as vscode from 'vscode';
import { NpmRegistryService, PackageDetails } from '../services/NpmRegistryService';
import { DependencyService, DependencyGraphData } from '../services/DependencyService';
import { FileSystemService } from '../services/FileSystemService';
import { WebviewMessageRouter, WebviewResourceManager } from '../utils/webviewUtils';

/**
 * Panel for displaying dependency graph visualization
 */
export class DependencyGraphPanel {
  public static currentPanel: DependencyGraphPanel | undefined;
  
  private readonly panel: vscode.WebviewPanel;
  private readonly extensionUri: vscode.Uri;
  private packageJsonUri: vscode.Uri;
  private readonly resourceManager: WebviewResourceManager;
  private readonly npmService: NpmRegistryService;
  private readonly dependencyService: DependencyService;
  private readonly messageRouter: WebviewMessageRouter;

  /**
   * Creates or shows a dependency graph panel
   */
  public static createOrShow(
    extensionUri: vscode.Uri,
    packageJsonUri: vscode.Uri
  ): void {
    // If we already have a panel, show it
    if (DependencyGraphPanel.currentPanel) {
      DependencyGraphPanel.currentPanel.panel.reveal(vscode.ViewColumn.Beside);
      DependencyGraphPanel.currentPanel.update(packageJsonUri);
      return;
    }

    // Create new panel
    const panel = vscode.window.createWebviewPanel(
      'dependencyGraphView',
      'Dependency Graph',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media'),
          vscode.Uri.joinPath(extensionUri, 'dist')
        ]
      }
    );

    DependencyGraphPanel.currentPanel = new DependencyGraphPanel(
      panel,
      extensionUri,
      packageJsonUri
    );
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    packageJsonUri: vscode.Uri
  ) {
    this.panel = panel;
    this.extensionUri = extensionUri;
    this.packageJsonUri = packageJsonUri;
    this.resourceManager = new WebviewResourceManager();
    this.messageRouter = new WebviewMessageRouter();
    
    // Initialize services
    const fileSystem = new FileSystemService();
    this.npmService = new NpmRegistryService();
    this.dependencyService = new DependencyService(fileSystem);

    // Setup
    this.setupMessageHandling();
    this.update(packageJsonUri);

    // Register disposal
    this.resourceManager.add(
      this.panel.onDidDispose(() => this.dispose())
    );

    this.resourceManager.add(
      this.panel.onDidChangeViewState(() => {
        if (this.panel.visible) {
          this.update(this.packageJsonUri);
        }
      })
    );
  }

  /**
   * Update the panel with new package.json data
   */
  private async update(packageJsonUri: vscode.Uri): Promise<void> {
    this.packageJsonUri = packageJsonUri;

    try {
      // Generate dependency graph
      const graphData = await this.dependencyService.generateDependencyGraph(
        packageJsonUri,
        { maxDepth: 3, includeDev: true }
      );

      // Build and set HTML
      this.panel.webview.html = this.getHtmlForWebview(graphData);
    } catch (error) {
      this.panel.webview.html = this.getErrorHtml(
        'Failed to generate dependency graph.'
      );
      console.error('Error generating dependency graph:', error);
    }
  }

  /**
   * Generate HTML for webview
   */
  private getHtmlForWebview(graphData: DependencyGraphData): string {
    const scriptUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'dependencyGraph.js')
    );
    const styleUri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'dependencyGraph.css')
    );
    const d3Uri = this.panel.webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, 'media', 'd3.min.js')
    );
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${
          this.panel.webview.cspSource
        } https:; script-src 'nonce-${nonce}' 'unsafe-eval'; style-src ${
      this.panel.webview.cspSource
    } 'unsafe-inline'; worker-src 'none'; child-src 'none';">
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

  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  /**
   * Generate error HTML
   */
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

  /**
   * Setup message handling
   */
  private setupMessageHandling(): void {
    this.messageRouter.on('refresh', async () => {
      await this.update(this.packageJsonUri);
    });

    this.messageRouter.on('getPackageDetails', async (message) => {
      await this.handleGetPackageDetails(message.packageName);
    });

    this.panel.webview.onDidReceiveMessage(
      (message) => this.messageRouter.handle(message)
    );
  }

  /**
   * Handle package details request
   */
  private async handleGetPackageDetails(packageName: string): Promise<void> {
    try {
      // First try to get local details
      const localDetails = await this.dependencyService.getLocalPackageDetails(
        this.packageJsonUri,
        packageName
      );

      if (localDetails) {
        const details: PackageDetails = {
          name: localDetails.name ?? packageName,
          version: localDetails.version ?? 'Unknown',
          description: localDetails.description ?? 'No description available',
          author: this.extractAuthor(localDetails),
          license: localDetails.license ?? 'Unknown',
          homepage: localDetails.homepage ?? '',
          repository: this.formatRepository(localDetails.repository),
          dependencies: Object.keys(localDetails.dependencies ?? {}).length,
          source: 'local'
        };

        await this.panel.webview.postMessage({
          command: 'packageDetails',
          details,
          packageName
        });
        return;
      }

      // If not found locally, fetch from npm
      const details = await this.npmService.getPackageDetails(packageName);
      await this.panel.webview.postMessage({
        command: 'packageDetails',
        details,
        packageName
      });
    } catch (error) {
      await this.panel.webview.postMessage({
        command: 'packageDetails',
        details: {
          name: packageName,
          description: 'Could not fetch package details',
          version: 'unknown',
          author: 'Unknown',
          license: 'Unknown',
          homepage: '',
          repository: '',
          dependencies: 0,
          source: 'error'
        },
        packageName
      });
    }
  }

  /**
   * Extract author from package data
   */
  private extractAuthor(packageData: unknown): string {
    const author = (packageData as Record<string, unknown>)?.author;
    
    if (!author) {
      return 'Unknown';
    }

    if (typeof author === 'string') {
      return author;
    }

    if (typeof author === 'object' && author !== null) {
      return (author as Record<string, unknown>).name as string ?? 'Unknown';
    }

    return 'Unknown';
  }

  /**
   * Format repository information
   */
  private formatRepository(repo: unknown): string {
    if (!repo) {
      return '';
    }

    if (typeof repo === 'string') {
      return this.cleanRepositoryUrl(repo);
    }

    if (typeof repo === 'object' && repo !== null) {
      const repoUrl = (repo as Record<string, unknown>).url;
      if (typeof repoUrl === 'string') {
        return this.cleanRepositoryUrl(repoUrl);
      }
    }

    return '';
  }

  /**
   * Clean repository URL
   */
  private cleanRepositoryUrl(url: string): string {
    let cleaned = url;
    
    if (cleaned.startsWith('git+')) {
      cleaned = cleaned.substring(4);
    }
    
    if (cleaned.endsWith('.git')) {
      cleaned = cleaned.substring(0, cleaned.length - 4);
    }
    
    return cleaned;
  }

  /**
   * Dispose the panel
   */
  private dispose(): void {
    DependencyGraphPanel.currentPanel = undefined;
    this.panel.dispose();
    this.resourceManager.dispose();
    this.messageRouter.clear();
  }
}
