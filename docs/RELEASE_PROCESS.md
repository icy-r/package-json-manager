# Release Process Guide

This document outlines the process for creating and publishing new releases of the Package.json Manager VS Code extension.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Release Process Overview](#release-process-overview)
- [Step-by-Step Release Instructions](#step-by-step-release-instructions)
- [CI/CD Pipeline Details](#cicd-pipeline-details)
- [Troubleshooting](#troubleshooting)

## Prerequisites

Before you begin the release process, ensure you have:

1. Write access to the GitHub repository
2. A clean working directory (no uncommitted changes)
3. The latest code from the `main` branch
4. A Personal Access Token (PAT) for publishing to the VS Code Marketplace (should be configured as the `VSCE_PAT` secret in GitHub)

## Release Process Overview

Our extension uses a semi-automated release process:

1. **Local preparation**: Run the release script to bump version numbers and prepare changelog
2. **Push changes**: Push the version commit and tag to GitHub
3. **Automated CI/CD**: GitHub Actions will automatically:
   - Build and test the extension
   - Create a GitHub release with release notes
   - Publish the extension to the VS Code Marketplace

## Step-by-Step Release Instructions

### 1. Ensure your local repository is up-to-date

```bash
# Ensure you're on the main branch
git checkout main

# Pull the latest changes
git pull origin main

# Verify you have a clean working directory
git status
```

### 2. Run the release script

The release script handles version bumping, changelog updates, and tagging. Choose the appropriate version increment type:
- `patch`: for bug fixes (e.g., 1.0.0 → 1.0.1)
- `minor`: for new features (e.g., 1.0.0 → 1.1.0)
- `major`: for breaking changes (e.g., 1.0.0 → 2.0.0)

```bash
./scripts/release.sh [patch|minor|major]
```

This script will:
- Update the version in `package.json`
- Create/update the CHANGELOG.md file
- Open your text editor to customize the changelog entry
- Commit these changes with a message like "chore: release v1.0.1"
- Create a new Git tag for the version (e.g., `v1.0.1`)

### 3. Update the changelog

When the script opens the CHANGELOG.md file in your editor:

1. Replace the placeholder sections (`[Add your new features here]`, etc.) with actual descriptions of changes
2. Include all notable changes under the appropriate categories:
   - **Added**: New features
   - **Changed**: Changes to existing functionality
   - **Fixed**: Bug fixes
3. Save and close the file to continue the process

### 4. Push changes to GitHub

After the script completes, it will show you the commands needed to push both the commit and the tag:

```bash
git push origin main
git push origin v1.0.1  # Replace with your actual version tag
```

### 5. Monitor the CI/CD pipeline

Once you've pushed the changes and tag, the GitHub Actions CI/CD pipeline will automatically start:

1. Go to your GitHub repository
2. Click on the "Actions" tab
3. You should see a workflow run in progress for the tag you just pushed
4. Monitor the workflow to ensure all steps pass

### 6. Verify the release

After the CI/CD workflow completes successfully:

1. Check that a new release appears in the "Releases" section of your GitHub repository
2. Verify that the extension has been updated in the VS Code Marketplace
3. Ensure the published version matches the version you intended to release

## CI/CD Pipeline Details

Our CI/CD pipeline (configured in `.github/workflows/ci-cd.yml`) automatically handles:

1. **Building**: Compiling TypeScript files to JavaScript
2. **Linting**: Ensuring code quality standards
3. **Testing**: Running automated tests
4. **Packaging**: Creating the VSIX package
5. **Publishing**: Uploading to VS Code Marketplace and creating a GitHub release

The pipeline runs automatically whenever a tag starting with "v" is pushed to the repository.

## Troubleshooting

### Common Issues

#### Failed CI/CD Workflow

If the CI/CD workflow fails:

1. Check the workflow logs in GitHub Actions to identify the specific error
2. Common issues include:
   - Linting errors
   - Test failures
   - Version mismatch between tag and package.json

#### Publishing Failure

If the extension fails to publish to VS Code Marketplace:

1. Verify that the `VSCE_PAT` secret is correctly set up in your GitHub repository
2. Ensure the PAT has not expired
3. Check if there are any specific error messages in the workflow logs

#### Version Conflicts

If you see an error about version mismatch:

1. Ensure the Git tag version matches the version in package.json
2. The format should be `v1.0.1` for the tag if package.json has `"version": "1.0.1"`

---

For additional help or to report issues with the release process, please create an issue in the GitHub repository.