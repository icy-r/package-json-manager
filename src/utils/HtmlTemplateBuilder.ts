import * as vscode from 'vscode';
import { getNonce, buildCspMeta, getWebviewUri } from './webviewUtils';

interface HtmlBuildOptions {
  webview: vscode.Webview;
  extensionUri: vscode.Uri;
  stylePaths: string[][];
  scriptPaths: string[][];
  title: string;
  bodyContent?: string;
}

export class HtmlTemplateBuilder {
  build(options: HtmlBuildOptions): string {
    const { webview, extensionUri, stylePaths, scriptPaths, title, bodyContent } = options;
    const nonce = getNonce();
    const csp = buildCspMeta(webview, nonce);

    const styleLinks = stylePaths
      .map(segments => {
        const uri = getWebviewUri(webview, extensionUri, segments);
        return `<link rel="stylesheet" href="${uri}">`;
      })
      .join('\n    ');

    const scriptTags = scriptPaths
      .map(segments => {
        const uri = getWebviewUri(webview, extensionUri, segments);
        return `<script nonce="${nonce}" src="${uri}"></script>`;
      })
      .join('\n    ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${csp}
    <title>${title}</title>
    ${styleLinks}
</head>
<body>
    ${bodyContent ?? ''}
    ${scriptTags}
</body>
</html>`;
  }
}
