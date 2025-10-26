import * as vscode from 'vscode';
import {
  getWebviewResourceUri,
  getNonce,
  getWebviewContentSecurityPolicy,
  escapeJsonForHtml
} from './webviewUtils';

/**
 * Resource configuration for HTML templates
 */
export interface TemplateResources {
  /**
   * Extension path
   */
  extensionPath: string;
  /**
   * Webview instance
   */
  webview: vscode.Webview;
  /**
   * Script file paths (relative to extension root)
   */
  scripts: string[];
  /**
   * Style file paths (relative to extension root)
   */
  styles: string[];
  /**
   * Additional resource file paths
   */
  additionalResources?: Array<{ type: string; path: string }>;
}

/**
 * HTML template builder for creating consistent webview HTML
 */
export class HtmlTemplateBuilder {
  private nonce: string;
  private resources: TemplateResources;
  private title = 'Webview';
  private bodyContent = '';
  private inlineData: Record<string, any> = {};

  constructor(resources: TemplateResources) {
    this.resources = resources;
    this.nonce = getNonce();
  }

  /**
   * Set the page title
   */
  setTitle(title: string): this {
    this.title = title;
    return this;
  }

  /**
   * Set the body content HTML
   */
  setBody(content: string): this {
    this.bodyContent = content;
    return this;
  }

  /**
   * Add inline data to be available in the webview
   */
  addInlineData(key: string, data: any): this {
    this.inlineData[key] = data;
    return this;
  }

