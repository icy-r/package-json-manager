import { NpmRegistryError } from './errors';

const REGISTRY_BASE = 'https://registry.npmjs.org';
const SEARCH_ENDPOINT = `${REGISTRY_BASE}/-/v1/search`;
const TIMEOUT_MS = 10_000;

export interface NpmSearchResult {
  name: string;
  version: string;
  description: string;
  author?: { name: string };
  links?: { npm?: string; homepage?: string; repository?: string };
  score: number;
}

export interface NpmPackageDetails {
  name: string;
  version: string;
  description: string;
  author?: string | { name: string; email?: string };
  license?: string;
  homepage?: string;
  repository?: { type?: string; url?: string };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  source: 'local' | 'npm' | 'error';
}

export class NpmRegistryService {
  async searchPackages(query: string, size = 20): Promise<NpmSearchResult[]> {
    if (!query.trim() || query.trim().length < 2) {
      return [];
    }

    const url = `${SEARCH_ENDPOINT}?text=${encodeURIComponent(query)}&size=${size}`;
    const response = await this.fetchWithTimeout(url);

    if (!response.ok) {
      throw new NpmRegistryError(`npm search failed: HTTP ${response.status}`);
    }

    const data = (await response.json()) as {
      objects: { package: NpmSearchResult; score: { final: number } }[];
    };
    return data.objects
      .map(o => ({ ...o.package, score: o.score.final }))
      .sort((a, b) => b.score - a.score);
  }

  async getPackageDetails(name: string): Promise<NpmPackageDetails> {
    const url = `${REGISTRY_BASE}/${encodeURIComponent(name)}/latest`;

    try {
      const response = await this.fetchWithTimeout(url);
      if (!response.ok) {
        throw new NpmRegistryError(`Failed to fetch package details: HTTP ${response.status}`);
      }

      const data = (await response.json()) as Record<string, unknown>;
      return {
        name: data.name as string,
        version: data.version as string,
        description: (data.description as string) ?? '',
        author: data.author as NpmPackageDetails['author'],
        license: data.license as string | undefined,
        homepage: data.homepage as string | undefined,
        repository: data.repository as NpmPackageDetails['repository'],
        dependencies: data.dependencies as Record<string, string> | undefined,
        devDependencies: data.devDependencies as Record<string, string> | undefined,
        source: 'npm'
      };
    } catch (err) {
      if (err instanceof NpmRegistryError) {
        throw err;
      }
      throw new NpmRegistryError(`Network error fetching ${name}: ${(err as Error).message}`);
    }
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      return await fetch(url, { signal: controller.signal });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new NpmRegistryError(`Request timed out after ${TIMEOUT_MS}ms`);
      }
      throw new NpmRegistryError(`Network error: ${(err as Error).message}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
