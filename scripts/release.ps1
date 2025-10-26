#!/usr/bin/env pwsh
# PowerShell Release Script for Package.json Manager
# Usage: .\scripts\release.ps1 [patch|minor|major]

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet('patch', 'minor', 'major')]
    [string]$VersionType
)

$ErrorActionPreference = "Stop"

Write-Host "Package.json Manager Release Script" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Ensure we're on main/master branch
$currentBranch = git branch --show-current
if ($currentBranch -ne "main" -and $currentBranch -ne "master") {
    Write-Error "Error: You must be on the main or master branch to create a release"
    exit 1
}

Write-Host "Current branch: $currentBranch" -ForegroundColor Green

# Check working directory status
$gitStatus = git status --porcelain
if ($gitStatus) {
    Write-Host "Working directory has uncommitted changes:" -ForegroundColor Yellow
    Write-Host $gitStatus
    Write-Host ""
    $continue = Read-Host "Do you want to commit all changes and continue? (y/n)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        Write-Host "Release cancelled." -ForegroundColor Yellow
        exit 0
    }
}

# Pull latest changes
Write-Host ""
Write-Host "Pulling latest changes..." -ForegroundColor Cyan
try {
    git pull origin $currentBranch
    Write-Host "Successfully pulled latest changes" -ForegroundColor Green
} catch {
    Write-Warning "Failed to pull changes, continuing anyway..."
}

# Bump version
Write-Host ""
Write-Host "Bumping $VersionType version..." -ForegroundColor Cyan
npm version $VersionType --no-git-tag-version

# Get the new version
$packageJson = Get-Content -Path "package.json" -Raw | ConvertFrom-Json
$newVersion = $packageJson.version
Write-Host "New version: v$newVersion" -ForegroundColor Green

# Update the changelog date if needed
Write-Host ""
Write-Host "Updating CHANGELOG.md date..." -ForegroundColor Cyan
$today = Get-Date -Format "yyyy-MM-dd"
$changelog = Get-Content -Path "CHANGELOG.md" -Raw
$changelog = $changelog -replace '\[v' + $newVersion + '\] - \d{4}-\d{2}-\d{2}', "[v$newVersion] - $today"
Set-Content -Path "CHANGELOG.md" -Value $changelog -NoNewline

Write-Host "CHANGELOG.md updated with today's date" -ForegroundColor Green

# Stage all changes
Write-Host ""
Write-Host "Staging all changes..." -ForegroundColor Cyan
git add -A

# Show what will be committed
Write-Host ""
Write-Host "Files to be committed:" -ForegroundColor Cyan
git status --short

# Commit the changes
Write-Host ""
Write-Host "Committing changes..." -ForegroundColor Cyan
git commit -m "chore: release v$newVersion - architecture refactoring and bug fixes"

# Create a tag
Write-Host ""
Write-Host "Creating tag v$newVersion..." -ForegroundColor Cyan
git tag -a "v$newVersion" -m "Release v$newVersion"

Write-Host ""
Write-Host "Successfully created release v$newVersion!" -ForegroundColor Green

# Push changes
Write-Host ""
$push = Read-Host "Do you want to push changes now? (y/n)"
if ($push -eq "y" -or $push -eq "Y") {
    Write-Host ""
    Write-Host "Pushing changes to remote..." -ForegroundColor Cyan
    git push origin $currentBranch
    
    Write-Host ""
    Write-Host "Pushing tag to remote..." -ForegroundColor Cyan
    git push origin "v$newVersion"
    
    Write-Host ""
    Write-Host "Release v$newVersion has been pushed successfully!" -ForegroundColor Green
    Write-Host "This will trigger the CI/CD pipeline and create a GitHub release." -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "Changes committed locally but not pushed." -ForegroundColor Yellow
    Write-Host "Run the following commands when ready:" -ForegroundColor Cyan
    Write-Host "  git push origin $currentBranch" -ForegroundColor White
    Write-Host "  git push origin v$newVersion" -ForegroundColor White
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green

