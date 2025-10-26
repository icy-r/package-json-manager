import * as vscode from 'vscode';
import { FileSystemService, FileSystemError } from './FileSystemService';

/**
 * Error thrown when package.json operations fail
 */
export class PackageJsonError extends Error {
  constructor(
    message: string,
    public readonly uri?: vscode.Uri,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'PackageJsonError';
  }
}

/**
 * Package.json data structure
 */
export interface PackageJsonData {
  name?: string;
  version?: string;
  description?: string;
  author?: string | { name: string; email?: string };
  license?: string;
  keywords?: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  repository?: string | { type: string; url: string };
  homepage?: string;
  bugs?: string | { url: string; email?: string };
  main?: string;
  types?: string;
  engines?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Service for managing package.json files
 */
export class PackageJsonService {
  constructor(private readonly fileSystem: FileSystemService) {}

  /**
   * Read and parse a package.json file
   * 
   * @param uri - URI of the package.json file
   * @returns Parsed package.json data
   * @throws {PackageJsonError} When read or parse fails
   */
  async readPackageJson(uri: vscode.Uri): Promise<PackageJsonData> {
    try {
      const content = await this.fileSystem.readFile(uri.fsPath);
      const data = JSON.parse(content);
      
      // Validate basic structure
      if (!this.isValidPackageJson(data)) {
        throw new Error('Invalid package.json structure');
      }
      
      return data as PackageJsonData;
    } catch (error) {
      if (error instanceof FileSystemError) {
        throw new PackageJsonError(
          `Failed to read package.json: ${error.message}`,
          uri,
          error
        );
      }
      throw new PackageJsonError(
        `Failed to parse package.json: ${error instanceof Error ? error.message : 'Unknown error'}`,
        uri,
        error as Error
      );
    }
  }

  /**
   * Write package.json data to file
   * 
   * @param uri - URI of the package.json file
   * @param data - Package.json data to write
   * @throws {PackageJsonError} When write fails
   */
  async writePackageJson(uri: vscode.Uri, data: PackageJsonData): Promise<void> {
    try {
      // Validate before writing
      if (!this.isValidPackageJson(data)) {
        throw new Error('Invalid package.json data');
      }
      
      await this.fileSystem.writeJsonFile(uri.fsPath, data, 2);
    } catch (error) {
      throw new PackageJsonError(
        `Failed to write package.json: ${error instanceof Error ? error.message : 'Unknown error'}`,
        uri,
        error as Error
      );
    }
  }

