import * as vscode from 'vscode';
import { HtmlTemplateBuilder } from '../utils/HtmlTemplateBuilder';
import { isValidMessage } from '../utils/webviewUtils';
import { DependencyService } from '../services/DependencyService';
import { PackageJsonService } from '../services/PackageJsonService';
import { NpmRegistryService } from '../services/NpmRegistryService';
import { FileSystemService } from '../services/FileSystemService';

export class DependencyGraphPanel {
  private static instance: DependencyGraphPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(
    panel: vscode.WebviewPanel,
    private readonly extensionUri: vscode.Uri,
    private readonly htmlBuilder: HtmlTemplateBuilder,
    private readonly dependencyService: DependencyService,
    private readonly packageJsonService: PackageJsonService,
    private readonly npmService: NpmRegistryService,
    private readonly fsService: FileSystemService
  ) {
    this.panel = panel;
    this.panel.webview.html = this.getHtml();

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.onDidChangeViewState(() => {
      if (this.panel.visible) {
        this.refreshGraph();
      }
    }, null, this.disposables);

    this.panel.webview.onDidReceiveMessage(
      msg => this.handleMessage(msg),
      null,
      this.disposables
    );
  }

  static createOrShow(
    extensionUri: vscode.Uri,
    htmlBuilder: HtmlTemplateBuilder,
    dependencyService: DependencyService,
    packageJsonService: PackageJsonService,
    npmService: NpmRegistryService,
    fsService: FileSystemService
  ): void {
    if (DependencyGraphPanel.instance) {
      DependencyGraphPanel.instance.panel.reveal(vscode.ViewColumn.Beside);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'packageJsonManager.dependencyGraph',
      'Dependency Graph',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'media')]
      }
    );

    DependencyGraphPanel.instance = new DependencyGraphPanel(
      panel, extensionUri, htmlBuilder, dependencyService,
      packageJsonService, npmService, fsService
    );
  }

  private getHtml(): string {
    return this.htmlBuilder.build({
      webview: this.panel.webview,
      extensionUri: this.extensionUri,
      stylePaths: [['media', 'dependencyGraph.css']],
      scriptPaths: [['media', 'd3.min.js'], ['media', 'dependencyGraph.js']],
      title: 'Dependency Graph',
      bodyContent: `
        <div id="controls">
          <input type="text" id="search" placeholder="Search dependencies..." />
          <select id="filter">
            <option value="all">All</option>
            <option value="regular">Dependencies</option>
            <option value="dev">Dev Dependencies</option>
          </select>
          <div class="zoom-controls">
            <button class="zoom-btn" id="zoom-in" title="Zoom in">+</button>
            <button class="zoom-btn" id="zoom-out" title="Zoom out">−</button>
            <button class="zoom-btn" id="zoom-reset" title="Reset zoom">⊙</button>
          </div>
        </div>
        <div id="graph-container">
          <svg id="graph"></svg>
        </div>
        <div id="details-panel"></div>`
    });
  }

  private getWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      return vscode.workspace.getWorkspaceFolder(editor.document.uri);
    }

    for (const tab of vscode.window.tabGroups.all.flatMap(g => g.tabs)) {
      if (tab.input && typeof tab.input === 'object' && 'uri' in tab.input) {
        const uri = (tab.input as { uri: vscode.Uri }).uri;
        if (uri.fsPath.endsWith('package.json')) {
          return vscode.workspace.getWorkspaceFolder(uri);
        }
      }
    }

    return vscode.workspace.workspaceFolders?.[0];
  }

  private async refreshGraph(filterType?: 'all' | 'regular' | 'dev'): Promise<void> {
    const workspaceFolder = this.getWorkspaceFolder();
    if (!workspaceFolder) {
      this.panel.webview.postMessage({
        type: 'error',
        message: 'No workspace folder found. Open a project first.'
      });
      return;
    }

    try {
      const pkgUri = this.fsService.resolveUri(workspaceFolder.uri, 'package.json');
      const pkgContent = await this.fsService.readFile(pkgUri);
      const pkgData = this.packageJsonService.parse(pkgContent);
      const graph = await this.dependencyService.generateDependencyGraph(
        workspaceFolder.uri,
        pkgData,
        filterType
      );
      this.panel.webview.postMessage({ type: 'graphData', graph });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate graph';
      this.panel.webview.postMessage({ type: 'error', message });
    }
  }

  private async handleMessage(msg: unknown): Promise<void> {
    if (!isValidMessage(msg)) {
      return;
    }

    try {
      switch (msg.type) {
        case 'ready':
          await this.refreshGraph();
          break;

        case 'refreshGraph':
          await this.refreshGraph();
          break;

        case 'filterChanged':
          await this.refreshGraph(msg.filter as 'all' | 'regular' | 'dev');
          break;

        case 'getPackageDetails': {
          const details = await this.npmService.getPackageDetails(msg.name as string);
          this.panel.webview.postMessage({ type: 'packageDetails', details });
          break;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      vscode.window.showErrorMessage(`Dependency Graph: ${message}`);
    }
  }

  private dispose(): void {
    DependencyGraphPanel.instance = undefined;
    this.panel.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
  }
}
