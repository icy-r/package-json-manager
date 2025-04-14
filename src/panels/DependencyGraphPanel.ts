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
  public static createOrShow(
    extensionUri: vscode.Uri,
    packageJsonUri: vscode.Uri
  ) {
    // If we already have a panel, show it
    if (DependencyGraphPanel.currentPanel) {
      DependencyGraphPanel.currentPanel.panel.reveal(vscode.ViewColumn.Beside);
      DependencyGraphPanel.currentPanel.update(packageJsonUri);
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      "dependencyGraphView",
      "Dependency Graph",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(extensionUri.fsPath, "media")),
          vscode.Uri.file(path.join(extensionUri.fsPath, "dist")),
        ],
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

    // Set the webview's initial html content
    this.update(packageJsonUri);

    // Listen for when the panel is disposed
    // This happens when the user closes the panel or when the panel is closed programmatically
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Update the content based on view changes
    this.panel.onDidChangeViewState(
      (e) => {
        if (this.panel.visible) {
          this.update(this.packageJsonUri);
        }
      },
      null,
      this.disposables
    );

    // Handle messages from the webview
    this.panel.webview.onDidReceiveMessage(
      (message) => {
        switch (message.command) {
          case "refresh":
            this.update(this.packageJsonUri);
            break;
          case "getPackageDetails":
            this.getPackageDetails(message.packageName).then((details) => {
              this.panel.webview.postMessage({
                command: "packageDetails",
                details,
                packageName: message.packageName,
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
      this.panel.webview.html = this.getHtmlForWebview(
        this.panel.webview,
        graphData
      );
    } catch (error) {
      this.panel.webview.html = this.getErrorHtml(
        "Failed to generate dependency graph."
      );
    }
  }

  private getHtmlForWebview(webview: vscode.Webview, graphData: any): string {
    // Get paths to extension resources
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(this.extensionUri.fsPath, "media", "dependencyGraph.js")
      )
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.file(
        path.join(this.extensionUri.fsPath, "media", "dependencyGraph.css")
      )
    );
    const d3Uri = webview.asWebviewUri(
      vscode.Uri.file(path.join(this.extensionUri.fsPath, "media", "d3.min.js"))
    );

    // Log the paths to help with debugging
    console.log("D3 URI:", d3Uri.toString());
    console.log("Script URI:", scriptUri.toString());
    console.log("Style URI:", styleUri.toString());

    // Use a nonce to whitelist which scripts can be run
    const nonce = this.getNonce();

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${
          webview.cspSource
        } https:; script-src 'nonce-${nonce}' 'unsafe-eval'; style-src ${
      webview.cspSource
    } 'unsafe-inline';">
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
    // Extract direct dependencies
    const dependencies = packageJson.dependencies || {};
    const devDependencies = packageJson.devDependencies || {};

    // Get the directory of the package.json file
    const packageJsonDir = path.dirname(this.packageJsonUri.fsPath);
    const nodeModulesDir = path.join(packageJsonDir, "node_modules");

    // Keep track of all nodes and edges
    const nodes: any[] = [];
    const links: any[] = [];

    // Keep track of processed packages to avoid circular dependencies
    const processedPackages = new Set<string>();

    // Add root node
    const rootNodeId = packageJson.name || "current-package";
    nodes.push({
      id: rootNodeId,
      name: packageJson.name || "Current Package",
      version: packageJson.version || "0.0.0",
      type: "root",
    });

    // Process dependencies recursively
    await Promise.all([
      this.processPackageDependencies(
        dependencies,
        "dependency",
        rootNodeId,
        nodeModulesDir,
        nodes,
        links,
        processedPackages,
        1 // Depth level
      ),
      this.processPackageDependencies(
        devDependencies,
        "devDependency",
        rootNodeId,
        nodeModulesDir,
        nodes,
        links,
        processedPackages,
        1 // Depth level
      ),
    ]);

    return { nodes, links };
  }

  private async processPackageDependencies(
    dependencies: Record<string, string>,
    dependencyType: string,
    sourceNodeId: string,
    nodeModulesDir: string,
    nodes: any[],
    links: any[],
    processedPackages: Set<string>,
    depth: number,
    maxDepth = 3 // Removed the explicit type annotation since it's inferrable
  ): Promise<void> {
    if (depth > maxDepth) {
      return; // Stop recursion if max depth reached
    }

    await Promise.all(
      Object.entries(dependencies).map(async ([name, version]) => {
        // Create a unique ID based on the package name and source
        const nodeId = name;

        // Skip if we've already processed this package
        if (processedPackages.has(nodeId)) {
          // Just add a link if it doesn't exist yet
          if (
            !links.some(
              (link) => link.source === sourceNodeId && link.target === nodeId
            )
          ) {
            links.push({
              source: sourceNodeId,
              target: nodeId,
              type: dependencyType,
            });
          }
          return;
        }

        // Mark package as processed
        processedPackages.add(nodeId);

        // Add node
        nodes.push({
          id: nodeId,
          name,
          version: typeof version === "string" ? version : "Unknown",
          type: dependencyType,
        });

        // Add link
        links.push({
          source: sourceNodeId,
          target: nodeId,
          type: dependencyType,
        });

        // Try to read the package's package.json to get its dependencies
        try {
          const packageDir = path.join(nodeModulesDir, name);
          const packageJsonPath = path.join(packageDir, "package.json");

          if (fs.existsSync(packageJsonPath)) {
            const packageData = JSON.parse(
              fs.readFileSync(packageJsonPath, "utf8")
            );
            const nestedDeps = packageData.dependencies || {};

            // Recursively process nested dependencies
            await this.processPackageDependencies(
              nestedDeps,
              "nestedDependency", // Mark these as nested dependencies
              nodeId,
              nodeModulesDir,
              nodes,
              links,
              processedPackages,
              depth + 1,
              maxDepth
            );
          }
        } catch (error) {
          console.error(`Error processing dependencies for ${name}:`, error);
        }
      })
    );
  }

  private async getPackageDetails(packageName: string): Promise<any> {
    try {
      // First check if we can find the package in node_modules
      const packageJsonDir = path.dirname(this.packageJsonUri.fsPath);
      const nodeModulesDir = path.join(packageJsonDir, "node_modules");
      const packageDir = path.join(nodeModulesDir, packageName);
      const packageJsonPath = path.join(packageDir, "package.json");

      if (fs.existsSync(packageJsonPath)) {
        // If the package exists locally, read its package.json
        const packageData = JSON.parse(
          fs.readFileSync(packageJsonPath, "utf8")
        );
        return {
          name: packageData.name,
          version: packageData.version,
          description: packageData.description || "No description available",
          author: this.formatAuthor(packageData.author),
          license: packageData.license || "Unknown",
          homepage: packageData.homepage || "",
          repository: this.formatRepository(packageData.repository),
          dependencies: Object.keys(packageData.dependencies || {}).length,
          source: "local",
        };
      } else {
        // If not found locally, fetch from npm registry
        // Use the VS Code extension API to make HTTP requests
        try {
          const requestOptions: vscode.WebviewOptions = {
            enableScripts: true,
          };

          // Fetch from npm registry
          const response = await fetch(
            `https://registry.npmjs.org/${packageName}`
          );

          if (!response.ok) {
            throw new Error(
              `Failed to fetch package data: ${response.statusText}`
            );
          }

          const data = await response.json();
          const latestVersion = data["dist-tags"]?.latest;
          const versionData = latestVersion
            ? data.versions[latestVersion]
            : null;

          if (!versionData) {
            throw new Error("Could not find latest version data");
          }

          return {
            name: data.name,
            version: latestVersion,
            description: versionData.description || "No description available",
            author: this.formatAuthor(versionData.author),
            license: versionData.license || "Unknown",
            homepage: versionData.homepage || data.homepage || "",
            repository: this.formatRepository(
              versionData.repository || data.repository
            ),
            dependencies: Object.keys(versionData.dependencies || {}).length,
            maintainers: (data.maintainers || [])
              .map((m: any) => m.name)
              .join(", "),
            downloads: "Available on npm",
            source: "npm",
          };
        } catch (error) {
          console.error(`Error fetching npm data for ${packageName}:`, error);
          // Return basic info if npm fetch fails
          return {
            name: packageName,
            description: "Could not fetch package details from npm registry",
            version: "unknown",
            source: "error",
          };
        }
      }
    } catch (error) {
      console.error(`Error in getPackageDetails for ${packageName}:`, error);
      return {
        name: packageName,
        description: "Error retrieving package details",
        version: "unknown",
        source: "error",
      };
    }
  }

  private formatAuthor(author: any): string {
    if (!author) {
      return "Unknown";
    }

    if (typeof author === "string") {
      return author;
    }

    if (typeof author === "object") {
      return author.name || "Unknown";
    }

    return "Unknown";
  }

  private formatRepository(repo: any): string {
    if (!repo) {
      return "";
    }

    if (typeof repo === "string") {
      return repo;
    }

    if (typeof repo === "object") {
      if (repo.url) {
        // Clean up git URLs to make them clickable
        let url = repo.url;
        if (url.startsWith("git+")) {
          url = url.substring(4);
        }
        if (url.endsWith(".git")) {
          url = url.substring(0, url.length - 4);
        }
        return url;
      }
      return "";
    }

    return "";
  }

  private getNonce(): string {
    let text = "";
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
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