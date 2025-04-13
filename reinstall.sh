code --uninstall-extension vscode-extensions.package-json-manager

# wait till last execution to complete
wait

# rebuild the extension
npm run package

# wait till last execution to complete
wait

# create vsix file
npx vsce package --no-dependencies

# wait till last execution to complete
wait

# install the extension
code --install-extension package-json-manager-0.1.0.vsix
