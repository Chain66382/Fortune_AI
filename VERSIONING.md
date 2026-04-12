# Versioning Guide

## Branch Strategy

- `main`: production-ready branch
- `feature/<short-name>`: new features
- `fix/<short-name>`: bug fixes
- `chore/<short-name>`: maintenance, docs, tooling

## Commit Convention

Use concise Conventional Commit style messages:

- `feat: add lunar birth date conversion`
- `fix: persist consultation state after refresh`
- `chore: update knowledge ingestion docs`

## Release Rules

- Patch release: `v0.1.1`
  - bug fixes, copy updates, styling fixes, non-breaking internal changes
- Minor release: `v0.2.0`
  - new user-facing features, new APIs, expanded consultation flows
- Major release: `v1.0.0`
  - breaking changes to API contracts, data structures, or core product flow

## Recommended Workflow

1. Create a branch from `main`
2. Commit with `feat:`, `fix:`, or `chore:`
3. Merge back into `main`
4. Tag the release on `main`
5. Push both `main` and the new tag to GitHub

## Tagging Examples

- `git tag v0.1.1`
- `git push origin main`
- `git push origin v0.1.1`

## Current Baseline

- Initial project release: `v0.1.0`