  /**
   * Build the complete HTML document
   */
  build(): string {
    const { webview, extensionPath } = this.resources;
    const csp = getWebviewContentSecurityPolicy(this.nonce, webview, {
      allowUnsafeEval: false
    });

    // Build script tags
    const scriptTags = this.resources.scripts
      .map(scriptPath => {
        const uri = getWebviewResourceUri(webview, extensionPath, ...scriptPath.split('/'));
        return `<script nonce="${this.nonce}" src="${uri}"></script>`;
      })
      .join('\n        ');

    // Build style tags
    const styleTags = this.resources.styles
      .map(stylePath => {
        const uri = getWebviewResourceUri(webview, extensionPath, ...stylePath.split('/'));
        return `<link href="${uri}" rel="stylesheet" />`;
      })
      .join('\n        ');

    // Build inline data script
    const inlineDataScript = Object.keys(this.inlineData).length > 0
      ? `<script nonce="${this.nonce}">
            ${Object.entries(this.inlineData)
              .map(([key, value]) => `const ${key} = ${escapeJsonForHtml(value)};`)
              .join('\n            ')}
        </script>`
      : '';

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="${csp}">
        ${styleTags}
        <title>${this.title}</title>
    </head>
    <body>
        ${this.bodyContent}
        ${inlineDataScript}
        ${scriptTags}
    </body>
    </html>`;
  }

  /**
   * Static helper to create a builder with common package.json editor resources
   */
  static forPackageJsonEditor(
    webview: vscode.Webview,
    extensionPath: string
  ): HtmlTemplateBuilder {
    return new HtmlTemplateBuilder({
      extensionPath,
      webview,
      scripts: ['media/packageJsonEditor.js'],
      styles: ['media/packageJsonEditor.css']
    });
  }

  /**
   * Static helper to create a builder with common dependency graph resources
   */
  static forDependencyGraph(
    webview: vscode.Webview,
    extensionPath: string
  ): HtmlTemplateBuilder {
    return new HtmlTemplateBuilder({
      extensionPath,
      webview,
      scripts: ['media/d3.min.js', 'media/dependencyGraph.js'],
      styles: ['media/dependencyGraph.css']
    });
  }
}

/**
 * Common HTML components builder
 */
export class HtmlComponentBuilder {
  /**
   * Build a header component
   */
  static buildHeader(title: string, actions?: string): string {
    return `
      <header class="header">
        <div class="header-title">
          <h1>${title}</h1>
        </div>
        ${actions ? `<div class="header-actions">${actions}</div>` : ''}
      </header>
    `;
  }

  /**
   * Build a button
   */
  static buildButton(
    id: string,
    text: string,
    className = 'btn-primary'
  ): string {
    return `<button id="${id}" class="${className}">${text}</button>`;
  }

  /**
   * Build a tabs navigation component
   */
  static buildTabs(tabs: Array<{ id: string; label: string; active?: boolean }>): string {
    return `
      <nav class="tabs">
        ${tabs.map(tab => `
          <button class="tab-btn${tab.active ? ' active' : ''}" data-tab="${tab.id}">
            ${tab.label}
          </button>
        `).join('')}
      </nav>
    `;
  }

  /**
   * Build a search bar component
   */
  static buildSearchBar(id: string, placeholder = 'Search...'): string {
    return `
      <div class="search-bar">
        <input type="text" id="${id}" placeholder="${placeholder}">
      </div>
    `;
  }

  /**
   * Build a modal overlay
   */
  static buildModal(id = 'modal-overlay'): string {
    return `
      <div id="${id}" class="modal-overlay hidden">
        <div class="modal">
          <div class="modal-header">
            <h2 id="modal-title">Modal Title</h2>
            <button id="modal-close" class="modal-close">&times;</button>
          </div>
          <div id="modal-content" class="modal-content">
            <!-- Modal content will be dynamically inserted here -->
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Build an empty state message
   */
  static buildEmptyState(message: string): string {
    return `<div class="empty-state">${message}</div>`;
  }

  /**
   * Build a form group
   */
  static buildFormGroup(
    label: string,
    inputId: string,
    inputType: 'text' | 'textarea' = 'text',
    placeholder = '',
    value = ''
  ): string {
    const inputHtml = inputType === 'textarea'
      ? `<textarea id="${inputId}" placeholder="${placeholder}">${value}</textarea>`
      : `<input type="text" id="${inputId}" placeholder="${placeholder}" value="${value}">`;

    return `
      <div class="form-group">
        <label for="${inputId}">${label}</label>
        ${inputHtml}
      </div>
    `;
  }

  /**
   * Build a loading indicator
   */
  static buildLoadingIndicator(message = 'Loading...'): string {
    return `
      <div class="loading-indicator">
        <div class="spinner"></div>
        <p>${message}</p>
      </div>
    `;
  }

  /**
   * Build an error message
   */
  static buildErrorMessage(message: string): string {
    return `
      <div class="error-message">
        <span class="error-icon">⚠️</span>
        <span class="error-text">${message}</span>
      </div>
    `;
  }

  /**
   * Build a success message
   */
  static buildSuccessMessage(message: string): string {
    return `
      <div class="success-message">
        <span class="success-icon">✓</span>
        <span class="success-text">${message}</span>
      </div>
    `;
  }
}

/**
 * Package.json editor specific template
 */
export class PackageJsonEditorTemplate {
  /**
   * Build the complete package.json editor body
   */
  static buildBody(): string {
    const header = HtmlComponentBuilder.buildHeader(
      'Package.json Manager',
      HtmlComponentBuilder.buildButton('btn-toggle-view', 'Switch to Text View')
    );

    const tabs = HtmlComponentBuilder.buildTabs([
      { id: 'package-info', label: 'Package Info', active: true },
      { id: 'dependencies', label: 'Dependencies' },
      { id: 'scripts', label: 'Scripts' }
    ]);

    const packageInfoTab = `
      <section id="package-info" class="tab-content active">
        ${HtmlComponentBuilder.buildFormGroup('Name', 'package-name', 'text', 'Package name')}
        ${HtmlComponentBuilder.buildFormGroup('Version', 'package-version', 'text', '1.0.0')}
        ${HtmlComponentBuilder.buildFormGroup('Description', 'package-description', 'textarea', 'Description of package')}
        ${HtmlComponentBuilder.buildFormGroup('Author', 'package-author', 'text', 'Author')}
        ${HtmlComponentBuilder.buildFormGroup('License', 'package-license', 'text', 'MIT')}
        ${HtmlComponentBuilder.buildFormGroup('Keywords (comma-separated)', 'package-keywords', 'text', 'keyword1, keyword2')}
      </section>
    `;

    const dependenciesTab = `
      <section id="dependencies" class="tab-content">
        <div class="dependencies-header">
          <div class="tabs">
            <button class="subtab-btn active" data-subtab="dependencies-prod">Dependencies</button>
            <button class="subtab-btn" data-subtab="dependencies-dev">Dev Dependencies</button>
          </div>
          <div class="actions">
            ${HtmlComponentBuilder.buildButton('btn-add-dependency', 'Add Dependency', 'btn-primary')}
            ${HtmlComponentBuilder.buildButton('btn-show-graph', 'View Dependency Graph', 'btn-secondary')}
          </div>
        </div>
        
        <div id="dependencies-prod" class="subtab-content active">
          ${HtmlComponentBuilder.buildSearchBar('search-dependencies', 'Search dependencies...')}
          <div id="dependencies-list" class="dependencies-list">
            ${HtmlComponentBuilder.buildEmptyState('No dependencies found.')}
          </div>
        </div>
        
        <div id="dependencies-dev" class="subtab-content">
          ${HtmlComponentBuilder.buildSearchBar('search-dev-dependencies', 'Search dev dependencies...')}
          <div id="dev-dependencies-list" class="dependencies-list">
            ${HtmlComponentBuilder.buildEmptyState('No dev dependencies found.')}
          </div>
        </div>
      </section>
    `;

    const scriptsTab = `
      <section id="scripts" class="tab-content">
        <div class="scripts-header">
          ${HtmlComponentBuilder.buildSearchBar('search-scripts', 'Search scripts...')}
          <div class="actions">
            ${HtmlComponentBuilder.buildButton('btn-add-script', 'Add Script', 'btn-primary')}
          </div>
        </div>
        
        <div id="scripts-list" class="scripts-list">
          ${HtmlComponentBuilder.buildEmptyState('No scripts found.')}
        </div>
      </section>
    `;

    const modal = HtmlComponentBuilder.buildModal();

    return `
      <div id="app">
        ${header}
        ${tabs}
        <main class="content-area">
          ${packageInfoTab}
          ${dependenciesTab}
          ${scriptsTab}
        </main>
        ${modal}
      </div>
    `;
  }
}

/**
 * Dependency graph specific template
 */
export class DependencyGraphTemplate {
  /**
   * Build the complete dependency graph body
   */
  static buildBody(): string {
    const header = HtmlComponentBuilder.buildHeader(
      'Dependency Graph Visualization',
      `
        ${HtmlComponentBuilder.buildButton('btn-refresh', 'Refresh')}
        <select id="dependency-type">
          <option value="all">All Dependencies</option>
          <option value="dependencies">Dependencies</option>
          <option value="devDependencies">Dev Dependencies</option>
        </select>
      `
    );

    const searchContainer = `
      <div class="search-container">
        <input type="text" id="search-input" placeholder="Search for a package...">
      </div>
    `;

    const graphContainer = `
      <main id="graph-container" class="graph-container">
        ${HtmlComponentBuilder.buildLoadingIndicator('Loading dependency graph...')}
      </main>
    `;

    const packageInfo = `
      <div id="package-info" class="package-info hidden">
        <div class="package-info-header">
          <h2 id="package-info-name">Package Name</h2>
          <button id="package-info-close">&times;</button>
        </div>
        <div id="package-info-content" class="package-info-content">
          <!-- Package details will be shown here -->
        </div>
      </div>
    `;

    return `
      ${header}
      ${searchContainer}
      ${graphContainer}
      ${packageInfo}
    `;
  }
}

