# Release Process Guide

This document outlines the process for creating and publishing new releases of the Package.json Manager VS Code extension.

## Overview

Releases are **fully automated** via the `release.yml` GitHub Actions workflow. When a PR is merged to `main`, the workflow:

1. Analyzes conventional commit messages to determine version bump type
2. Bumps the version in `package.json`
3. Creates a git tag and commits the version bump
4. Publishes the VSIX to VS Code Marketplace
5. Creates a GitHub Release with the VSIX attached

## Conventional Commit Versioning

The workflow detects the version bump type from commit messages:

| Commit prefix | Bump type | Example |
|---------------|-----------|---------|
| `fix:`, `perf:`, `refactor:` | **patch** (2.1.0 → 2.1.1) | `fix: resolve graph rendering issue` |
| `feat:` | **minor** (2.1.0 → 2.2.0) | `feat: add workspace support` |
| `feat!:`, `BREAKING CHANGE` | **major** (2.1.0 → 3.0.0) | `feat!: redesign configuration API` |
| `docs:`, `chore:`, `test:`, `ci:` | **none** (no release) | `docs: update README` |

## Automated Release (Default)

### How it works

1. Create a feature branch and make changes
2. Open a PR to `main` with conventional commit messages
3. Merge the PR
4. The `release.yml` workflow triggers automatically
5. Version is bumped, tagged, published, and released

### Monitoring

```bash
# Check workflow status
gh run list --workflow=release.yml --limit 5

# View specific run
gh run view <run-id>

# Check latest release
gh release list --limit 3
```

## Manual Release (Override)

Use the workflow dispatch to specify an explicit bump type:

1. Go to **Actions** > **Auto Release** > **Run workflow**
2. Select the bump type: `patch`, `minor`, or `major`
3. Click **Run workflow**

Or via CLI:

```bash
gh workflow run release.yml -f bump=minor
```

## Fallback: Manual Tag Release

If the automated workflow isn't suitable, you can still manually tag:

```bash
# Ensure you're on main with latest changes
git checkout main && git pull

# Bump version in package.json manually
# Then commit, tag, and push
git add package.json
git commit -m "chore(release): v2.2.0"
git tag v2.2.0
git push origin main --tags
```

The `ci-cd.yml` workflow will detect the `v*` tag and run the release job.

## Prerequisites

- **`VSCE_PAT` secret**: Personal Access Token for VS Code Marketplace publishing. Set in GitHub repository Settings > Secrets.
- **`GITHUB_TOKEN`**: Automatically provided by GitHub Actions.

## Troubleshooting

### Release workflow didn't trigger
- Ensure the commit message doesn't contain `[skip ci]` or `chore(release)` (these are guard strings)
- Check that the push was to the `main` branch

### Version bump detected as "none"
- Ensure commit messages use conventional prefixes (`feat:`, `fix:`, etc.)
- `docs:`, `chore:`, `test:`, `ci:` prefixes intentionally skip releases

### Publishing failed
- Verify `VSCE_PAT` secret is set and not expired
- Check workflow logs for specific error messages

### Duplicate releases
- The workflow uses `[skip ci]` in its version bump commit to prevent re-triggering
- If you see duplicate runs, check that the guard condition is working

## CI/CD Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `release.yml` | Push to `main`, manual dispatch | Auto-version, tag, publish, release |
| `ci-cd.yml` | Push, PR, `v*` tags | Build, test, artifact upload, fallback release |
| `pr-validation.yml` | PRs to `main` | Validate PRs (lint, test, build, bundle size) |
| `security-scan.yml` | Weekly, push to `main` | Dependency audit, CodeQL analysis |
