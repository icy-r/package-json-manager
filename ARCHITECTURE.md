# Architecture Documentation

## Overview

Package.json Manager is a VS Code extension that provides a visual interface for managing and visualizing package.json files. The extension follows a layered architecture pattern with clear separation of concerns.

## Project Structure

```
src/
├── extension.ts              # Extension entry point and registration
├── commands/                 # Command handlers
│   ├── OpenEditorCommand.ts
│   ├── ToggleViewCommand.ts
│   └── ShowGraphCommand.ts
├── panels/                   # Webview panels and custom editors
│   ├── PackageJsonEditorProvider.ts
│   └── DependencyGraphPanel.ts
├── services/                 # Business logic layer
│   ├── NpmRegistryService.ts
│   ├── PackageJsonService.ts
│   ├── DependencyService.ts
│   └── FileSystemService.ts
├── utils/                    # Shared utilities
│   ├── webviewUtils.ts
│   └── HtmlTemplateBuilder.ts
├── config/                   # Configuration management
│   └── ConfigurationManager.ts
└── test/                     # Test files
    └── suite/
```

## Architecture Layers

### 1. Extension Layer (`extension.ts`)

**Responsibilities:**
- Register commands, providers, and services
- Set up dependency injection
- Minimal business logic
- Act as the composition root

**Key Points:**
- Keeps activation function under 50 lines
- Delegates all business logic to commands and services
- Manages extension lifecycle

### 2. Command Layer (`src/commands/`)

**Responsibilities:**
- Handle VS Code command execution
- Orchestrate service calls
- Manage user interactions
- Error handling and user feedback

**Commands:**
- `OpenEditorCommand`: Opens package.json in custom editor
- `ToggleViewCommand`: Switches between visual and text editor
- `ShowGraphCommand`: Displays dependency graph visualization

**Pattern:**
Each command is a class with an `execute()` method that:
1. Resolves necessary URIs/parameters
2. Calls appropriate services
3. Handles errors with user-friendly messages

### 3. Service Layer (`src/services/`)

**Responsibilities:**
- Business logic implementation
- External API interactions
- Data transformation
- No direct VS Code UI interactions

**Services:**

#### NpmRegistryService
- Interacts with npm registry API
- Searches for packages
- Fetches package details
- Handles rate limiting and errors

#### PackageJsonService
- Reads and parses package.json files
- Updates package.json with proper formatting
- Manages dependencies and scripts
- Validates package.json structure

#### DependencyService
- Generates dependency graph data
- Analyzes node_modules structure
- Detects circular dependencies
- Filters and transforms graph data

#### FileSystemService
- Abstracts file system operations
- Provides async file I/O
- Handles errors consistently
- Enables testability through mocking

### 4. Panel Layer (`src/panels/`)

**Responsibilities:**
- Webview lifecycle management
- Message passing between webview and extension
- HTML generation (delegates to template builders)
- State synchronization

**Panels:**

#### PackageJsonEditorProvider
- Custom text editor for package.json files
- Provides visual editing interface
- Syncs changes between visual and text views
- ~180 lines (reduced from 334)

#### DependencyGraphPanel
- Displays interactive dependency graph
- Uses D3.js for visualization
- Fetches package details on demand
- ~220 lines (reduced from 528)

**Design Principles:**
- Keep panels under 200 lines
- Delegate HTML generation to `HtmlTemplateBuilder`
- Use services for all business logic
- Implement proper disposal patterns

### 5. Utility Layer (`src/utils/`)

**Responsibilities:**
- Pure functions and helpers
- No side effects
- Fully testable
- Reusable across the codebase

**Utilities:**

#### webviewUtils.ts
- Nonce generation for CSP
- Content Security Policy helpers
- Webview resource URI handling
- Message validation and routing
- Resource management

#### HtmlTemplateBuilder.ts
- Template-based HTML generation
- Component builders (buttons, tabs, forms)
- Pre-configured builders for specific views
- Consistent HTML structure

### 6. Configuration Layer (`src/config/`)

**Responsibilities:**
- Type-safe configuration access
- Configuration change listeners
- Validation

#### ConfigurationManager
- Provides type-safe access to extension settings
- Watches for configuration changes
- Validates configuration values
- Exposes convenience methods for common settings

## Data Flow

### Opening Package.json

```
User Action
    ↓
OpenEditorCommand.execute()
    ↓
VS Code API (vscode.openWith)
    ↓
PackageJsonEditorProvider.resolveCustomTextEditor()
    ↓
PackageJsonService.readPackageJson()
    ↓
HTML generated via HtmlTemplateBuilder
    ↓
Webview displayed to user
```

### Dependency Graph Generation

