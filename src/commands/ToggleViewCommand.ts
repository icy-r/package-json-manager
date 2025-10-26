import * as vscode from 'vscode';

/**
 * Command to toggle between visual editor and text editor for package.json
 */
export class ToggleViewCommand {
  /**
   * Execute the command with optional URI context
   */
  async execute(uri?: vscode.Uri): Promise<void> {
    // Get the target URI - use provided URI or try to determine from active editor
    const targetUri = uri || this.getActivePackageJsonUri();
    
    if (!targetUri) {
      vscode.window.showErrorMessage('No package.json file is currently open');
      return;
    }

    // Determine if we're currently in visual or text editor mode
    const isInVisualMode = await this.isInVisualEditor(targetUri);
    
    // Toggle to the other mode
    if (isInVisualMode) {
      await this.switchToTextEditor(targetUri);
    } else {
      await this.switchToCustomEditor(targetUri);
    }
  }

  /**
   * Get the URI of the currently active package.json file
   */
  private getActivePackageJsonUri(): vscode.Uri | undefined {
    // Check if active editor has a package.json
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && activeEditor.document.fileName.endsWith('package.json')) {
      return activeEditor.document.uri;
    }

    // Check custom editors (visible tab groups)
    for (const tabGroup of vscode.window.tabGroups.all) {
      for (const tab of tabGroup.tabs) {
        if (tab.input instanceof vscode.TabInputCustom) {
          if (tab.input.viewType === 'packageJsonManager.packageJsonEditor') {
            return tab.input.uri;
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Check if a URI is currently open in the visual editor
   */
  private async isInVisualEditor(uri: vscode.Uri): Promise<boolean> {
    // Check if there's an active custom editor with this URI
    for (const tabGroup of vscode.window.tabGroups.all) {
      for (const tab of tabGroup.tabs) {
        if (tab.input instanceof vscode.TabInputCustom) {
          if (tab.input.viewType === 'packageJsonManager.packageJsonEditor' &&
              tab.input.uri.toString() === uri.toString() &&
              tab.isActive) {
            return true;
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Switch to text editor
   */
  private async switchToTextEditor(uri: vscode.Uri): Promise<void> {
    await vscode.commands.executeCommand('vscode.openWith', uri, 'default');
  }

  /**
   * Switch to custom editor
   */
  private async switchToCustomEditor(uri: vscode.Uri): Promise<void> {
    await vscode.commands.executeCommand(
      'vscode.openWith',
      uri,
      'packageJsonManager.packageJsonEditor'
    );
  }
}

