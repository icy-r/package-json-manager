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
 * Gets the nonce to use for webview resources
 * @returns A random nonce string
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
 * Gets the Content Security Policy for a webview
 * @param nonce The nonce to use in the CSP
 * @param webview The webview to get the CSP source for
 * @returns A CSP string
 */
export function getWebviewContentSecurityPolicy(nonce: string, webview: vscode.Webview): string {
  return `default-src 'none'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}'; style-src ${webview.cspSource} 'unsafe-inline';`;
}