  /**
   * Update package.json using VS Code's edit API
   * This ensures proper undo/redo support
   * 
   * @param document - Text document to update
   * @param data - New package.json data
   */
  async updateDocument(
    document: vscode.TextDocument,
    data: PackageJsonData
  ): Promise<void> {
    try {
      const edit = new vscode.WorkspaceEdit();
      const formatted = JSON.stringify(data, null, 2);
      
      // Replace entire document
      edit.replace(
        document.uri,
        new vscode.Range(0, 0, document.lineCount, 0),
        formatted
      );
      
      const success = await vscode.workspace.applyEdit(edit);
      if (!success) {
        throw new Error('Failed to apply edit');
      }
    } catch (error) {
      throw new PackageJsonError(
        `Failed to update document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        document.uri,
        error as Error
      );
    }
  }

  /**
   * Add a dependency to package.json
   * 
   * @param data - Package.json data
   * @param name - Dependency name
   * @param version - Dependency version
   * @param isDev - Whether it's a dev dependency
   * @returns Updated package.json data
   */
  addDependency(
    data: PackageJsonData,
    name: string,
    version: string,
    isDev = false
  ): PackageJsonData {
    const updated = { ...data };
    const key = isDev ? 'devDependencies' : 'dependencies';
    
    if (!updated[key]) {
      updated[key] = {};
    }
    
    const dependencies = updated[key];
    if (dependencies && typeof dependencies === 'object') {
      dependencies[name] = version;
      // Sort dependencies alphabetically
      updated[key] = this.sortObject(dependencies);
    }
    
    return updated;
  }

  /**
   * Remove a dependency from package.json
   * 
   * @param data - Package.json data
   * @param name - Dependency name
   * @param isDev - Whether it's a dev dependency
   * @returns Updated package.json data
   */
  removeDependency(
    data: PackageJsonData,
    name: string,
    isDev = false
  ): PackageJsonData {
    const updated = { ...data };
    const key = isDev ? 'devDependencies' : 'dependencies';
    
    const dependencies = updated[key];
    if (dependencies && typeof dependencies === 'object' && name in dependencies) {
      const deps = { ...dependencies };
      delete deps[name];
      updated[key] = deps;
    }
    
    return updated;
  }

  /**
   * Update a dependency version
   * 
   * @param data - Package.json data
   * @param name - Dependency name
   * @param version - New version
   * @param isDev - Whether it's a dev dependency
   * @returns Updated package.json data
   */
  updateDependency(
    data: PackageJsonData,
    name: string,
    version: string,
    isDev = false
  ): PackageJsonData {
    const updated = { ...data };
    const key = isDev ? 'devDependencies' : 'dependencies';
    
    const dependencies = updated[key];
    if (dependencies && typeof dependencies === 'object' && name in dependencies) {
      updated[key] = { ...dependencies, [name]: version };
    }
    
    return updated;
  }

  /**
   * Move dependency between dependencies and devDependencies
   * 
   * @param data - Package.json data
   * @param name - Dependency name
   * @param toDev - Move to dev dependencies if true, to regular if false
   * @returns Updated package.json data
   */
  moveDependency(
    data: PackageJsonData,
    name: string,
    toDev: boolean
  ): PackageJsonData {
    let updated = { ...data };
    const fromKey = toDev ? 'dependencies' : 'devDependencies';
    
    const fromDeps = updated[fromKey];
    if (fromDeps && typeof fromDeps === 'object' && name in fromDeps) {
      const version = fromDeps[name];
      if (typeof version === 'string') {
        updated = this.removeDependency(updated, name, !toDev);
        updated = this.addDependency(updated, name, version, toDev);
      }
    }
    
    return updated;
  }

  /**
   * Add a script to package.json
   * 
   * @param data - Package.json data
   * @param name - Script name
   * @param command - Script command
   * @returns Updated package.json data
   */
  addScript(
    data: PackageJsonData,
    name: string,
    command: string
  ): PackageJsonData {
    const updated = { ...data };
    
    if (!updated.scripts) {
      updated.scripts = {};
    }
    
    updated.scripts[name] = command;
    
    return updated;
  }

  /**
   * Remove a script from package.json
   * 
   * @param data - Package.json data
   * @param name - Script name
   * @returns Updated package.json data
   */
  removeScript(data: PackageJsonData, name: string): PackageJsonData {
    const updated = { ...data };
    
    if (updated.scripts && updated.scripts[name]) {
      const scripts = { ...updated.scripts };
      delete scripts[name];
      updated.scripts = scripts;
    }
    
    return updated;
  }

  /**
   * Update package metadata
   * 
   * @param data - Package.json data
   * @param updates - Partial updates to apply
   * @returns Updated package.json data
   */
  updateMetadata(
    data: PackageJsonData,
    updates: Partial<PackageJsonData>
  ): PackageJsonData {
    return { ...data, ...updates };
  }

  /**
   * Get all dependencies (both regular and dev)
   * 
   * @param data - Package.json data
   * @returns Combined dependencies object
   */
  getAllDependencies(data: PackageJsonData): Record<string, string> {
    return {
      ...(data.dependencies ?? {}),
      ...(data.devDependencies ?? {})
    };
  }

  /**
   * Check if a dependency exists
   * 
   * @param data - Package.json data
   * @param name - Dependency name
   * @returns True if dependency exists (in either dependencies or devDependencies)
   */
  hasDependency(data: PackageJsonData, name: string): boolean {
    return !!(
      (data.dependencies && data.dependencies[name]) ||
      (data.devDependencies && data.devDependencies[name])
    );
  }

  /**
   * Validate package.json structure
   */
  private isValidPackageJson(data: any): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }
    
    // At minimum, package.json should be an object
    // name and version are recommended but not strictly required
    return true;
  }

  /**
   * Sort object keys alphabetically
   */
  private sortObject<T extends Record<string, any>>(obj: T): T {
    const sorted: any = {};
    Object.keys(obj)
      .sort()
      .forEach(key => {
        sorted[key] = obj[key];
      });
    return sorted;
  }

  /**
   * Find all package.json files in workspace
   * 
   * @returns Array of package.json URIs
   */
  async findPackageJsonFiles(): Promise<vscode.Uri[]> {
    return await vscode.workspace.findFiles(
      '**/package.json',
      '**/node_modules/**'
    );
  }

  /**
   * Get package.json from current workspace root
   * 
   * @returns URI of root package.json or undefined
   */
  async getRootPackageJson(): Promise<vscode.Uri | undefined> {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceRoot) {
      return undefined;
    }
    
    const packageJsonPath = vscode.Uri.joinPath(workspaceRoot.uri, 'package.json');
    const exists = await this.fileSystem.exists(packageJsonPath.fsPath);
    
    return exists ? packageJsonPath : undefined;
  }
}

