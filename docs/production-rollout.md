# Production Rollout Guide

This guide covers releasing `whichmodel` to npm and Homebrew.

## Prerequisites

- npm account with publish access to `whichmodel`
- GitHub repo access with permission to create tags/releases
- Node.js 20+

## 1. Pre-release validation

Run all release checks locally:

```bash
npm ci
npm run release:check
npm run release:pack
```

Review the package dry-run output to confirm only expected files are published.

## 2. Publish to npm

1. Bump version:

```bash
npm version patch
```

2. Push commit + tag:

```bash
git push origin main --follow-tags
```

3. Publish:
   - Preferred: GitHub Actions `Release` workflow on `v*` tags
   - Alternative: manual publish

```bash
npm publish --access public --provenance
```

4. Verify package:

```bash
npm view whichmodel version
npx whichmodel --version
```

## 3. Update Homebrew formula

Use the generator script after the new npm version is live:

```bash
npm run release:brew -- --version <new-version> --output /path/to/homebrew-tap/Formula/whichmodel.rb
```

What it does:
- fetches tarball URL from npm registry
- downloads tarball
- computes `sha256`
- writes a ready-to-commit Homebrew formula

Then commit and push in your tap repo:

```bash
cd /path/to/homebrew-tap
git add Formula/whichmodel.rb
git commit -m "whichmodel <new-version>"
git push origin main
```

## 4. Installation docs verification

Verify all install paths still work:

```bash
npm install -g whichmodel@latest
whichmodel --version

npx whichmodel@latest --version

brew update
brew tap useit015/tap
brew install whichmodel
whichmodel --version
```

## 5. Post-release checks

- Run a smoke recommendation:

```bash
whichmodel "summarize legal contracts" --no-cache
```

- Confirm issue tracker and README links are valid.
- Announce release notes with key changes.
