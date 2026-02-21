# Package.json Manager

A comprehensive Visual Studio Code extension for managing and visualizing package.json files with a modern visual editor, smart dependency management, and interactive dependency graph.

## Features

### Visual Editor for package.json
- **Overview tab**: Edit all package.json fields with a grouped, form-based UI (Identity, People & Links, Entry Points, Engines, Publish & Files)
- Tag-style management for `keywords` and `files` arrays
- Custom field adder for arbitrary fields
- Read-only JSON display for complex nested objects (exports, workspaces, overrides, etc.)

### Smart Dependency Management
- **Local search**: Filter installed dependencies instantly
- **npm registry search**: Toggle "+ npm" to search the registry, sorted by popularity
- "Installed" badge on existing packages, 2+ character search guard
- Add, remove, and move dependencies between `dependencies` and `devDependencies`
- View detailed package information from npm

### Interactive Dependency Graph
- D3.js force-directed graph visualization
- Zoom controls (in/out/reset), hover tooltips, search highlighting
- Filter by dependency type, dynamic legend, stats bar
- Configurable max depth (1-10 levels)

### Script Management
- Inline editing with Save/Cancel buttons and keyboard shortcuts (Enter/Escape)
- Execute scripts directly in the integrated terminal
- Add and remove scripts

## Usage

### Opening the Visual Editor
1. Open any `package.json` file in VS Code -- it opens in the visual editor by default
2. Or use the Command Palette (`Ctrl+Shift+P`) and search for "Open in Package.json Manager"

### Toolbar Icons
The editor title bar shows icons for:
- **Toggle View**: Switch between visual editor and text editor
- **Dependency Graph**: Open the interactive dependency graph

### Viewing Dependency Graph
1. Click the graph icon in the editor title bar, or
2. Use the Command Palette and search for "Show Dependency Graph"

## Requirements
- Visual Studio Code ^1.75.0
- Node.js 20+ (for native fetch support)

## Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `packageJsonManager.enableAutomaticVisualEditing` | `false` | Automatically open package.json files in visual editor mode |
| `packageJsonManager.showDependencyGraphButton` | `true` | Show dependency graph button in editor title bar |
| `packageJsonManager.maxDependencyDepth` | `3` | Maximum depth for dependency graph generation (1-10) |
| `packageJsonManager.defaultViewMode` | `visual` | Default view mode: `visual` or `text` |

Access settings: `File > Preferences > Settings` > search "Package.json Manager"

## Release Notes

### v2.1.0 (2026-02-21)
Complete v2.0 rewrite with modern architecture and comprehensive features:
- 6-layer architecture (Extension > Commands > Panels > Services > Utilities > Config)
- Comprehensive package.json field coverage with grouped sections
- Smart dependency search UX (local filtering + npm registry toggle)
- Interactive D3.js dependency graph with zoom, tooltips, and search
- Inline script editing with keyboard shortcuts
- SVG toolbar icons (light/dark theme variants)
- Automated CI/CD release pipeline with conventional commit versioning
- Removed `axios` dependency (uses native `fetch`)
- Updated to TypeScript 5.3, ESLint 8, Node 20

### v1.0.3 (2025-10-26)
- Layered architecture refactor
- VS Code engine bump to ^1.75.0
- Custom editor as default for package.json

### v1.0.0 (2025-04-14)
- Initial release

## Development

### Setup
```bash
git clone https://github.com/icy-r/package-json-manager.git
cd package-json-manager
pnpm install
pnpm run watch
# Press F5 in VS Code to launch Extension Development Host
```

### Building
```bash
pnpm run compile        # Development build
pnpm run package        # Production build
pnpm dlx vsce package   # Create VSIX
```

### Testing
```bash
pnpm run lint           # Lint
pnpm run test-compile   # Compile tests
pnpm run test           # Run tests
```

### CI/CD & Releases

Releases are fully automated via GitHub Actions:

- **On PR merge to `main`**: The `release.yml` workflow auto-detects version bump from conventional commit messages:
  - `fix:` / `perf:` / `refactor:` → **patch** (e.g., 2.1.0 → 2.1.1)
  - `feat:` → **minor** (e.g., 2.1.0 → 2.2.0)
  - `feat!:` / `BREAKING CHANGE` → **major** (e.g., 2.1.0 → 3.0.0)
- Automatically bumps `package.json`, creates git tag, publishes to VS Marketplace, creates GitHub Release
- Manual dispatch available with explicit bump type override
- Fallback: manual `git tag v*` still triggers the CI pipeline

**Secrets required**: `VSCE_PAT` (VS Marketplace Personal Access Token)

## Contributing

Contributions are welcome! Please read:
- [CONTRIBUTING.md](CONTRIBUTING.md) - Development guidelines and workflow
- [ARCHITECTURE.md](ARCHITECTURE.md) - Technical architecture and design patterns

Use conventional commit messages (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).

## Contributors

Thanks to these contributors for their ideas and feedback:

- **[@maxoiduss](https://github.com/maxoiduss)** (Max) - Icon toolbar concept, configuration-aware editor switching ([PR #4](https://github.com/icy-r/package-json-manager/pull/4))
- **[@cyrus123456](https://github.com/cyrus123456)** (Cyrus) - Feature request for repository/homepage URL fields ([#1](https://github.com/icy-r/package-json-manager/issues/1))

## License

MIT
