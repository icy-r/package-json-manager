import * as vscode from 'vscode';
import { PackageJsonError } from './errors';

export interface PackageJsonData {
  name?: string;
  version?: string;
  description?: string;
  author?: string | { name: string; email?: string; url?: string };
  license?: string;
  keywords?: string[];
  homepage?: string;
  main?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

export class PackageJsonService {
  parse(text: string): PackageJsonData {
    try {
      return JSON.parse(text) as PackageJsonData;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new PackageJsonError(`Invalid JSON in package.json: ${detail}`);
    }
  }

  async applyEdit(document: vscode.TextDocument, newContent: string): Promise<boolean> {
    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(document.getText().length)
    );
    edit.replace(document.uri, fullRange, newContent);
    return vscode.workspace.applyEdit(edit);
  }

  updateField(data: PackageJsonData, field: string, value: unknown): PackageJsonData {
    return { ...data, [field]: value };
  }

  addDependency(
    data: PackageJsonData,
    name: string,
    version: string,
    isDev: boolean
  ): PackageJsonData {
    const key = isDev ? 'devDependencies' : 'dependencies';
    const deps = { ...(data[key] ?? {}), [name]: version };
    return { ...data, [key]: this.sortObject(deps) };
  }

  removeDependency(data: PackageJsonData, name: string): PackageJsonData {
    const result = { ...data };
    if (result.dependencies) {
      result.dependencies = this.omitKey(result.dependencies, name);
    }
    if (result.devDependencies) {
      result.devDependencies = this.omitKey(result.devDependencies, name);
    }
    return result;
  }

  moveDependency(data: PackageJsonData, name: string, toDev: boolean): PackageJsonData {
    const fromKey = toDev ? 'dependencies' : 'devDependencies';
    const toKey = toDev ? 'devDependencies' : 'dependencies';
    const fromDeps = data[fromKey] as Record<string, string> | undefined;
    const version = fromDeps?.[name];
    if (!version) {
      return data;
    }

    const result = { ...data };
    if (fromDeps) {
      (result[fromKey] as Record<string, string> | undefined) = this.omitKey(fromDeps, name);
    }
    const toDeps = { ...(result[toKey] as Record<string, string> ?? {}), [name]: version };
    (result[toKey] as Record<string, string>) = this.sortObject(toDeps);
    return result;
  }

  addScript(data: PackageJsonData, name: string, command: string): PackageJsonData {
    const scripts = { ...(data.scripts ?? {}), [name]: command };
    return { ...data, scripts };
  }

  removeScript(data: PackageJsonData, name: string): PackageJsonData {
    if (!data.scripts) {
      return data;
    }
    return { ...data, scripts: this.omitKey(data.scripts, name) };
  }

  stringify(data: PackageJsonData): string {
    return JSON.stringify(data, null, 2) + '\n';
  }

  private omitKey(
    obj: Record<string, string>,
    key: string
  ): Record<string, string> | undefined {
    const result = Object.fromEntries(
      Object.entries(obj).filter(([k]) => k !== key)
    );
    return Object.keys(result).length ? result : undefined;
  }

  private sortObject(obj: Record<string, string>): Record<string, string> {
    return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
  }
}
