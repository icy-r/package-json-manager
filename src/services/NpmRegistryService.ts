import axios from 'axios';

/**
 * Raw npm registry API response types
 */
interface NpmRegistryPackageResponse {
  'dist-tags'?: {
    latest?: string;
    [key: string]: string | undefined;
  };
  versions?: {
    [version: string]: NpmPackageVersion;
  };
  time?: {
    [version: string]: string;
  };
  [key: string]: unknown;
}

interface NpmPackageVersion {
  name?: string;
  version?: string;
  description?: string;
  author?: string | { name?: string };
  keywords?: string[];
  homepage?: string;
  repository?: {
    type?: string;
    url?: string;
  };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  license?: string;
  [key: string]: unknown;
}

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
  private transformPackageDetails(data: NpmRegistryPackageResponse): PackageDetails {
    const latestVersion = data['dist-tags']?.latest ?? '0.0.0';
    const versionData = data.versions?.[latestVersion] ?? data;

    const license = versionData.license;
    const homepage = versionData.homepage ?? (data as any).homepage;
    const name = versionData.name ?? data.name;
    const description = versionData.description;

    return {
      name: typeof name === 'string' ? name : 'unknown',
      version: latestVersion,
      description: typeof description === 'string' ? description : 'No description available',
      author: this.extractAuthor(versionData) || 'Unknown',
      license: typeof license === 'string' ? license : (typeof license === 'object' && license !== null ? (license as any).type ?? 'Unknown' : 'Unknown'),
      homepage: typeof homepage === 'string' ? homepage : '',
      repository: this.formatRepository(versionData.repository ?? (data as any).repository) || '',
      dependencies: Object.keys(versionData.dependencies ?? {}).length,
      maintainers: (Array.isArray(data.maintainers) ? data.maintainers : [])
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
  private extractAuthor(packageData: NpmPackageVersion | NpmRegistryPackageResponse): string {
    const author = (packageData as Record<string, unknown>)?.author ?? (packageData as Record<string, unknown>)?.publisher;
    
    if (!author) {
      const maintainers = (packageData as Record<string, unknown>)?.maintainers;
      if (maintainers && Array.isArray(maintainers) && maintainers.length > 0) {
        const firstMaintainer = maintainers[0] as Record<string, unknown>;
        return String(firstMaintainer?.name ?? firstMaintainer?.username ?? 'Unknown');
      }
      return 'Unknown';
    }

    if (typeof author === 'string') {
      return author;
    }

    if (typeof author === 'object' && author !== null) {
      const authorObj = author as Record<string, unknown>;
      return String(authorObj.name ?? authorObj.username ?? 'Unknown');
    }

    return 'Unknown';
  }

  /**
   * Format repository information to a clean URL
   */
  private formatRepository(repo: unknown): string {
    if (!repo) {
      return '';
    }

    if (typeof repo === 'string') {
      return this.cleanRepositoryUrl(repo);
    }

    if (typeof repo === 'object' && repo !== null) {
      const repoUrl = (repo as Record<string, unknown>).url;
      if (typeof repoUrl === 'string') {
        return this.cleanRepositoryUrl(repoUrl);
      }
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

