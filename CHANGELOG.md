# Changelog

All notable changes to this project will be documented in this file.

## [v1.0.3] - 2025-10-26

### Added
- Command activation events to ensure commands are available on startup
- Context-aware toggle behavior for switching between visual and text editors

### Changed
- **Breaking**: Updated minimum VS Code engine version from ^1.60.0 to ^1.75.0
- Changed custom editor priority from "option" to "default" - package.json files now open in visual editor by default
- Refactored extension architecture following layered design pattern:
  - Separated commands into dedicated command classes (`OpenEditorCommand`, `ToggleViewCommand`, `ShowGraphCommand`)
  - Created service layer for business logic (`NpmRegistryService`, `PackageJsonService`, `DependencyService`, `FileSystemService`)
  - Implemented configuration management with `ConfigurationManager`
  - Added utility modules for HTML template building and webview management
- Improved toggle command to work with the currently active editor instead of switching between different files

### Fixed
- Resolved "command not found" error when clicking buttons before extension fully loaded
- Fixed toggle button switching between different package.json files instead of toggling view mode
- Fixed toggle command now correctly identifies and switches the active editor's view mode
- Addressed VS Code info message about activation events (kept for packaging compatibility)

### Technical Improvements
- Implemented layered architecture with clear separation of concerns
- Added dependency injection patterns for better testability
- Improved error handling and type safety throughout codebase
- Enhanced webview message handling with router pattern
- Better resource management and disposal patterns
- Added comprehensive architecture documentation


All notable changes to this project will be documented in this file.

## [v1.0.2] - 2025-04-14

### Added
- [Add your new features here]

### Changed
- [Add your changes here]

### Fixed
- [Add your bug fixes here]


All notable changes to this project will be documented in this file.

## [v1.0.1] - 2025-04-14

### Added
little changes, do not ask

### Changed
- [Add your changes here]

### Fixed
- [Add your bug fixes here]


All notable changes to this project will be documented in this file.

## [v1.0.0] - 2025-04-14

### Added
- [Add your new features here]

### Changed
- [Add your changes here]

### Fixed
- [Add your bug fixes here]


All notable changes to this project will be documented in this file.

## [v0.1.0] - 2025-04-13

### Added
- Initial release of Package JSON Manager
- Visual editor for package.json files
- Dependency graph visualization with D3.js
- Interactive visualization with filtering and search capabilities
- Real-time dependency resolution from node_modules
- Package details panel with data from local files and npm registry
