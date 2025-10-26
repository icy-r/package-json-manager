import * as vscode from 'vscode';
import { FileSystemService } from './FileSystemService';
import { PackageJsonData } from './PackageJsonService';

/**
 * Graph node representing a package
 */
export interface DependencyNode {
  id: string;
  name: string;
  version: string;
  type: 'root' | 'dependency' | 'devDependency' | 'nestedDependency';
}

/**
 * Graph link representing a dependency relationship
 */
export interface DependencyLink {
  source: string;
  target: string;
  type: string;
}

/**
 * Complete dependency graph data
 */
export interface DependencyGraphData {
  nodes: DependencyNode[];
  links: DependencyLink[];
}

/**
 * Options for dependency graph generation
 */
export interface GraphOptions {
  maxDepth?: number;
  includeDev?: boolean;
  includePeer?: boolean;
}

/**
 * Service for analyzing and generating dependency graphs
 */
export class DependencyService {
  constructor(private readonly fileSystem: FileSystemService) {}

  /**
   * Generate dependency graph data from package.json
   * 
   * @param packageJsonUri - URI of the package.json file
   * @param options - Graph generation options
   * @returns Dependency graph data
   */
  async generateDependencyGraph(
    packageJsonUri: vscode.Uri,
    options: GraphOptions = {}
  ): Promise<DependencyGraphData> {
    const {
      maxDepth = 3,
      includeDev = true,
      includePeer = false
    } = options;

    // Read the package.json file
    const packageJson = await this.fileSystem.readJsonFile<PackageJsonData>(
      packageJsonUri.fsPath
    );

    const nodes: DependencyNode[] = [];
    const links: DependencyLink[] = [];
    const processedPackages = new Set<string>();

    // Add root node
    const rootNodeId = packageJson.name ?? 'current-package';
    nodes.push({
      id: rootNodeId,
      name: packageJson.name ?? 'Current Package',
      version: packageJson.version ?? '0.0.0',
      type: 'root'
    });

    // Get the directory containing package.json
    const packageDir = this.fileSystem.dirname(packageJsonUri.fsPath);
    const nodeModulesDir = this.fileSystem.join(packageDir, 'node_modules');

    // Check if node_modules exists
    const nodeModulesExists = await this.fileSystem.exists(nodeModulesDir);
    if (!nodeModulesExists) {
      // Return just the root node if no node_modules
      return { nodes, links };
    }

    // Process dependencies
    const tasks: Promise<void>[] = [];

    if (packageJson.dependencies) {
      tasks.push(
        this.processPackageDependencies(
          packageJson.dependencies,
          'dependency',
          rootNodeId,
          nodeModulesDir,
          nodes,
          links,
          processedPackages,
          1,
          maxDepth
        )
      );
    }

    if (includeDev && packageJson.devDependencies) {
      tasks.push(
        this.processPackageDependencies(
          packageJson.devDependencies,
          'devDependency',
          rootNodeId,
          nodeModulesDir,
          nodes,
          links,
          processedPackages,
          1,
          maxDepth
        )
      );
    }

    if (includePeer && packageJson.peerDependencies) {
      tasks.push(
        this.processPackageDependencies(
          packageJson.peerDependencies,
          'peerDependency',
          rootNodeId,
          nodeModulesDir,
          nodes,
          links,
          processedPackages,
          1,
          maxDepth
        )
      );
    }

    await Promise.all(tasks);

    return { nodes, links };
  }

  /**
   * Process dependencies recursively
   */
  private async processPackageDependencies(
    dependencies: Record<string, string>,
    dependencyType: string,
    sourceNodeId: string,
    nodeModulesDir: string,
    nodes: DependencyNode[],
    links: DependencyLink[],
    processedPackages: Set<string>,
    depth: number,
    maxDepth: number
  ): Promise<void> {
    if (depth > maxDepth) {
      return;
    }

    const tasks = Object.entries(dependencies).map(async ([name, version]) => {
      const nodeId = name;

      // Skip if already processed
      if (processedPackages.has(nodeId)) {
        // Add link if it doesn't exist
        if (!links.some(link => 
          link.source === sourceNodeId && link.target === nodeId
        )) {
          links.push({
            source: sourceNodeId,
            target: nodeId,
            type: dependencyType
          });
        }
        return;
      }

      // Mark as processed
      processedPackages.add(nodeId);

      // Add node
      nodes.push({
        id: nodeId,
        name,
        version: typeof version === 'string' ? version : 'Unknown',
        type: dependencyType as any
      });

      // Add link
      links.push({
        source: sourceNodeId,
        target: nodeId,
        type: dependencyType
      });

      // Try to read nested dependencies
      try {
        const packageDir = this.fileSystem.join(nodeModulesDir, name);
        const packageJsonPath = this.fileSystem.join(packageDir, 'package.json');

        if (await this.fileSystem.exists(packageJsonPath)) {
          const packageData = await this.fileSystem.readJsonFile<PackageJsonData>(
            packageJsonPath
          );

          if (packageData.dependencies) {
            await this.processPackageDependencies(
              packageData.dependencies,
              'nestedDependency',
              nodeId,
              nodeModulesDir,
              nodes,
              links,
              processedPackages,
              depth + 1,
              maxDepth
            );
          }
        }
      } catch (error) {
        // Silently skip packages we can't read
        console.error(`Error processing dependencies for ${name}:`, error);
      }
    });

    await Promise.all(tasks);
  }

