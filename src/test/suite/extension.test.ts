import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
  test('Extension should be present', () => {
    const ext = vscode.extensions.getExtension('icy-r.package-json-manager');
    assert.ok(ext, 'Extension should be installed');
  });

  test('Extension should activate', async () => {
    const ext = vscode.extensions.getExtension('icy-r.package-json-manager');
    if (ext && !ext.isActive) {
      await ext.activate();
    }
    assert.ok(ext?.isActive, 'Extension should be active');
  });

  test('Commands should be registered', async () => {
    const commands = await vscode.commands.getCommands(true);
    assert.ok(commands.includes('packageJsonManager.openPackageJsonEditor'));
    assert.ok(commands.includes('packageJsonManager.toggleView'));
    assert.ok(commands.includes('packageJsonManager.showDependencyGraph'));
  });
});
