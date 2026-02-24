# Implementation Roadmap

> **Version:** 1.1
> **Last Updated:** 2026-02-24
> **Status:** v1.0.0 Released

## Current State (v1.0.0)

Completed and shipped:
- multi-source catalog adapters: OpenRouter, fal, Replicate
- recommendation flow with LLM + deterministic fallback
- commands: `compare`, `list`, `stats`, `cache`
- cache TTL, bypass (`--no-cache`), and cache management command
- recommender self-update (`--update-recommender`)
- strict TypeScript + Vitest coverage

## Quality Milestones Completed

- Source validation centralized across CLI and scripts
- Global option handling fixed for subcommands (`--json`, `--no-cache`, `--no-color`)
- Negative sentinel pricing filtered during normalization
- Empty cache poisoning guardrails added
- list/stats do not require `OPENROUTER_API_KEY` for openrouter public catalog use

## Near-Term (v1.1)

- improve compare output depth and deterministic scoring fallback
- add more source-level health reporting in `stats`
- extend cost estimation templates for non-text workloads

## Mid-Term (v1.2+)

- implement additional sources currently recognized but unsupported:
  - elevenlabs
  - together
- add config inspection command
- improve docs automation and changelog generation

## Release Checklist (v1.0.0)

- [x] lint passes
- [x] tests pass
- [x] coverage run passes
- [x] cache and source behavior validated
- [x] docs rewritten to match implementation
- [x] package metadata/license ready for npm
