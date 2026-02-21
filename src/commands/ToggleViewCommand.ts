import * as vscode from 'vscode';

export class ToggleViewCommand {
  async execute(uri?: vscode.Uri): Promise<void> {
    const targetUri = uri ?? vscode.window.activeTextEditor?.document.uri;

    if (!targetUri) {
      vscode.window.showErrorMessage('No package.json file is currently active.');
      return;
    }

    if (!targetUri.fsPath.endsWith('package.json')) {
      vscode.window.showErrorMessage('This command only works with package.json files.');
      return;
    }

    const activeEditor = vscode.window.activeTextEditor;
    const isTextEditor = activeEditor && activeEditor.document.uri.toString() === targetUri.toString();

    if (isTextEditor) {
      await vscode.commands.executeCommand(
        'vscode.openWith',
        targetUri,
        'packageJsonManager.packageJsonEditor'
      );
    } else {
      await vscode.commands.executeCommand(
        'vscode.openWith',
        targetUri,
        'default'
      );
    }
  }
}
