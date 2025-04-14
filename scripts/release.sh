#!/bin/bash
set -e

# Check if a version type is provided
if [ -z "$1" ]; then
  echo "Error: Please specify version type (patch, minor, or major)"
  echo "Usage: ./scripts/release.sh [patch|minor|major]"
  exit 1
fi

# Validate version type
VERSION_TYPE=$1
if [ "$VERSION_TYPE" != "patch" ] && [ "$VERSION_TYPE" != "minor" ] && [ "$VERSION_TYPE" != "major" ]; then
  echo "Error: Version type must be patch, minor, or major"
  exit 1
fi

# Ensure we're on main/master branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
  echo "Error: You must be on the main or master branch to create a release"
  exit 1
fi

# Ensure working directory is clean
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: Working directory is not clean. Please commit or stash your changes."
  exit 1
fi

# Pull latest changes
echo "Pulling latest changes..."
git pull origin "$CURRENT_BRANCH"

# Bump version
echo "Bumping $VERSION_TYPE version..."
npm version "$VERSION_TYPE" --no-git-tag-version

# Get the new version
NEW_VERSION=$(node -p "require('./package.json').version")
echo "New version: v$NEW_VERSION"

# Update the changelog
echo "Updating CHANGELOG.md..."
if [ ! -f CHANGELOG.md ]; then
    echo "# Changelog\n\nAll notable changes to this project will be documented in this file.\n" > CHANGELOG.md
fi

TODAY=$(date +"%Y-%m-%d")
TEMP_FILE=$(mktemp)

echo -e "# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n## [v$NEW_VERSION] - $TODAY\n\n### Added\n- [Add your new features here]\n\n### Changed\n- [Add your changes here]\n\n### Fixed\n- [Add your bug fixes here]\n\n$(tail -n +2 CHANGELOG.md)" > "$TEMP_FILE"
mv "$TEMP_FILE" CHANGELOG.md

# Open the changelog in the editor for further edits
${EDITOR:-nano} CHANGELOG.md

# Commit the changes
echo "Committing changes..."
git add package.json CHANGELOG.md
git commit -m "chore: release v$NEW_VERSION"

# Create a tag
echo "Creating tag v$NEW_VERSION..."
git tag -a "v$NEW_VERSION" -m "Release v$NEW_VERSION"

echo "Ready to push changes and trigger GitHub Actions workflows."
echo "Run the following commands when ready:"
echo "  git push origin $CURRENT_BRANCH"
echo "  git push origin v$NEW_VERSION"
echo ""
echo "This will trigger the CI/CD pipeline and create a GitHub release."