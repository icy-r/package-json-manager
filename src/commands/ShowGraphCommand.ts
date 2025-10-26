import * as vscode from 'vscode';
import { DependencyGraphPanel } from '../panels/DependencyGraphPanel';

/**
 * Command to show the dependency graph visualization
 */
export class ShowGraphCommand {
  constructor(private readonly extensionUri: vscode.Uri) {}

  /**
   * Execute the command
   */
  async execute(uri?: vscode.Uri): Promise<void> {
    // Resolve URI if not provided
    const targetUri = uri ?? await this.resolvePackageJsonUri();
    
    if (!targetUri) {
      vscode.window.showErrorMessage('No package.json file found in workspace');
      return;
    }

    // Show dependency graph panel
    DependencyGraphPanel.createOrShow(this.extensionUri, targetUri);
  }

  /**
   * Resolve package.json URI from active editor or workspace
   */
  private async resolvePackageJsonUri(): Promise<vscode.Uri | undefined> {
    // Check active editor
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && activeEditor.document.fileName.endsWith('package.json')) {
      return activeEditor.document.uri;
    }

    // Search workspace
    const packageJsonFiles = await vscode.workspace.findFiles(
      '**/package.json',
      '**/node_modules/**'
    );

    if (packageJsonFiles.length === 0) {
      return undefined;
    }

    if (packageJsonFiles.length === 1) {
      return packageJsonFiles[0];
    }

    // Let user pick
    const pickedFile = await vscode.window.showQuickPick(
      packageJsonFiles.map(file => ({
        label: vscode.workspace.asRelativePath(file),
        uri: file
      })),
      { placeHolder: 'Select package.json file to visualize' }
    );

    return pickedFile?.uri;
  }
}

