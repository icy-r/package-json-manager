import * as vscode from 'vscode';
import { FileSystemService } from './FileSystemService';
import { ConfigurationManager } from '../config/ConfigurationManager';

export type NodeType = 'root' | 'dependency' | 'devDependency' | 'nestedDependency' | 'peerDependency';

export interface GraphNode {
  id: string;
  name: string;
  version: string;
  type: NodeType;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface DependencyGraph {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface PartialPackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

export class DependencyService {
  constructor(
    private readonly fileSystemService: FileSystemService,
    private readonly configManager: ConfigurationManager
  ) {}

  async generateDependencyGraph(
    workspaceUri: vscode.Uri,
    packageJson: PartialPackageJson,
    filterType?: 'all' | 'regular' | 'dev'
  ): Promise<DependencyGraph> {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const visited = new Set<string>();
    const maxDepth = this.configManager.maxDependencyDepth;

    const rootId = packageJson.name ?? 'root';
    nodes.push({
      id: rootId,
      name: rootId,
      version: packageJson.version ?? '0.0.0',
      type: 'root'
    });

    const nodeModulesUri = this.fileSystemService.resolveUri(workspaceUri, 'node_modules');
    const hasNodeModules = await this.fileSystemService.directoryExists(nodeModulesUri);

    if (!hasNodeModules) {
      return { nodes, links };
    }

    const deps = filterType !== 'dev' ? packageJson.dependencies ?? {} : {};
    const devDeps = filterType !== 'regular' ? packageJson.devDependencies ?? {} : {};

    for (const [name, version] of Object.entries(deps)) {
      await this.traverseDependency(
        nodeModulesUri, name, version, rootId, 'dependency',
        nodes, links, visited, 1, maxDepth
      );
    }

    for (const [name, version] of Object.entries(devDeps)) {
      await this.traverseDependency(
        nodeModulesUri, name, version, rootId, 'devDependency',
        nodes, links, visited, 1, maxDepth
      );
    }

    return { nodes, links };
  }

  private async traverseDependency(
    nodeModulesUri: vscode.Uri,
    name: string,
    version: string,
    parentId: string,
    type: NodeType,
    nodes: GraphNode[],
    links: GraphLink[],
    visited: Set<string>,
    depth: number,
    maxDepth: number
  ): Promise<void> {
    if (visited.has(name)) {
      if (!links.some(l => l.source === parentId && l.target === name)) {
        links.push({ source: parentId, target: name });
      }
      return;
    }

    visited.add(name);
    nodes.push({ id: name, name, version, type });
    links.push({ source: parentId, target: name });

    if (depth >= maxDepth) {
      return;
    }

    try {
      const pkgUri = this.fileSystemService.resolveUri(nodeModulesUri, name, 'package.json');
      const pkgData = await this.fileSystemService.readJsonFile<PartialPackageJson>(pkgUri);
      const nestedDeps = pkgData.dependencies ?? {};

      for (const [depName, depVersion] of Object.entries(nestedDeps)) {
        await this.traverseDependency(
          nodeModulesUri, depName, depVersion, name, 'nestedDependency',
          nodes, links, visited, depth + 1, maxDepth
        );
      }
    } catch {
      // Package not installed locally — skip nested resolution
    }
  }
}
