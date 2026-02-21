# Existing GitHub Workflows & Secrets

## Workflows

### 1. CI/CD Pipeline (`ci-cd.yml`)
- **Triggers:** push to `main`/`master`, tags `v*`, PRs to `main`/`master`, manual dispatch
- **Jobs:**
  - **Build & Test** — lint, compile, test (xvfb), package extension, package VSIX, upload artifact
  - **Release** (on `v*` tags only) — publish to VS Marketplace, create GitHub Release
- **Permissions:** `contents: write`, `packages: write` (release job)

### 2. PR Validation (`pr-validation.yml`)
- **Triggers:** PRs to `main`/`master`
- **Jobs:**
  - **Validate PR** — audit deps, lint, compile, test (xvfb), build, check bundle size, package VSIX, upload artifact (7-day retention)

### 3. Security Scan (`security-scan.yml`)
- **Triggers:** weekly cron (Sunday midnight UTC), push to `main`/`master`, manual dispatch
- **Jobs:**
  - **Dependency Vulnerability Scan** — pnpm audit, auto-create GitHub issue on failure
  - **CodeQL Analysis** — JavaScript + TypeScript, security-and-quality queries
- **Permissions:** `contents: read`, `issues: write`, `actions: read`, `security-events: write`

---

## Secrets Used

| Secret Name    | Used In         | Purpose                              |
|----------------|-----------------|--------------------------------------|
| `VSCE_PAT`     | ci-cd.yml       | Publish extension to VS Marketplace  |
| `GITHUB_TOKEN` | ci-cd.yml       | Create GitHub Release (auto-provided)|

---

## Common Workflow Patterns
- Node.js 20, pnpm with action-setup@v4
- pnpm store caching via `actions/cache@v4`
- `pnpm install --frozen-lockfile` for reproducible installs
- xvfb-action for VS Code extension tests
- `vsce package --no-dependencies` for VSIX packaging
