import * as vscode from 'vscode';
import { PackageJsonEditorProvider } from './panels/PackageJsonEditorProvider';
import { OpenEditorCommand } from './commands/OpenEditorCommand';
import { ToggleViewCommand } from './commands/ToggleViewCommand';
import { ShowGraphCommand } from './commands/ShowGraphCommand';

/**
 * Activate the extension
 */
export function activate(context: vscode.ExtensionContext): void {
  console.log('Package.json Manager extension is now active');

  // Register the custom editor provider
  context.subscriptions.push(
    PackageJsonEditorProvider.register(context)
  );

  // Register commands
  registerCommands(context);
}

/**
 * Register all extension commands
 */
function registerCommands(context: vscode.ExtensionContext): void {
  // Create command instances
  const openEditorCommand = new OpenEditorCommand();
  const toggleViewCommand = new ToggleViewCommand();
  const showGraphCommand = new ShowGraphCommand(context.extensionUri);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'packageJsonManager.openPackageJsonEditor',
      (uri?: vscode.Uri) => openEditorCommand.execute(uri)
    ),
    
    vscode.commands.registerCommand(
      'packageJsonManager.toggleView',
      (uri?: vscode.Uri) => toggleViewCommand.execute(uri)
    ),
    
    vscode.commands.registerCommand(
      'packageJsonManager.showDependencyGraph',
      (uri?: vscode.Uri) => showGraphCommand.execute(uri)
    )
  );
}

/**
 * Deactivate the extension
 */
export function deactivate(): void {
  // This function is intentionally empty
  // Clean-up will be handled by VS Code's disposal mechanisms
}
