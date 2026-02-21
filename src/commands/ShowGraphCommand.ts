import * as vscode from 'vscode';
import { HtmlTemplateBuilder } from '../utils/HtmlTemplateBuilder';
import { DependencyService } from '../services/DependencyService';
import { PackageJsonService } from '../services/PackageJsonService';
import { NpmRegistryService } from '../services/NpmRegistryService';
import { FileSystemService } from '../services/FileSystemService';
import { DependencyGraphPanel } from '../panels/DependencyGraphPanel';

export class ShowGraphCommand {
  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly htmlBuilder: HtmlTemplateBuilder,
    private readonly dependencyService: DependencyService,
    private readonly packageJsonService: PackageJsonService,
    private readonly npmService: NpmRegistryService,
    private readonly fsService: FileSystemService
  ) {}

  async execute(): Promise<void> {
    DependencyGraphPanel.createOrShow(
      this.extensionUri,
      this.htmlBuilder,
      this.dependencyService,
      this.packageJsonService,
      this.npmService,
      this.fsService
    );
  }
}
