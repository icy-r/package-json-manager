export class NpmRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NpmRegistryError';
  }
}

export class PackageJsonError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PackageJsonError';
  }
}

export class FileSystemError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FileSystemError';
  }
}
