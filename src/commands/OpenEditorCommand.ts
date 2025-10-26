import * as vscode from 'vscode';

/**
 * Command to open a package.json file in the custom editor
 */
export class OpenEditorCommand {
  /**
   * Execute the command
   */
  async execute(uri?: vscode.Uri): Promise<void> {
    // Resolve URI if not provided
    const targetUri = uri ?? await this.resolvePackageJsonUri();
    
    if (!targetUri) {
      vscode.window.showErrorMessage('No active package.json file');
      return;
    }

    try {
      await vscode.commands.executeCommand(
        'vscode.openWith',
        targetUri,
        'packageJsonManager.packageJsonEditor'
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Could not open package.json editor: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Resolve package.json URI from active editor or workspace
   */
  private async resolvePackageJsonUri(): Promise<vscode.Uri | undefined> {
    // Check active editor
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
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
      { placeHolder: 'Select package.json file to open' }
    );

    return pickedFile?.uri;
  }
}

