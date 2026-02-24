# Test Plan

> **Version:** 1.1
> **Last Updated:** 2026-02-24
> **Status:** Active (v1.0.0)

## Test Stack

- Framework: Vitest
- Coverage: `@vitest/coverage-v8`
- Language: TypeScript (strict)

## Current Baseline

- Test files: 27
- Tests: 286
- Coverage: >85% statements overall

## Core Test Areas

### Catalog

- OpenRouter/fal/Replicate adapters
- retries and timeout handling
- normalization and modality mapping
- cache read/write/invalidation behavior
- sentinel/invalid pricing filtering

### CLI

- input validation errors and exit codes
- source validation and unsupported source handling
- global option behavior (`--json`, `--no-cache`)
- no key leakage in stderr/stdout
- list/stats behavior without `OPENROUTER_API_KEY` when using cached/public openrouter flow

### Recommender

- prompt construction
- LLM client request/response handling
- recommendation validation and repair
- fallback recommendation behavior

### Commands and formatters

- `compare`, `list`, `stats`, `update-recommender`
- terminal and JSON formatter outputs
- pricing formatting

## Required Verification Commands

```bash
npm run lint
npm test
npm run test:coverage
```

## Manual Smoke Checks (Release)

```bash
whichmodel "summarize legal contracts" --json --no-cache
whichmodel list --source openrouter --limit 5 --json --no-cache
whichmodel stats --json --no-cache
whichmodel compare "openrouter::anthropic/claude-sonnet-4" "openrouter::openai/gpt-4o" --task "write code" --json
whichmodel cache --stats
```

## Release Gate

A release is green only if all are true:
- lint passes
- tests pass
- coverage run passes
- no launch-blocking regressions in smoke checks
- docs are updated for current behavior
