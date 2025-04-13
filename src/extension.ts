import * as vscode from 'vscode';
import { PackageJsonEditorProvider } from './panels/PackageJsonEditorProvider';
import { DependencyGraphPanel } from './panels/DependencyGraphPanel';

export function activate(context: vscode.ExtensionContext) {
  console.log('Package.json Manager extension is now active');

  // Register the custom editor provider
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      'packageJsonManager.packageJsonEditor',
      new PackageJsonEditorProvider(context),
      {
        webviewOptions: { retainContextWhenHidden: true },
        supportsMultipleEditorsPerDocument: false
      }
    )
  );

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('packageJsonManager.openPackageJsonEditor', async (uri?: vscode.Uri) => {
      if (!uri) {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
          uri = activeEditor.document.uri;
        } else {
          vscode.window.showErrorMessage('No active package.json file');
          return;
        }
      }

      try {
        await vscode.commands.executeCommand(
          'vscode.openWith',
          uri,
          'packageJsonManager.packageJsonEditor'
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Could not open package.json editor: ${error}`);
      }
    }),

    vscode.commands.registerCommand('packageJsonManager.toggleView', async () => {
      // Get all visible text editors with package.json files
      const visibleTextEditors = vscode.window.visibleTextEditors.filter(
        editor => editor.document.fileName.endsWith('package.json')
      );

      // Check if we're in a custom editor by looking for active package.json documents
      // that aren't in visible text editors (meaning they're in a custom editor)
      const packageJsonDocs = vscode.workspace.textDocuments.filter(
        doc => doc.fileName.endsWith('package.json')
      );

      const docsInCustomEditor = packageJsonDocs.filter(doc =>
        !visibleTextEditors.some(editor => editor.document.uri.toString() === doc.uri.toString())
      );

      // Check if we have a custom editor open
      if (docsInCustomEditor.length > 0) {
        // We're in the custom editor view, switch to text editor
        // Use the documents we already found in custom editors
        // Use the first package.json document found
        await vscode.commands.executeCommand(
          'vscode.openWith',
          docsInCustomEditor[0].uri,
          'default'
        );
      } else if (visibleTextEditors.length > 0) {
        // We're in the text editor view, switch to custom editor
        await vscode.commands.executeCommand(
          'vscode.openWith',
          visibleTextEditors[0].document.uri,
          'packageJsonManager.packageJsonEditor'
        );
      } else {
        // No package.json editor is currently active, try to find and open one
        const packageJsonFiles = await vscode.workspace.findFiles('**/package.json', '**/node_modules/**');

        if (packageJsonFiles.length === 0) {
          vscode.window.showErrorMessage('No package.json file found in workspace');
          return;
        } else if (packageJsonFiles.length === 1) {
          // If there's only one package.json, open it directly
          await vscode.commands.executeCommand(
            'vscode.openWith',
            packageJsonFiles[0],
            'packageJsonManager.packageJsonEditor'
          );
        } else {
          // Let user pick which package.json to open
          const pickedFile = await vscode.window.showQuickPick(
            packageJsonFiles.map(file => ({
              label: vscode.workspace.asRelativePath(file),
              uri: file
            })),
            { placeHolder: 'Select package.json file to open' }
          );

          if (pickedFile) {
            await vscode.commands.executeCommand(
              'vscode.openWith',
              pickedFile.uri,
              'packageJsonManager.packageJsonEditor'
            );
          }
        }
      }
    }),

    vscode.commands.registerCommand('packageJsonManager.showDependencyGraph', async () => {
      const activeEditor = vscode.window.activeTextEditor;
      let uri: vscode.Uri | undefined;

      if (activeEditor && activeEditor.document.fileName.endsWith('package.json')) {
        uri = activeEditor.document.uri;
      } else {
        const packageJsonFiles = await vscode.workspace.findFiles('**/package.json', '**/node_modules/**');

        if (packageJsonFiles.length === 0) {
          vscode.window.showErrorMessage('No package.json file found in workspace');
          return;
        } else if (packageJsonFiles.length === 1) {
          uri = packageJsonFiles[0];
        } else {
          // Let user pick which package.json to visualize
          const pickedFile = await vscode.window.showQuickPick(
            packageJsonFiles.map(file => ({
              label: vscode.workspace.asRelativePath(file),
              uri: file
            })),
            { placeHolder: 'Select package.json file to visualize' }
          );

          if (pickedFile) {
            uri = pickedFile.uri;
          } else {
            return;
          }
        }
      }

      // Show dependency graph panel
      DependencyGraphPanel.createOrShow(context.extensionUri, uri);
    })
  );
}

export function deactivate() {}