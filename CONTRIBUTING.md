# Contributing to Package.json Manager

Thank you for your interest in contributing to the Package.json Manager extension! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Architecture](#architecture)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Release Process](#release-process)

## Code of Conduct

This project follows the standard open-source code of conduct. Be respectful, inclusive, and professional in all interactions.

## Getting Started

1. Fork the repository
2. Clone your fork
3. Create a feature branch
4. Make your changes
5. Submit a pull request

## Development Setup

### Prerequisites

- Node.js 20+
- pnpm (see `packageManager` field in package.json for exact version)
- Visual Studio Code ^1.75.0
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/icy-r/package-json-manager.git
cd package-json-manager

# Install dependencies
pnpm install

# Open in VS Code
code .
```

### Development Workflow

```bash
# Start watch mode for development
pnpm run watch

# In VS Code, press F5 to launch Extension Development Host

# Run tests
pnpm run test

# Lint code
pnpm run lint

# Format code
pnpm run format

# Build production bundle
pnpm run package
```

## Architecture

This extension follows a layered architecture. Please read [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed information.

### Key Principles

1. **Separation of Concerns**: Each layer has a specific responsibility
2. **Dependency Injection**: Use constructor injection for dependencies
3. **Type Safety**: Always use explicit types, avoid `any`
4. **Error Handling**: Use typed errors, handle gracefully
5. **Testing**: Write tests for new features

### File Size Guidelines

- **Services**: Keep under 300 lines
- **Panels**: Keep under 200 lines
- **Commands**: Keep under 100 lines
- **Utilities**: Keep focused and small

## Coding Standards

### TypeScript

- Use TypeScript strict mode
- Always specify return types
- Use interfaces for object shapes
- Use types for unions and utilities
- Avoid `any`, use `unknown` if type is truly unknown

### Naming Conventions

- **Files**: PascalCase for classes (`NpmRegistryService.ts`)
- **Variables**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- **Classes/Interfaces**: PascalCase
- **Private members**: prefix with underscore (optional)

### Code Style

We use ESLint and Prettier for consistent code style:

```bash
# Check formatting
pnpm run format:check

# Fix formatting
pnpm run format

# Lint
pnpm run lint

# Fix linting issues
pnpm run lint:fix
```

### Import Organization

Order imports as follows:

1. Node built-ins
2. External dependencies
3. VS Code APIs
4. Internal modules
5. Relative imports

```typescript
// 1. Node built-ins
import * as path from 'path';

// 2. External dependencies (if any)

// 3. VS Code APIs
import * as vscode from 'vscode';

// 4. Internal modules
import { NpmRegistryService } from './services/NpmRegistryService';

// 5. Relative imports
import { getNonce } from '../utils/webviewUtils';
```

### Documentation

- Add JSDoc comments for all public APIs
- Include parameter descriptions
- Include return type descriptions
- Include examples for complex functions

```typescript
/**
 * Search for packages in npm registry
 * 
 * @param query - Search query string
 * @param options - Search options including size and filters
 * @returns Array of matching packages
 * @throws {NpmRegistryError} When the registry is unreachable
 * 
 * @example
 * const results = await searchPackages('react', { size: 10 });
 */
async function searchPackages(
  query: string,
  options?: SearchOptions
): Promise<PackageInfo[]> {
  // implementation
}
```

## Testing

### Test Structure

```
src/test/
├── suite/
│   ├── extension.test.ts     # Extension activation tests
│   ├── commands/              # Command tests
│   ├── services/              # Service unit tests
│   └── utils/                 # Utility tests
├── fixtures/                  # Test data
└── mocks/                     # Mock objects
```

### Writing Tests

```typescript
import * as assert from 'assert';

suite('ServiceName', () => {
  let service: ServiceName;
  
  setup(() => {
    service = new ServiceName();
  });
  
  test('methodName should do something', async () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = await service.method(input);
    
    // Assert
    assert.strictEqual(result, expected);
  });
});
```

### Running Tests

```bash
# Run all tests
pnpm run test

# Compile tests only
pnpm run test-compile
```

### Coverage Requirements

- Minimum 80% statement coverage
- Minimum 75% branch coverage
- All new features must include tests

## Submitting Changes

### Before Submitting

1. Ensure all tests pass
2. Run linting and fix issues
3. Format code with Prettier
4. Update documentation if needed
5. Add tests for new features

### Pull Request Process

1. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Your Changes**
   - Follow coding standards
   - Add tests
   - Update documentation

3. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

   Use conventional commit format:
   - `feat:` New feature
   - `fix:` Bug fix
   - `docs:` Documentation changes
   - `refactor:` Code refactoring
   - `test:` Adding tests
   - `chore:` Maintenance tasks

4. **Push to Your Fork**
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Open Pull Request**
   - Provide clear description
   - Reference related issues
   - Include screenshots if UI changes
   - Wait for CI checks to pass

### Pull Request Review

- At least one maintainer must approve
- All CI checks must pass
- Code coverage must meet requirements
- No merge conflicts

## Release Process

Releases are **fully automated** via the `release.yml` GitHub Actions workflow:

1. Merge your PR to `main` using conventional commit messages
2. The workflow automatically:
   - Detects version bump type from commit messages (`fix:` → patch, `feat:` → minor, `feat!:` → major)
   - Bumps `package.json` version
   - Creates a git tag
   - Publishes to VS Code Marketplace
   - Creates a GitHub Release with VSIX attached

**Manual override**: Use the workflow dispatch to specify an explicit bump type.

**Fallback**: You can still manually tag (`git tag v2.2.0 && git push --tags`) to trigger the CI pipeline.

## Project Structure

```
package-json-manager/
├── .cursor/rules/       # Cursor AI rules
├── .github/workflows/   # CI/CD workflows
├── media/               # Extension media assets
├── src/
│   ├── commands/        # Command handlers
│   ├── config/          # Configuration management
│   ├── panels/          # Webview panels
│   ├── services/        # Business logic
│   ├── test/            # Tests
│   ├── utils/           # Utilities
│   └── extension.ts     # Entry point
├── .eslintrc.json       # ESLint configuration
├── .prettierrc.json     # Prettier configuration
├── tsconfig.json        # TypeScript configuration
├── webpack.config.js    # Webpack configuration
└── package.json         # Extension manifest
```

## Common Tasks

### Adding a New Service

1. Create file in `src/services/`
2. Define interface for the service
3. Implement the service class
4. Add error handling
5. Write unit tests
6. Update documentation

### Adding a New Command

1. Create file in `src/commands/`
2. Implement command class with `execute()` method
3. Register command in `extension.ts`
4. Add command to `package.json` contributes
5. Write tests
6. Update README

### Adding a Configuration Option

1. Add property to `package.json` configuration section
2. Add key to `ConfigurationKey` enum in `ConfigurationManager.ts`
3. Add convenience method to `ConfigurationManager`
4. Update documentation

## Getting Help

- **Issues**: [GitHub Issues](https://github.com/icy-r/package-json-manager/issues)
- **Discussions**: [GitHub Discussions](https://github.com/icy-r/package-json-manager/discussions)

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing! 🎉

