# Package.json Manager

A comprehensive Visual Studio Code extension for managing and visualizing package.json files.

## Features

### 1. Visual Editor for package.json files
- Edit package details (name, version, description, etc.) with a user-friendly interface
- Manage dependencies and dev dependencies visually
- Add, edit, and remove npm scripts

### 2. Dependency Management
- Search and install npm packages directly from the editor
- Update dependency versions easily
- View detailed package information
- Move between dependencies and dev dependencies with a single click

### 3. Dependency Visualization
- Interactive graph visualization of your project dependencies
- Filter by dependency type (regular or dev dependencies)
- Search for specific dependencies in the graph
- View detailed package information by clicking on a dependency node

### 4. Script Management
- Add, edit, and delete npm scripts
- Execute scripts directly from the interface
- Quick access to common scripts

## Usage

### Opening the Visual Editor
1. Open a package.json file in VS Code
2. Click on the "Open in Package.json Manager" button in the editor toolbar
3. Alternatively, right-click on a package.json file in the Explorer and select "Open in Package.json Manager"

### Viewing Dependency Graph
1. In the Package.json Manager, navigate to the "Dependencies" tab
2. Click the "View Dependency Graph" button
3. Alternatively, use the command palette (Ctrl+Shift+P) and search for "Show Dependency Graph"

### Managing Dependencies
1. Navigate to the "Dependencies" tab in the Package.json Manager
2. Click "Add Dependency" to search and install new packages
3. Use the filter controls to switch between regular and dev dependencies
4. Click the "Edit" button next to a dependency to update its version or change its type
5. Click the "Remove" button to delete a dependency

### Managing Scripts
1. Navigate to the "Scripts" tab in the Package.json Manager
2. Add, edit, or delete npm scripts using the provided controls
3. Click the "Run" button next to a script to execute it in the integrated terminal

## Requirements
- Visual Studio Code version 1.60.0 or higher
- Node.js and npm installed on your system

## Extension Settings
This extension contributes the following settings:
* `packageJsonManager.enableAutomaticVisualEditing`: Enable/disable automatic opening of package.json files in visual editor
* `packageJsonManager.showDependencyGraphButton`: Show/hide dependency graph button in editor title

## Known Issues
- Deep dependency resolution in the visualization graph is limited to direct dependencies

## Release Notes

### 1.0.0
Initial release of Package.json Manager

---

## Development

### Setup
1. Clone the repository
2. Run `npm install`
3. Run `npm run watch` for development
4. Press F5 to launch the extension in debug mode

### Building
Run `npm run package` to create a VSIX file for distribution

### Contributing
Contributions are welcome! Please feel free to submit a Pull Request.