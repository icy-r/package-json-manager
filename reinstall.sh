#!/bin/bash

# Get the version from package.json
VERSION=$(node -p "require('./package.json').version")
EXTENSION_NAME="package-json-manager"

echo "Uninstalling extension icy-r.${EXTENSION_NAME}..."
code --uninstall-extension icy-r.${EXTENSION_NAME}

# Wait for uninstall to complete
sleep 2

# Rebuild the extension
echo "Building extension..."
npm run package

# Wait for build to complete
sleep 1

# Create vsix file
echo "Packaging extension..."
npx vsce package --no-dependencies

# Wait for packaging to complete
sleep 1

# Install the extension
VSIX_FILE="${EXTENSION_NAME}-${VERSION}.vsix"
echo "Installing ${VSIX_FILE}..."

if [ -f "$VSIX_FILE" ]; then
    code --install-extension "$VSIX_FILE"
    echo "Extension installed successfully!"
else
    echo "Error: VSIX file not found: $VSIX_FILE"
    exit 1
fi