  /**
   * Get direct dependencies from package.json
   * 
   * @param packageJsonUri - URI of the package.json file
   * @param includeDev - Whether to include devDependencies
   * @returns Map of dependency names to versions
   */
  async getDirectDependencies(
    packageJsonUri: vscode.Uri,
    includeDev = true
  ): Promise<Map<string, string>> {
    const packageJson = await this.fileSystem.readJsonFile<PackageJsonData>(
      packageJsonUri.fsPath
    );

    const dependencies = new Map<string, string>();

    if (packageJson.dependencies) {
      Object.entries(packageJson.dependencies).forEach(([name, version]) => {
        dependencies.set(name, version);
      });
    }

    if (includeDev && packageJson.devDependencies) {
      Object.entries(packageJson.devDependencies).forEach(([name, version]) => {
        dependencies.set(name, version);
      });
    }

    return dependencies;
  }

  /**
   * Get installed version of a package from node_modules
   * 
   * @param packageJsonUri - URI of the project's package.json
   * @param packageName - Name of the package to check
   * @returns Installed version or undefined if not found
   */
  async getInstalledVersion(
    packageJsonUri: vscode.Uri,
    packageName: string
  ): Promise<string | undefined> {
    try {
      const packageDir = this.fileSystem.dirname(packageJsonUri.fsPath);
      const nodeModulesDir = this.fileSystem.join(packageDir, 'node_modules');
      const targetPackageJson = this.fileSystem.join(
        nodeModulesDir,
        packageName,
        'package.json'
      );

      if (await this.fileSystem.exists(targetPackageJson)) {
        const packageData = await this.fileSystem.readJsonFile<PackageJsonData>(
          targetPackageJson
        );
        return packageData.version;
      }

      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Check if a package is installed in node_modules
   * 
   * @param packageJsonUri - URI of the project's package.json
   * @param packageName - Name of the package to check
   * @returns True if installed
   */
  async isPackageInstalled(
    packageJsonUri: vscode.Uri,
    packageName: string
  ): Promise<boolean> {
    const version = await this.getInstalledVersion(packageJsonUri, packageName);
    return version !== undefined;
  }

  /**
   * Get package details from local node_modules
   * 
   * @param packageJsonUri - URI of the project's package.json
   * @param packageName - Name of the package
   * @returns Package.json data from node_modules or undefined
   */
  async getLocalPackageDetails(
    packageJsonUri: vscode.Uri,
    packageName: string
  ): Promise<PackageJsonData | undefined> {
    try {
      const packageDir = this.fileSystem.dirname(packageJsonUri.fsPath);
      const nodeModulesDir = this.fileSystem.join(packageDir, 'node_modules');
      const targetPackageJson = this.fileSystem.join(
        nodeModulesDir,
        packageName,
        'package.json'
      );

      if (await this.fileSystem.exists(targetPackageJson)) {
        return await this.fileSystem.readJsonFile<PackageJsonData>(
          targetPackageJson
        );
      }

      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Find circular dependencies in the dependency graph
   * 
   * @param graphData - Dependency graph data
   * @returns Array of circular dependency chains
   */
  findCircularDependencies(graphData: DependencyGraphData): string[][] {
    const circles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    // Build adjacency list
    const adjList = new Map<string, string[]>();
    for (const link of graphData.links) {
      if (!adjList.has(link.source)) {
        adjList.set(link.source, []);
      }
      adjList.get(link.source)!.push(link.target);
    }

    const dfs = (node: string, path: string[]): void => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = adjList.get(node) ?? [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, [...path]);
        } else if (recursionStack.has(neighbor)) {
          // Found a cycle
          const cycleStart = path.indexOf(neighbor);
          if (cycleStart !== -1) {
            circles.push([...path.slice(cycleStart), neighbor]);
          }
        }
      }

      recursionStack.delete(node);
    };

    // Check all nodes
    for (const node of graphData.nodes) {
      if (!visited.has(node.id)) {
        dfs(node.id, []);
      }
    }

    return circles;
  }

  /**
   * Filter graph data by dependency type
   * 
   * @param graphData - Full graph data
   * @param types - Dependency types to include
   * @returns Filtered graph data
   */
  filterByType(
    graphData: DependencyGraphData,
    types: Array<'root' | 'dependency' | 'devDependency' | 'nestedDependency'>
  ): DependencyGraphData {
    const typeSet = new Set(types);
    
    // Filter nodes
    const filteredNodes = graphData.nodes.filter(node =>
      typeSet.has(node.type)
    );
    
    // Get node IDs that are kept
    const keptNodeIds = new Set(filteredNodes.map(n => n.id));
    
    // Filter links to only include those between kept nodes
    const filteredLinks = graphData.links.filter(link =>
      keptNodeIds.has(link.source) && keptNodeIds.has(link.target)
    );

    return {
      nodes: filteredNodes,
      links: filteredLinks
    };
  }

  /**
   * Count dependencies by type
   * 
   * @param graphData - Graph data
   * @returns Count by dependency type
   */
  countByType(graphData: DependencyGraphData): Record<string, number> {
    const counts: Record<string, number> = {
      root: 0,
      dependency: 0,
      devDependency: 0,
      nestedDependency: 0
    };

    for (const node of graphData.nodes) {
      counts[node.type] = (counts[node.type] ?? 0) + 1;
    }

    return counts;
  }
}

