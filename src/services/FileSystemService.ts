import * as vscode from 'vscode';
import * as path from 'path';
import { FileSystemError } from './errors';

export class FileSystemService {
  async readFile(uri: vscode.Uri): Promise<string> {
    try {
      const data = await vscode.workspace.fs.readFile(uri);
      return Buffer.from(data).toString('utf-8');
    } catch {
      throw new FileSystemError(`Failed to read file: ${uri.fsPath}`);
    }
  }

  async directoryExists(uri: vscode.Uri): Promise<boolean> {
    try {
      const stat = await vscode.workspace.fs.stat(uri);
      return stat.type === vscode.FileType.Directory;
    } catch {
      return false;
    }
  }

  async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
    try {
      return await vscode.workspace.fs.readDirectory(uri);
    } catch {
      throw new FileSystemError(`Failed to read directory: ${uri.fsPath}`);
    }
  }

  async readJsonFile<T>(uri: vscode.Uri): Promise<T> {
    const content = await this.readFile(uri);
    try {
      return JSON.parse(content) as T;
    } catch {
      throw new FileSystemError(`Invalid JSON in file: ${uri.fsPath}`);
    }
  }

  resolveUri(base: vscode.Uri, ...segments: string[]): vscode.Uri {
    return vscode.Uri.file(path.join(base.fsPath, ...segments));
  }
}
