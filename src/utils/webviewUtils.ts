import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Utility function to get URI for a resource in webview
 * @param webview The webview to get the URI for
 * @param extensionPath The path to the extension directory
 * @param pathList The path components of the resource
 * @returns A URI that can be used in a webview
 */
export function getWebviewResourceUri(
  webview: vscode.Webview,
  extensionPath: string,
  ...pathList: string[]
): vscode.Uri {
  return webview.asWebviewUri(
    vscode.Uri.file(path.join(extensionPath, ...pathList))
  );
}

/**
 * Gets a cryptographically random nonce for webview resources
 * This should be used for all inline scripts to comply with CSP
 * @returns A random nonce string (32 characters)
 */
export function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/**
 * Configuration options for Content Security Policy
 */
export interface CSPOptions {
  /**
   * Allow unsafe-eval for scripts (not recommended)
   */
  allowUnsafeEval?: boolean;
  /**
   * Additional script sources
   */
  additionalScriptSrc?: string[];
  /**
   * Additional style sources
   */
  additionalStyleSrc?: string[];
  /**
   * Additional image sources
   */
  additionalImgSrc?: string[];
}

/**
 * Gets a strict Content Security Policy for a webview
 * 
 * @param nonce - The nonce to use in the CSP
 * @param webview - The webview to get the CSP source for
 * @param options - Additional CSP configuration options
 * @returns A CSP string ready for use in a meta tag
 */
export function getWebviewContentSecurityPolicy(
  nonce: string,
  webview: vscode.Webview,
  options: CSPOptions = {}
): string {
  const scriptSrc = [
    `'nonce-${nonce}'`,
    ...(options.additionalScriptSrc ?? [])
  ];
  
  if (options.allowUnsafeEval) {
    scriptSrc.push("'unsafe-eval'");
  }
  
  const styleSrc = [
    webview.cspSource,
    "'unsafe-inline'", // Required for VS Code theme colors
    ...(options.additionalStyleSrc ?? [])
  ];
  
  const imgSrc = [
    webview.cspSource,
    'https:',
    ...(options.additionalImgSrc ?? [])
  ];
  
  return [
    "default-src 'none'",
    `img-src ${imgSrc.join(' ')}`,
    `script-src ${scriptSrc.join(' ')}`,
    `style-src ${styleSrc.join(' ')}`,
    `font-src ${webview.cspSource}`
  ].join('; ');
}

/**
 * Escapes JSON data for safe inclusion in HTML script tags
 * This prevents XSS attacks when embedding data in HTML
 * 
 * @param data - Data to escape
 * @returns Escaped JSON string safe for HTML
 */
export function escapeJsonForHtml(data: any): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

/**
 * WebviewMessage type for type-safe messaging
 */
export interface WebviewMessage {
  command: string;
  [key: string]: any;
}

/**
 * Validates that a message from webview has the correct structure
 * 
 * @param msg - Message to validate
 * @returns True if valid WebviewMessage
 */
export function isValidWebviewMessage(msg: unknown): msg is WebviewMessage {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'command' in msg &&
    typeof (msg as any).command === 'string'
  );
}

/**
 * Options for creating webview panels
 */
export interface WebviewPanelOptions {
  /**
   * Title of the webview panel
   */
  title: string;
  /**
   * View type identifier
   */
  viewType: string;
  /**
   * Column to show the panel in
   */
  column?: vscode.ViewColumn;
  /**
   * Paths to allow as local resource roots
   */
  localResourceRoots: string[];
  /**
   * Extension path
   */
  extensionPath: string;
  /**
   * Whether to retain context when hidden
   */
  retainContextWhenHidden?: boolean;
}

/**
 * Create a webview panel with standard configuration
 * 
 * @param options - Panel configuration options
 * @returns Configured webview panel
 */
export function createWebviewPanel(
  options: WebviewPanelOptions
): vscode.WebviewPanel {
  const {
    title,
    viewType,
    column = vscode.ViewColumn.One,
    localResourceRoots,
    extensionPath,
    retainContextWhenHidden = false
  } = options;
  
  const panel = vscode.window.createWebviewPanel(
    viewType,
    title,
    column,
    {
      enableScripts: true,
      retainContextWhenHidden,
      localResourceRoots: localResourceRoots.map(root =>
        vscode.Uri.file(path.join(extensionPath, root))
      )
    }
  );
  
  return panel;
}

/**
 * Disposable resource manager for webviews
 */
export class WebviewResourceManager implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  
  /**
   * Add a disposable resource
   */
  add(disposable: vscode.Disposable): void {
    this.disposables.push(disposable);
  }
  
  /**
   * Register a callback for panel disposal
   */
  onDispose(callback: () => void): void {
    this.disposables.push({
      dispose: callback
    });
  }
  
  /**
   * Dispose all registered resources
   */
  dispose(): void {
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        try {
          disposable.dispose();
        } catch (error) {
          console.error('Error disposing resource:', error);
        }
      }
    }
  }
}

/**
 * Message handler type
 */
export type MessageHandler<T = any> = (message: T) => void | Promise<void>;

/**
 * Type-safe message router for webview communications
 */
export class WebviewMessageRouter {
  private readonly handlers = new Map<string, MessageHandler>();
  
  /**
   * Register a handler for a specific command
   */
  on(command: string, handler: MessageHandler): void {
    this.handlers.set(command, handler);
  }
  
  /**
   * Handle an incoming message
   */
  async handle(message: unknown): Promise<void> {
    if (!isValidWebviewMessage(message)) {
      console.error('Invalid webview message:', message);
      return;
    }
    
    const handler = this.handlers.get(message.command);
    if (handler) {
      try {
        await handler(message);
      } catch (error) {
        console.error(`Error handling command '${message.command}':`, error);
      }
    } else {
      console.warn(`No handler for command: ${message.command}`);
    }
  }
  
  /**
   * Remove a handler
   */
  off(command: string): void {
    this.handlers.delete(command);
  }
  
  /**
   * Clear all handlers
   */
  clear(): void {
    this.handlers.clear();
  }
}
