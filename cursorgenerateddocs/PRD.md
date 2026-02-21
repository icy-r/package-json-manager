# 📦 Package.json Manager — Product Requirements Document (PRD)

**Version:** 2.0 (Fresh Start)
**Date:** 2026-02-21
**Author:** icy-r
**Repository:** [icy-r/package-json-manager](https://github.com/icy-r/package-json-manager)

---

## 1. Project Overview

### 1.1 Summary

**Package.json Manager** is a Visual Studio Code extension that replaces the raw text editor experience for `package.json` files with a rich, interactive visual interface. It enables developers to manage npm packages, scripts, and project metadata through a GUI, and to visualize project dependency trees as interactive graphs — all without leaving VS Code.

### 1.2 Problem Statement

Editing `package.json` manually is error-prone, tedious, and opaque:
- Developers must remember JSON key names and valid structures.
- Adding/removing/updating dependencies requires manual version string edits.
- There is no built-in way to visualize how packages relate to each other in a project.
- Running scripts requires navigating to a terminal and remembering exact script names.

### 1.3 Vision

Provide VS Code users with a first-class, GUI-driven `package.json` management experience that is intuitive, safe, and production-ready — as a free, open-source extension published to the VS Code Marketplace.

---

## 2. Stakeholders

| Role | Description |
|------|-------------|
| Primary User | Node.js / JavaScript / TypeScript developers using VS Code |
| Extension Author | icy-r (publisher on VS Code Marketplace) |
| Open Source Contributors | Developers contributing via GitHub PRs |

---

## 3. Scope

### 3.1 In Scope (v1.x)

- Custom Visual Editor for `package.json` files (replaces default text editor)
- Visual Dependency Manager (add, edit, remove, move deps)
- npm Registry Integration (search + install packages)
- Interactive Dependency Graph Visualization
- Script Manager (add, edit, delete, run scripts)
- Extension Settings / Configuration
- CI/CD pipeline (GitHub Actions)
- VS Code Marketplace publication

### 3.2 Out of Scope (v1.x)

- Support for `yarn.lock` / `pnpm-lock.yaml` interpretation
- Monorepo / workspace-level package management
- Multi-package.json simultaneous editing
- Built-in npm audit / vulnerability scanner (beyond what npm provides)
- Usage analytics / telemetry

---

## 4. Functional Requirements

### 4.1 Extension Activation

| ID | Requirement |
|----|-------------|
| F-ACT-01 | The extension MUST activate when a `package.json` file is opened as a custom editor. |
| F-ACT-02 | The extension MUST activate on any of the three registered commands: `openPackageJsonEditor`, `toggleView`, `showDependencyGraph`. |
| F-ACT-03 | Activation MUST NOT happen unless a relevant trigger occurs (lazy loading). |

---

### 4.2 Custom Visual Editor

The visual editor replaces (or supplements) the default text view of `package.json`.

| ID | Requirement |
|----|-------------|
| F-VE-01 | When a `package.json` file is opened, the extension MUST show it in the visual editor by default (priority: `default`). |
| F-VE-02 | The visual editor MUST display the following fields as editable form controls: `name`, `version`, `description`, `author`, `license`, `keywords`, `homepage`, `main`. |
| F-VE-03 | The visual editor MUST have tabbed navigation with at minimum: **Overview**, **Dependencies**, **Scripts** tabs. |
| F-VE-04 | All changes made in the visual editor MUST be reflected in the underlying text document (with undo/redo support via VS Code's `WorkspaceEdit` API). |
| F-VE-05 | The visual editor MUST sync with the text document when the text document is modified externally. |
| F-VE-06 | The visual editor webview MUST load its initial data by requesting it after the webview JS is ready (avoid race conditions). |
| F-VE-07 | The extension MUST register a `CustomTextEditorProvider` under view type `packageJsonManager.packageJsonEditor`. |
| F-VE-08 | The editor title bar MUST show action buttons: "Toggle View" and "Show Dependency Graph" when a `package.json` file is active. |

---

### 4.3 Toggle View Command

| ID | Requirement |
|----|-------------|
| F-TV-01 | A command `packageJsonManager.toggleView` MUST be available from the Command Palette (when `package.json` is open). |
| F-TV-02 | If currently in visual mode, the toggle MUST switch to the default text editor. |
| F-TV-03 | If currently in text mode, the toggle MUST switch to the visual editor. |
| F-TV-04 | The toggle MUST operate on the **currently active** editor, not on a different package.json. |
| F-TV-05 | An editor title bar button MUST exist for the toggle action. |

---

### 4.4 Dependency Management

| ID | Requirement |
|----|-------------|
| F-DM-01 | The Dependencies tab MUST list all `dependencies` and `devDependencies` from the current `package.json`. |
| F-DM-02 | Each listed dependency MUST display: package name, version string, dependency type (`dep` / `devDep`). |
| F-DM-03 | The user MUST be able to **remove** a dependency with a single click ("Remove" button per row). |
| F-DM-04 | The user MUST be able to **edit** a dependency's version inline. |
| F-DM-05 | The user MUST be able to **move** a dependency between `dependencies` and `devDependencies`. |
| F-DM-06 | The user MUST be able to **add** a new dependency by searching npm (see Section 4.5). |
| F-DM-07 | All dependency changes MUST persist to the `package.json` file via VS Code's document edit API. |
| F-DM-08 | The UI MUST support filtering the list by dependency type (all / regular / dev). |

---

### 4.5 npm Registry Integration

| ID | Requirement |
|----|-------------|
| F-NPM-01 | An "Add Dependency" search bar MUST query the npm registry at `https://registry.npmjs.org/-/v1/search`. |
| F-NPM-02 | Search results MUST display: package name, version, description, author. |
| F-NPM-03 | The user MUST be able to select a search result and add it as a `dependency` or `devDependency`. |
| F-NPM-04 | Clicking a package in the graph or list MUST open a detail panel showing: name, version, description, author, license, homepage, repository, dependency count. |
| F-NPM-05 | All npm API calls MUST have a timeout of 10 seconds and handle errors gracefully. |
| F-NPM-06 | Rate limiting and network errors MUST be handled and reported to the user with descriptive messages. |
| F-NPM-07 | Package details MUST indicate their data `source` as `local` (from node_modules), `npm` (from registry), or `error`. |

---

### 4.6 Dependency Graph Visualization

| ID | Requirement |
|----|-------------|
| F-DG-01 | A command `packageJsonManager.showDependencyGraph` MUST display an interactive dependency graph in a side panel. |
| F-DG-02 | The graph MUST be rendered using **D3.js** as a force-directed graph. |
| F-DG-03 | Graph nodes MUST visually distinguish: `root`, `dependency`, `devDependency`, `nestedDependency`, `peerDependency`. |
| F-DG-04 | Graph edges MUST represent dependency relationships with directional links. |
| F-DG-05 | The graph MUST be generated from the local `node_modules` directory (not the registry). |
| F-DG-06 | If `node_modules` does not exist, the graph MUST show only the root node and a user-friendly message. |
| F-DG-07 | The graph MUST support configurable depth (controlled by `packageJsonManager.maxDependencyDepth` setting, range: 1–10, default: 3). |
| F-DG-08 | The graph MUST support filtering by dependency type (regular / dev). |
| F-DG-09 | The graph MUST support text search to highlight specific dependency nodes. |
| F-DG-10 | Clicking a node in the graph MUST display the package details panel (see F-NPM-04). |
| F-DG-11 | The graph panel MUST open in a `ViewColumn.Beside` split. |
| F-DG-12 | The graph panel MUST refresh when the panel regains visibility. |
| F-DG-13 | The graph MUST detect and gracefully handle circular dependencies. |

---

### 4.7 Script Manager

| ID | Requirement |
|----|-------------|
| F-SM-01 | The Scripts tab MUST list all scripts defined in the `package.json`. |
| F-SM-02 | The user MUST be able to **add** a new npm script (provide name + command). |
| F-SM-03 | The user MUST be able to **edit** an existing script (name and/or command). |
| F-SM-04 | The user MUST be able to **delete** a script. |
| F-SM-05 | Each script MUST have a **Run** button that executes the script in VS Code's integrated terminal. |
| F-SM-06 | Script changes MUST persist to the `package.json` file. |

---

### 4.8 Extension Commands

| Command ID | Title | Trigger |
|------------|-------|---------|
| `packageJsonManager.openPackageJsonEditor` | Open in Package.json Manager | Command Palette, Explorer context menu |
| `packageJsonManager.toggleView` | Toggle between visual editor and text editor | Command Palette, Editor title bar |
| `packageJsonManager.showDependencyGraph` | Show Dependency Graph | Command Palette, Editor title bar |

All commands MUST be scoped (`when: resourceFilename == 'package.json'`) to only appear in context when relevant.

---

### 4.9 Configuration Settings

| Setting Key | Type | Default | Description |
|-------------|------|---------|-------------|
| `packageJsonManager.enableAutomaticVisualEditing` | `boolean` | `false` | Auto-open `package.json` in visual mode |
| `packageJsonManager.showDependencyGraphButton` | `boolean` | `true` | Show graph button in editor title bar |
| `packageJsonManager.maxDependencyDepth` | `number` (1–10) | `3` | Maximum depth for dependency graph |
| `packageJsonManager.defaultViewMode` | `"visual"` \| `"text"` | `"visual"` | Default view mode for `package.json` files |

---

## 5. Non-Functional Requirements

### 5.1 Performance

| ID | Requirement |
|----|-------------|
| NF-P-01 | Extension activation time MUST be under 500ms. |
| NF-P-02 | The visual editor MUST render within 300ms after opening a `package.json`. |
| NF-P-03 | Dependency graph generation MUST complete within 5 seconds for projects with up to 200 dependencies. |
| NF-P-04 | npm registry search results MUST be displayed within 2 seconds under normal network conditions. |
| NF-P-05 | Heavy dependencies (e.g., D3.js) MUST be lazy-loaded or bundled only into the webview. |
| NF-P-06 | `retainContextWhenHidden` MUST be used sparingly to avoid excessive memory usage. |

### 5.2 Security

| ID | Requirement |
|----|-------------|
| NF-S-01 | All webviews MUST use a strict Content Security Policy (CSP): `default-src 'none'`, scripts only with nonce. |
| NF-S-02 | No `unsafe-eval` MUST be used in any webview. |
| NF-S-03 | All messages received from the webview MUST be validated before processing. |
| NF-S-04 | File paths resolved from webview messages MUST be validated against workspace root to prevent directory traversal. |
| NF-S-05 | npm dependency overrides for known vulnerabilities MUST be maintained in `pnpm.overrides`. |

### 5.3 Reliability & Error Handling

| ID | Requirement |
|----|-------------|
| NF-R-01 | Service layer errors MUST use typed custom error classes: `NpmRegistryError`, `PackageJsonError`, `FileSystemError`. |
| NF-R-02 | All user-facing errors MUST be shown via `vscode.window.showErrorMessage` with a descriptive message. |
| NF-R-03 | Webview-level errors MUST be communicated back to the webview via `postMessage`. |
| NF-R-04 | All unhandled promise rejections in command handlers MUST be caught and logged. |

### 5.4 Compatibility

| ID | Requirement |
|----|-------------|
| NF-C-01 | The extension MUST support VS Code version **≥ 1.75.0**. |
| NF-C-02 | The extension MUST work on Windows, macOS, and Linux. |
| NF-C-03 | Node.js and npm MUST be installed on the user's system for script execution and graph generation. |

### 5.5 Maintainability

| ID | Requirement |
|----|-------------|
| NF-M-01 | All source code MUST be **TypeScript** with strict mode enabled. |
| NF-M-02 | ESLint and Prettier MUST be configured and enforced on all source files. |
| NF-M-03 | Service classes MUST NOT exceed **300 lines**. |
| NF-M-04 | Panel classes MUST NOT exceed **200 lines**. |
| NF-M-05 | The extension entry point (`extension.ts`) MUST be under **50 lines** (composition root only). |
| NF-M-06 | All services MUST use constructor injection for dependencies. |

---

## 6. Architecture Requirements

### 6.1 Layer Structure

The extension MUST follow a strict 6-layer architecture:

```
Extension Layer (extension.ts)         ← Composition root only
    ↓
Command Layer (src/commands/)          ← Command execution, user interactions
    ↓
Panel Layer (src/panels/)              ← Webview lifecycle, message routing
    ↓
Service Layer (src/services/)          ← All business logic, no UI
    ↓
Utility Layer (src/utils/)             ← Pure, side-effect-free helpers
    ↓
Config Layer (src/config/)             ← Type-safe settings access
```

### 6.2 Required Modules

| Module | File | Responsibility |
|--------|------|---------------|
| Extension Entry | `src/extension.ts` | Register commands and providers |
| Open Editor Command | `src/commands/OpenEditorCommand.ts` | Open custom editor |
| Toggle View Command | `src/commands/ToggleViewCommand.ts` | Switch between views |
| Show Graph Command | `src/commands/ShowGraphCommand.ts` | Open dependency graph |
| Editor Provider | `src/panels/PackageJsonEditorProvider.ts` | Custom text editor provider |
| Graph Panel | `src/panels/DependencyGraphPanel.ts` | D3.js dependency graph panel |
| npm Service | `src/services/NpmRegistryService.ts` | npm registry API calls |
| Package.json Service | `src/services/PackageJsonService.ts` | Read/write/validate package.json |
| Dependency Service | `src/services/DependencyService.ts` | Graph data generation |
| File System Service | `src/services/FileSystemService.ts` | Async file I/O abstraction |
| Webview Utils | `src/utils/webviewUtils.ts` | CSP, nonce, message routing |
| HTML Template Builder | `src/utils/HtmlTemplateBuilder.ts` | Reusable HTML component builder |
| Config Manager | `src/config/ConfigurationManager.ts` | Type-safe settings access |

### 6.3 Data Flow (Key Flows)

**Opening Package.json:**
```
User Action → OpenEditorCommand → vscode.openWith → PackageJsonEditorProvider
→ PackageJsonService.readPackageJson() → HtmlTemplateBuilder → Webview
```

**Saving Changes:**
```
Webview postMessage → WebviewMessageRouter → PackageJsonService.updateDocument()
→ WorkspaceEdit → VS Code document (undo/redo safe)
```

**Dependency Graph:**
```
ShowGraphCommand → DependencyGraphPanel.createOrShow()
→ DependencyService.generateDependencyGraph()
→ FileSystemService reads node_modules → D3.js renders graph
```

**npm Search:**
```
Webview search input → postMessage → WebviewMessageRouter
→ NpmRegistryService.searchPackages() → Results posted back → Webview renders
```

---

## 7. Testing Requirements

### 7.1 Test Coverage Targets

| Test Type | Target Coverage | Scope |
|-----------|----------------|-------|
| Unit Tests | 70% | All service classes, utility functions, config manager |
| Integration Tests | 20% | Command execution, webview communication, panel lifecycle |
| End-to-End Tests | 10% | Full user workflows, extension activation, multi-file |

### 7.2 Test Framework

- **Framework:** Mocha + `@vscode/test-electron`
- **Test runner:** `node ./out/test/runTest.js`
- **Test location:** `src/test/suite/`

### 7.3 Test Requirements

| ID | Requirement |
|----|-------------|
| T-01 | Unit tests MUST cover all public methods of `NpmRegistryService`, `PackageJsonService`, `DependencyService`, and `FileSystemService`. |
| T-02 | Unit tests MUST mock external dependencies (filesystem, HTTP). |
| T-03 | Integration tests MUST verify that commands correctly wire services and produce side effects. |
| T-04 | E2E tests MUST verify extension activation and basic editor open workflow. |
| T-05 | CI MUST fail if any test fails. |

---

## 8. Build & Toolchain Requirements

### 8.1 Build Tools

| Tool | Purpose | Version |
|------|---------|---------|
| TypeScript | Source language | `^4.4.3` |
| Webpack | Bundler | `^5.52.1` |
| pnpm | Package manager | `9.15.4` |
| vsce | Extension packaging | `^2.15.0` |
| ESLint | Linting | `^7.32.0` |
| Prettier | Formatting | (configured via `.prettierrc.json`) |

### 8.2 Build Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `compile` | `webpack` | Development build |
| `watch` | `webpack --watch` | Watch mode for dev |
| `package` | `webpack --mode production --devtool hidden-source-map` | Production build |
| `test` | `node ./out/test/runTest.js` | Run tests |
| `lint` | `eslint src --ext ts` | Lint check |
| `lint:fix` | `eslint src --ext ts --fix` | Auto-fix lint |
| `format` | `prettier --write "src/**/*.{ts,js,json,md}"` | Format code |
| `package-extension` | `vsce package` | Create `.vsix` |

### 8.3 Output

- Compiled bundle: `./dist/extension.js`
- Webview assets: `./media/` (JS, CSS for editor and graph)
- Packaged extension: `.vsix` file

---

## 9. CI/CD Requirements

### 9.1 GitHub Actions Workflows

| Trigger | Pipeline Steps |
|---------|----------------|
| Pull Request | Lint → Test → Build |
| Push to `main` | Lint → Test → Build → Upload artifact |
| Tag push (`v*`) | Lint → Test → Build → Create GitHub Release → Publish to Marketplace |

### 9.2 Security Scans

- `npm audit` MUST run on every build.
- CodeQL static analysis SHOULD run on PRs.

### 9.3 Release Process

1. Run `./scripts/release.sh [patch|minor|major]`
2. Update `CHANGELOG.md`
3. Push changes + tag to `main`
4. GitHub Actions automatically builds, releases, and publishes

**Requires:** `VSCE_PAT` secret with Marketplace publish permissions set in repository secrets.

---

## 10. Extension Manifest Requirements

The `package.json` manifest MUST declare:

- `"engines": { "vscode": "^1.75.0" }`
- `"activationEvents"` for all 3 commands and the custom editor
- `"customEditors"` for `packageJsonManager.packageJsonEditor` with `filenamePattern: "**/package.json"` and `priority: "default"`
- `"commands"` for all 3 commands
- `"menus"` for `commandPalette` and `editor/title` with `when` guards
- `"configuration"` section for all 4 settings
- `"categories"`: `["Other", "Formatters", "Visualization"]`

---

## 11. UI/UX Requirements

| ID | Requirement |
|----|-------------|
| UX-01 | The visual editor MUST use VS Code's native theming (CSS variables) for light/dark mode support. |
| UX-02 | All buttons and controls MUST follow VS Code's design language (avoid custom styled frames that clash with the IDE). |
| UX-03 | Loading states MUST be shown when performing async operations (e.g., npm search). |
| UX-04 | Empty states MUST be shown when no dependencies or scripts exist. |
| UX-05 | Error states in the graph or editor MUST show a clear error message (not a blank panel). |
| UX-06 | The extension icon (`media/icon.png`) MUST be provided and referenced in the manifest. |
| UX-07 | The Marketplace gallery banner MUST use color `#C80000` with dark theme. |

---

## 12. Known Limitations (Accepted for v1.x)

| # | Limitation |
|---|------------|
| 1 | Deep dependency graph resolution only follows direct node_modules (not transitive registry fetching). |
| 2 | Peer dependencies are not included in the graph by default (opt-in via `includePeer` option). |
| 3 | `pnpm` and `yarn` workspace protocols are not specially handled. |
| 4 | No built-in vulnerability scanner beyond npm audit. |

---

## 13. Future Enhancements (Post v1.x Backlog)

| Priority | Feature |
|----------|---------|
| High | Expand test coverage to 80%+ |
| High | Bundle size optimization (analyze and reduce webpack output) |
| Medium | Package update notifications (outdated package detection) |
| Medium | Improved UX for error messages |
| Medium | Peer dependency graph support |
| Low | Usage telemetry / analytics (opt-in) |
| Low | E2E test framework (Playwright or similar) |
| Low | Performance benchmarks for graph generation |
| Low | Document all webview JavaScript with JSDoc |

---

## 14. Glossary

| Term | Definition |
|------|------------|
| Custom Editor | A VS Code webview-based editor registered via `CustomTextEditorProvider` |
| Webview | An embedded browser context inside VS Code used to render HTML/JS UI |
| CSP | Content Security Policy — controls what resources webviews can load |
| Nonce | A cryptographic random token used to allow specific inline scripts in CSP |
| D3.js | A JavaScript library for data-driven DOM manipulation, used for graph rendering |
| vsce | VS Code Extension CLI tool for packaging and publishing extensions |
| node_modules | Local directory where npm/pnpm installs project dependencies |
| devDependencies | Packages only needed during development (not included in production) |

---

*This document was generated by analyzing the full source code, architecture documentation, README, CHANGELOG, and manifest of [icy-r/package-json-manager](https://github.com/icy-r/package-json-manager) as of 2026-02-21.*