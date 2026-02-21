import * as vscode from 'vscode';
import { ConfigurationManager } from './config/ConfigurationManager';
import { HtmlTemplateBuilder } from './utils/HtmlTemplateBuilder';
import { FileSystemService } from './services/FileSystemService';
import { PackageJsonService } from './services/PackageJsonService';
import { NpmRegistryService } from './services/NpmRegistryService';
import { DependencyService } from './services/DependencyService';
import { PackageJsonEditorProvider } from './panels/PackageJsonEditorProvider';
import { OpenEditorCommand } from './commands/OpenEditorCommand';
import { ToggleViewCommand } from './commands/ToggleViewCommand';
import { ShowGraphCommand } from './commands/ShowGraphCommand';

export function activate(context: vscode.ExtensionContext): void {
  const config = new ConfigurationManager();
  const htmlBuilder = new HtmlTemplateBuilder();
  const fsService = new FileSystemService();
  const pkgService = new PackageJsonService();
  const npmService = new NpmRegistryService();
  const depService = new DependencyService(fsService, config);

  const showGraphCmd = new ShowGraphCommand(
    context.extensionUri, htmlBuilder, depService, pkgService, npmService, fsService
  );

  context.subscriptions.push(
    PackageJsonEditorProvider.register(context, htmlBuilder, pkgService, npmService),
    vscode.commands.registerCommand('packageJsonManager.openPackageJsonEditor',
      (uri?: vscode.Uri) => new OpenEditorCommand().execute(uri)),
    vscode.commands.registerCommand('packageJsonManager.toggleView',
      (uri?: vscode.Uri) => new ToggleViewCommand().execute(uri)),
    vscode.commands.registerCommand('packageJsonManager.showDependencyGraph',
      () => showGraphCmd.execute())
  );
}

export function deactivate(): void {}
