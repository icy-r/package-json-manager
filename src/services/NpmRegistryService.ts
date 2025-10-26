import axios from 'axios';

/**
 * Error thrown when npm registry operations fail
 */
export class NpmRegistryError extends Error {
  constructor(
    message: string,
    public readonly packageName?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'NpmRegistryError';
  }
}

/**
 * Package information from npm registry
 */
export interface PackageInfo {
  name: string;
  version: string;
  description: string;
  author: string;
  date: string;
  keywords: string[];
  links: {
    npm?: string;
    homepage?: string;
    repository?: string;
    bugs?: string;
  };
  score: {
    final: number;
    detail: {
      quality: number;
      popularity: number;
      maintenance: number;
    };
  };
}

/**
 * Detailed package metadata from registry
 */
export interface PackageDetails {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  homepage: string;
  repository: string;
  dependencies: number;
  maintainers?: string;
  downloads?: string;
  source: 'local' | 'npm' | 'error';
}

/**
 * Search options for npm registry
 */
export interface SearchOptions {
  size?: number;
  popularity?: number;
  quality?: number;
  maintenance?: number;
}

/**
 * Service for interacting with the npm registry
 */
export class NpmRegistryService {
  private readonly baseUrl = 'https://registry.npmjs.org';
  private readonly searchUrl = 'https://registry.npmjs.org/-/v1/search';
  private readonly timeout = 10000; // 10 seconds

  /**
   * Search for packages in npm registry
   * 
   * @param query - Search query string
   * @param options - Search options (size, popularity, etc.)
   * @returns Array of matching packages
   * @throws {NpmRegistryError} When search fails
   */
  async searchPackages(
    query: string,
    options: SearchOptions = {}
  ): Promise<PackageInfo[]> {
    if (!query || query.trim().length === 0) {
      return [];
    }

    try {
      const response = await axios.get(this.searchUrl, {
        params: {
          text: query.trim(),
          size: options.size ?? 10,
          popularity: options.popularity ?? 1.0,
          quality: options.quality ?? 1.0,
          maintenance: options.maintenance ?? 1.0
        },
        timeout: this.timeout
      });

      return this.transformSearchResults(response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new NpmRegistryError(
          `Failed to search npm registry: ${error.message}`,
          query,
          error
        );
      }
      throw new NpmRegistryError(
        'Failed to search npm registry',
        query,
        error as Error
      );
    }
  }

  /**
   * Get detailed information about a specific package
   * 
   * @param packageName - Name of the package
   * @returns Package details
   * @throws {NpmRegistryError} When package fetch fails
   */
  async getPackageDetails(packageName: string): Promise<PackageDetails> {
    if (!packageName || packageName.trim().length === 0) {
      throw new NpmRegistryError('Package name is required');
    }

    try {
      const url = `${this.baseUrl}/${encodeURIComponent(packageName)}`;
      const response = await axios.get(url, {
        timeout: this.timeout
      });

      return this.transformPackageDetails(response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          throw new NpmRegistryError(
            `Package not found: ${packageName}`,
            packageName,
            error
          );
        }
        throw new NpmRegistryError(
          `Failed to fetch package details: ${error.message}`,
          packageName,
          error
        );
      }
      throw new NpmRegistryError(
        'Failed to fetch package details',
        packageName,
        error as Error
      );
    }
  }

  /**
   * Get the latest version of a package
   * 
   * @param packageName - Name of the package
   * @returns Latest version string
   * @throws {NpmRegistryError} When version fetch fails
   */
  async getLatestVersion(packageName: string): Promise<string> {
    const details = await this.getPackageDetails(packageName);
    return details.version;
  }

  /**
   * Check if a package exists in the registry
   * 
   * @param packageName - Name of the package
   * @returns True if package exists
   */
  async packageExists(packageName: string): Promise<boolean> {
    try {
      await this.getPackageDetails(packageName);
      return true;
    } catch (error) {
      if (error instanceof NpmRegistryError && error.message.includes('not found')) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Transform search results from npm registry API to our format
   */
  private transformSearchResults(data: unknown): PackageInfo[] {
    if (!data || typeof data !== 'object' || !('objects' in data)) {
      return [];
    }

    const typedData = data as { objects?: unknown[] };
    if (!typedData.objects || !Array.isArray(typedData.objects)) {
      return [];
    }

    return typedData.objects.map((item: unknown) => {
      const itemData = item as Record<string, unknown>;
      const pkg = (itemData.package || {}) as Record<string, unknown>;
      return {
        name: String(pkg.name ?? 'unknown'),
        version: String(pkg.version ?? '0.0.0'),
        description: String(pkg.description ?? ''),
        author: this.extractAuthor(pkg),
        date: String(pkg.date ?? ''),
        keywords: Array.isArray(pkg.keywords) ? pkg.keywords : [],
        links: (pkg.links || {}) as PackageInfo['links'],
        score: (itemData.score || {
          final: 0,
          detail: { quality: 0, popularity: 0, maintenance: 0 }
        }) as PackageInfo['score']
      };
    });
  }

  /**
   * Transform package details from npm registry API to our format
   */
  private transformPackageDetails(data: any): PackageDetails {
    const latestVersion = data['dist-tags']?.latest ?? '0.0.0';
    const versionData = data.versions?.[latestVersion] ?? data;

    return {
      name: data.name ?? 'unknown',
      version: latestVersion,
      description: versionData.description ?? 'No description available',
      author: this.extractAuthor(versionData),
      license: versionData.license ?? 'Unknown',
      homepage: versionData.homepage ?? data.homepage ?? '',
      repository: this.formatRepository(versionData.repository ?? data.repository),
      dependencies: Object.keys(versionData.dependencies ?? {}).length,
      maintainers: (data.maintainers ?? [])
        .map((m: any) => m.name ?? m.username)
        .filter(Boolean)
        .join(', '),
      downloads: 'Available on npm',
      source: 'npm'
    };
  }

  /**
   * Extract author information from package data
   */
  private extractAuthor(packageData: any): string {
    const author = packageData?.author ?? packageData?.publisher;
    
    if (!author) {
      const maintainers = packageData?.maintainers;
      if (maintainers && Array.isArray(maintainers) && maintainers.length > 0) {
        return maintainers[0].name ?? maintainers[0].username ?? 'Unknown';
      }
      return 'Unknown';
    }

    if (typeof author === 'string') {
      return author;
    }

    if (typeof author === 'object') {
      return author.name ?? author.username ?? 'Unknown';
    }

    return 'Unknown';
  }

  /**
   * Format repository information to a clean URL
   */
  private formatRepository(repo: any): string {
    if (!repo) {
      return '';
    }

    if (typeof repo === 'string') {
      return this.cleanRepositoryUrl(repo);
    }

    if (typeof repo === 'object' && repo.url) {
      return this.cleanRepositoryUrl(repo.url);
    }

    return '';
  }

  /**
   * Clean up git URLs to make them clickable
   */
  private cleanRepositoryUrl(url: string): string {
    let cleaned = url;
    
    // Remove git+ prefix
    if (cleaned.startsWith('git+')) {
      cleaned = cleaned.substring(4);
    }
    
    // Remove .git suffix
    if (cleaned.endsWith('.git')) {
      cleaned = cleaned.substring(0, cleaned.length - 4);
    }
    
    return cleaned;
  }
}

