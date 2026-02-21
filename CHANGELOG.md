# Changelog

All notable changes to this project will be documented in this file.

## [v2.1.0] - 2026-02-21

### Added
- Complete v2.0 ground-up rewrite with 6-layer architecture
- Comprehensive package.json field coverage: Identity, People & Links, Entry Points, Engines, Publish & Files sections
- Tag-style management for `keywords` and `files` arrays
- Custom field adder for arbitrary package.json fields
- Read-only JSON display for complex nested objects (peerDependencies, exports, workspaces, overrides, bin)
- Smart dependency search UX: local filtering by default, "+ npm" toggle for registry search
- npm search sorted by popularity with "installed" badge and 2+ character guard
- Inline script editing with Save/Cancel buttons and keyboard shortcuts (Enter/Escape)
- Interactive D3.js dependency graph with zoom controls, hover tooltips, search highlighting
- Dynamic legend and stats bar in dependency graph
- SVG toolbar icons for Toggle View and Dependency Graph commands (light/dark theme variants)
- Toast notifications for user feedback
- Loading spinners and empty states
- Custom error classes (NpmRegistryError, PackageJsonError, FileSystemError)
- Automated release workflow (`release.yml`) with conventional commit version detection
- Contributors field in package.json

### Changed
- Rewrote entire codebase following strict 6-layer architecture (Extension > Commands > Panels > Services > Utilities > Config)
- Removed `axios` dependency in favor of native `fetch` API
- Updated to TypeScript 5.3, ESLint 8, Node 20, ES2022 target
- Version bumped to 2.x
- Simplified CI/CD pipeline with automated release on merge to main
- Improved security scan workflow to prevent duplicate issue creation

### Fixed
- Graph panel workspace detection: robust fallback chain (active editor > open tabs > first workspace folder)
- HTML injection in dynamic field rendering (escaped key/label)
- Graph SVG preservation when showing no-modules message (overlay instead of innerHTML replacement)
- Dependency count pluralization when filtering
- PackageJsonService.parse preserves original JSON error context
- npm search HTTP 400 error for queries under 2 characters

### Contributors
- @maxoiduss (Max) - Icon toolbar concept, configuration-aware editor switching
- @cyrus123456 (Cyrus) - Feature request for repository/homepage URL fields

## [v1.0.3] - 2025-10-26

### Added
- Command activation events to ensure commands are available on startup
- Context-aware toggle behavior for switching between visual and text editors

### Changed
- Updated minimum VS Code engine version from ^1.60.0 to ^1.75.0
- Changed custom editor priority from "option" to "default"
- Refactored extension architecture following layered design pattern

### Fixed
- Resolved "command not found" error when clicking buttons before extension fully loaded
- Fixed toggle button switching between different package.json files
- Fixed toggle command correctly identifies active editor's view mode

## [v1.0.0] - 2025-04-14

### Added
- Initial release of Package.json Manager

## [v0.1.0] - 2025-04-13

### Added
- Initial release of Package JSON Manager
- Visual editor for package.json files
- Dependency graph visualization with D3.js
- Interactive visualization with filtering and search capabilities
- Real-time dependency resolution from node_modules
- Package details panel with data from local files and npm registry
