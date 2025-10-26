import * as vscode from 'vscode';

/**
 * Configuration keys for the extension
 */
export enum ConfigurationKey {
  EnableAutomaticVisualEditing = 'enableAutomaticVisualEditing',
  ShowDependencyGraphButton = 'showDependencyGraphButton',
  MaxDependencyDepth = 'maxDependencyDepth',
  DefaultViewMode = 'defaultViewMode'
}

/**
 * Type-safe configuration manager for extension settings
 */
export class ConfigurationManager {
  private static readonly extensionId = 'packageJsonManager';

  /**
   * Get the workspace configuration
   */
  private static getConfiguration(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(ConfigurationManager.extensionId);
  }

  /**
   * Get a configuration value
   * 
   * @param key - Configuration key
   * @param defaultValue - Default value if not set
   * @returns Configuration value
   */
  static get<T>(key: ConfigurationKey, defaultValue: T): T {
    const config = ConfigurationManager.getConfiguration();
    return config.get<T>(key, defaultValue);
  }

  /**
   * Update a configuration value
   * 
   * @param key - Configuration key
   * @param value - New value
   * @param target - Configuration target (global, workspace, etc.)
   */
  static async set<T>(
    key: ConfigurationKey,
    value: T,
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
  ): Promise<void> {
    const config = ConfigurationManager.getConfiguration();
    await config.update(key, value, target);
  }

  /**
   * Check if automatic visual editing is enabled
   */
  static isAutomaticVisualEditingEnabled(): boolean {
    return ConfigurationManager.get(
      ConfigurationKey.EnableAutomaticVisualEditing,
      false
    );
  }

  /**
   * Check if dependency graph button should be shown
   */
  static shouldShowDependencyGraphButton(): boolean {
    return ConfigurationManager.get(
      ConfigurationKey.ShowDependencyGraphButton,
      true
    );
  }

  /**
   * Get the maximum dependency depth for graph generation
   */
  static getMaxDependencyDepth(): number {
    const depth = ConfigurationManager.get(
      ConfigurationKey.MaxDependencyDepth,
      3
    );
    // Ensure value is between 1 and 10
    return Math.max(1, Math.min(10, depth));
  }

  /**
   * Get the default view mode
   */
  static getDefaultViewMode(): 'visual' | 'text' {
    return ConfigurationManager.get<'visual' | 'text'>(
      ConfigurationKey.DefaultViewMode,
      'visual'
    );
  }

  /**
   * Watch for configuration changes
   * 
   * @param callback - Callback to invoke when configuration changes
   * @returns Disposable to stop watching
   */
  static onDidChangeConfiguration(
    callback: (event: vscode.ConfigurationChangeEvent) => void
  ): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(ConfigurationManager.extensionId)) {
        callback(event);
      }
    });
  }

  /**
   * Watch for a specific configuration key change
   * 
   * @param key - Configuration key to watch
   * @param callback - Callback to invoke when the key changes
   * @returns Disposable to stop watching
   */
  static onDidChange<T>(
    key: ConfigurationKey,
    callback: (newValue: T) => void
  ): vscode.Disposable {
    return ConfigurationManager.onDidChangeConfiguration(() => {
      const value = ConfigurationManager.get<T>(key, undefined as T);
      callback(value);
    });
  }

  /**
   * Reset a configuration value to its default
   * 
   * @param key - Configuration key
   * @param target - Configuration target
   */
  static async reset(
    key: ConfigurationKey,
    target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Workspace
  ): Promise<void> {
    await ConfigurationManager.set(key, undefined, target);
  }

  /**
   * Get all current configuration values
   */
  static getAllSettings(): Record<string, unknown> {
    const config = ConfigurationManager.getConfiguration();
    return {
      enableAutomaticVisualEditing: config.get(ConfigurationKey.EnableAutomaticVisualEditing),
      showDependencyGraphButton: config.get(ConfigurationKey.ShowDependencyGraphButton),
      maxDependencyDepth: config.get(ConfigurationKey.MaxDependencyDepth),
      defaultViewMode: config.get(ConfigurationKey.DefaultViewMode)
    };
  }

  /**
   * Validate configuration values
   * Returns array of validation errors, empty if valid
   */
  static validate(): string[] {
    const errors: string[] = [];
    
    // Validate maxDependencyDepth
    const depth = ConfigurationManager.get(ConfigurationKey.MaxDependencyDepth, 3);
    if (typeof depth !== 'number' || depth < 1 || depth > 10) {
      errors.push('maxDependencyDepth must be a number between 1 and 10');
    }
    
    // Validate defaultViewMode
    const viewMode = ConfigurationManager.get(ConfigurationKey.DefaultViewMode, 'visual');
    if (viewMode !== 'visual' && viewMode !== 'text') {
      errors.push('defaultViewMode must be either "visual" or "text"');
    }
    
    return errors;
  }
}