```
User Action
    ↓
ShowGraphCommand.execute()
    ↓
DependencyGraphPanel.createOrShow()
    ↓
DependencyService.generateDependencyGraph()
    ├→ FileSystemService.readJsonFile()
    └→ Recursive dependency analysis
    ↓
HTML generated with graph data
    ↓
D3.js renders interactive visualization
```

### npm Package Search

```
Webview: User types search query
    ↓
Message sent to extension
    ↓
WebviewMessageRouter.handle()
    ↓
NpmRegistryService.searchPackages()
    ↓
Results sent back to webview
    ↓
Webview displays results
```

## Dependency Injection

The extension uses constructor injection for all dependencies:

```typescript
class PackageJsonEditorProvider {
  private readonly npmService: NpmRegistryService;
  private readonly packageJsonService: PackageJsonService;

  constructor(context: vscode.ExtensionContext) {
    const fileSystem = new FileSystemService();
    this.npmService = new NpmRegistryService();
    this.packageJsonService = new PackageJsonService(fileSystem);
  }
}
```

Benefits:
- Testability: Easy to inject mocks
- Flexibility: Can swap implementations
- Clarity: Dependencies are explicit

## Error Handling Strategy

### Layered Error Handling

1. **Service Layer**: Throws typed errors
   ```typescript
   throw new NpmRegistryError('Package not found', packageName);
   ```

2. **Command Layer**: Catches, logs, and shows user feedback
   ```typescript
   catch (error) {
     vscode.window.showErrorMessage(`Failed: ${error.message}`);
     console.error('Command failed:', error);
   }
   ```

3. **Panel Layer**: Handles webview-specific errors
   ```typescript
   webview.postMessage({ command: 'error', message: error.message });
   ```

### Custom Error Types

- `NpmRegistryError`: npm API failures
- `PackageJsonError`: package.json operations
- `FileSystemError`: File I/O failures

## Security

### Content Security Policy

All webviews use strict CSP:
- `default-src 'none'`: Deny all by default
- `script-src 'nonce-${nonce}'`: Only scripts with nonce
- `style-src ${cspSource} 'unsafe-inline'`: Styles from extension
- No `'unsafe-eval'` or arbitrary script execution

### Message Validation

All messages from webview are validated:
```typescript
function isValidWebviewMessage(msg: unknown): msg is WebviewMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'command' in msg &&
    typeof (msg as any).command === 'string'
  );
}
```

### Path Validation

File paths are validated to prevent directory traversal:
```typescript
if (!fullPath.startsWith(workspaceRoot)) {
  throw new Error('Path outside workspace');
}
```

## Performance Considerations

1. **Lazy Loading**: Heavy dependencies loaded on demand
2. **Activation Events**: Extension activates only when needed
3. **Caching**: Expensive operations cached where appropriate
4. **Resource Disposal**: Proper cleanup prevents memory leaks
5. **Webview Context**: `retainContextWhenHidden` used sparingly

## Testing Strategy

### Unit Tests (70%)
- All service classes
- Utility functions
- Pure business logic

### Integration Tests (20%)
- Command execution
- Webview communication
- Panel lifecycle

### E2E Tests (10%)
- Full user workflows
- Extension activation
- Multi-file scenarios

## Configuration

Extension provides these settings:

- `packageJsonManager.enableAutomaticVisualEditing`: Auto-open in visual mode
- `packageJsonManager.showDependencyGraphButton`: Show/hide graph button
- `packageJsonManager.maxDependencyDepth`: Maximum graph depth (1-10)
- `packageJsonManager.defaultViewMode`: Default view mode (visual/text)

## Build and Deployment

### Build Process
1. TypeScript compilation
2. Webpack bundling
3. VSIX packaging
4. Marketplace publication

### CI/CD Pipeline
- **PR Validation**: Lint, test, build
- **Security Scan**: npm audit, CodeQL
- **Release**: Automated on tag push

## Future Improvements

### Planned Enhancements
1. **Testing**: Expand test coverage to 80%+
2. **Performance**: Bundle size optimization
3. **Features**: Package update notifications
4. **UX**: Improved error messages
5. **Analytics**: Usage telemetry

### Technical Debt
- Add comprehensive unit tests
- Implement e2e testing framework
- Add performance benchmarks
- Document webview JavaScript

## Contributing

When contributing, please:
1. Follow the established architecture
2. Add tests for new features
3. Update documentation
4. Run linting and formatting
5. Keep services under 300 lines
6. Keep panels under 200 lines

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Webview API](https://code.visualstudio.com/api/extension-guides/webview)
- [Custom Editors](https://code.visualstudio.com/api/extension-guides/custom-editors)
- [Testing Extensions](https://code.visualstudio.com/api/working-with-extensions/testing-extension)

