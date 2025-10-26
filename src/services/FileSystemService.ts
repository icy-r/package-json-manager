import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const statAsync = promisify(fs.stat);
const readdirAsync = promisify(fs.readdir);

/**
 * Error thrown when file system operations fail
 */
export class FileSystemError extends Error {
  constructor(
    message: string,
    public readonly filePath?: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'FileSystemError';
  }
}

/**
 * Service for abstracting file system operations
 * Provides error handling and testability
 */
export class FileSystemService {
  /**
   * Read a file as text
   * 
   * @param filePath - Path to the file
   * @param encoding - File encoding (default: 'utf8')
   * @returns File contents as string
   * @throws {FileSystemError} When read fails
   */
  async readFile(
    filePath: string,
    encoding: BufferEncoding = 'utf8'
  ): Promise<string> {
    try {
      const content = await readFileAsync(filePath, encoding);
      return content;
    } catch (error) {
      throw new FileSystemError(
        `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        filePath,
        error as Error
      );
    }
  }

  /**
   * Read and parse a JSON file
   * 
   * @param filePath - Path to the JSON file
   * @returns Parsed JSON object
   * @throws {FileSystemError} When read or parse fails
   */
  async readJsonFile<T = unknown>(filePath: string): Promise<T> {
    try {
      const content = await this.readFile(filePath);
      return JSON.parse(content) as T;
    } catch (error) {
      if (error instanceof FileSystemError) {
        throw error;
      }
      throw new FileSystemError(
        `Failed to parse JSON file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        filePath,
        error as Error
      );
    }
  }

  /**
   * Write content to a file
   * 
   * @param filePath - Path to the file
   * @param content - Content to write
   * @param encoding - File encoding (default: 'utf8')
   * @throws {FileSystemError} When write fails
   */
  async writeFile(
    filePath: string,
    content: string,
    encoding: BufferEncoding = 'utf8'
  ): Promise<void> {
    try {
      await writeFileAsync(filePath, content, encoding);
    } catch (error) {
      throw new FileSystemError(
        `Failed to write file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        filePath,
        error as Error
      );
    }
  }

  /**
   * Write an object to a JSON file
   * 
   * @param filePath - Path to the JSON file
   * @param data - Data to write
   * @param indent - Number of spaces for indentation (default: 2)
   * @throws {FileSystemError} When write fails
   */
  async writeJsonFile(
    filePath: string,
    data: unknown,
    indent = 2
  ): Promise<void> {
    try {
      const content = JSON.stringify(data, null, indent);
      await this.writeFile(filePath, content);
    } catch (error) {
      if (error instanceof FileSystemError) {
        throw error;
      }
      throw new FileSystemError(
        `Failed to write JSON file: ${error instanceof Error ? error.message : 'Unknown error'}`,
        filePath,
        error as Error
      );
    }
  }

  /**
   * Check if a file or directory exists
   * 
   * @param filePath - Path to check
   * @returns True if exists, false otherwise
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if a path is a directory
   * 
   * @param filePath - Path to check
   * @returns True if directory, false otherwise
   */
  async isDirectory(filePath: string): Promise<boolean> {
    try {
      const stats = await statAsync(filePath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Check if a path is a file
   * 
   * @param filePath - Path to check
   * @returns True if file, false otherwise
   */
  async isFile(filePath: string): Promise<boolean> {
    try {
      const stats = await statAsync(filePath);
      return stats.isFile();
    } catch {
      return false;
    }
  }

  /**
   * List files in a directory
   * 
   * @param dirPath - Directory path
   * @param recursive - Whether to list recursively
   * @returns Array of file paths
   * @throws {FileSystemError} When listing fails
   */
  async listFiles(
    dirPath: string,
    recursive = false
  ): Promise<string[]> {
    try {
      if (!(await this.isDirectory(dirPath))) {
        throw new Error('Path is not a directory');
      }

      const entries = await readdirAsync(dirPath);
      const files: string[] = [];

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry);
        const isDir = await this.isDirectory(fullPath);

        if (isDir && recursive) {
          const subFiles = await this.listFiles(fullPath, true);
          files.push(...subFiles);
        } else if (!isDir) {
          files.push(fullPath);
        }
      }

      return files;
    } catch (error) {
      throw new FileSystemError(
        `Failed to list files: ${error instanceof Error ? error.message : 'Unknown error'}`,
        dirPath,
        error as Error
      );
    }
  }

  /**
   * Get file size in bytes
   * 
   * @param filePath - Path to the file
   * @returns File size in bytes
   * @throws {FileSystemError} When stat fails
   */
  async getFileSize(filePath: string): Promise<number> {
    try {
      const stats = await statAsync(filePath);
      return stats.size;
    } catch (error) {
      throw new FileSystemError(
        `Failed to get file size: ${error instanceof Error ? error.message : 'Unknown error'}`,
        filePath,
        error as Error
      );
    }
  }

  /**
   * Find files matching a pattern in a directory
   * 
   * @param dirPath - Directory to search in
   * @param pattern - File name pattern (e.g., 'package.json')
   * @param maxDepth - Maximum directory depth to search
   * @returns Array of matching file paths
   */
  async findFiles(
    dirPath: string,
    pattern: string,
    maxDepth = 10
  ): Promise<string[]> {
    const results: string[] = [];

    async function search(currentPath: string, depth: number): Promise<void> {
      if (depth > maxDepth) {
        return;
      }

      try {
        const entries = await readdirAsync(currentPath);

        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry);
          
          try {
            const stats = await statAsync(fullPath);

            if (stats.isDirectory()) {
              // Skip node_modules and other common directories
              if (!['node_modules', '.git', 'dist', 'out'].includes(entry)) {
                await search(fullPath, depth + 1);
              }
            } else if (stats.isFile() && entry === pattern) {
              results.push(fullPath);
            }
          } catch {
            // Skip files that can't be accessed
            continue;
          }
        }
      } catch {
        // Skip directories that can't be read
        return;
      }
    }

    await search(dirPath, 0);
    return results;
  }

  /**
   * Ensure a directory exists, create if it doesn't
   * 
   * @param dirPath - Directory path
   * @throws {FileSystemError} When creation fails
   */
  async ensureDirectory(dirPath: string): Promise<void> {
    try {
      await fs.promises.mkdir(dirPath, { recursive: true });
    } catch (error) {
      throw new FileSystemError(
        `Failed to create directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
        dirPath,
        error as Error
      );
    }
  }

  /**
   * Get the directory name from a file path
   * 
   * @param filePath - File path
   * @returns Directory path
   */
  dirname(filePath: string): string {
    return path.dirname(filePath);
  }

  /**
   * Get the file name from a path
   * 
   * @param filePath - File path
   * @returns File name
   */
  basename(filePath: string): string {
    return path.basename(filePath);
  }

  /**
   * Join path segments
   * 
   * @param segments - Path segments
   * @returns Joined path
   */
  join(...segments: string[]): string {
    return path.join(...segments);
  }
}

