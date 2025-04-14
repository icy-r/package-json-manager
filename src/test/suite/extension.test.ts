import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
  vscode.window.showInformationMessage('Starting tests...');

  test('Extension should be present', () => {
    assert.ok(vscode.extensions.getExtension('icy-r.package-json-manager'));
  });

  test('Extension should activate', async () => {
    const extension = vscode.extensions.getExtension('icy-r.package-json-manager');
    if (!extension) {
      assert.fail('Extension not found');
      return;
    }
    
    // Activate the extension if it's not already activated
    if (!extension.isActive) {
      await extension.activate();
    }
    
    assert.ok(extension.isActive);
  });

  test('Commands should be registered', () => {
    // Check if the extension commands are registered
    return vscode.commands.getCommands(true).then((commands) => {
      // Check for each command the extension should register
      const hasOpenCommand = commands.includes('packageJsonManager.openPackageJsonEditor');
      const hasToggleCommand = commands.includes('packageJsonManager.toggleView');
      const hasGraphCommand = commands.includes('packageJsonManager.showDependencyGraph');
      
      assert.ok(hasOpenCommand, 'openPackageJsonEditor command is registered');
      assert.ok(hasToggleCommand, 'toggleView command is registered');
      assert.ok(hasGraphCommand, 'showDependencyGraph command is registered');
    });
  });
});