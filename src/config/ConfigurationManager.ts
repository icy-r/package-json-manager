import * as vscode from 'vscode';

export type ViewMode = 'visual' | 'text';

const SECTION = 'packageJsonManager';

export class ConfigurationManager {
  private get config(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(SECTION);
  }

  get enableAutomaticVisualEditing(): boolean {
    return this.config.get<boolean>('enableAutomaticVisualEditing', false);
  }

  get showDependencyGraphButton(): boolean {
    return this.config.get<boolean>('showDependencyGraphButton', true);
  }

  get maxDependencyDepth(): number {
    const depth = this.config.get<number>('maxDependencyDepth', 3);
    return Math.min(10, Math.max(1, depth));
  }

  get defaultViewMode(): ViewMode {
    return this.config.get<ViewMode>('defaultViewMode', 'visual');
  }
}
