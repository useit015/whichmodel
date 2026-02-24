# Product Requirements Document

## whichmodel (v1.0.0)

> **Last Updated:** 2026-02-24
> **Status:** Stable

## 1. Product Summary

`whichmodel` is a CLI that recommends AI models from a user task description.

Core flow:
1. Parse task + constraints
2. Fetch live model catalogs
3. Select recommendations (`cheapest`, `balanced`, `best`) with reasoning
4. Output terminal or JSON response

## 2. Goals

- Fast model selection for developers and technical teams
- Multi-modality support (text, image, video, audio, vision, embedding, multimodal)
- Explainable recommendations with pricing context
- Low operational overhead through caching and robust fallbacks

## 3. Users

- Developers choosing models for product features
- AI engineers balancing cost and quality
- Power users who need CLI-native automation and JSON output

## 4. Functional Requirements

### 4.1 Recommendation

- Input: free-form task text
- Output: structured recommendation object with three tiers
- Supports filtering constraints:
  - modality
  - max price
  - min context
  - min resolution
  - excludes

### 4.2 Catalog Sources

Supported sources:
- OpenRouter
- fal
- Replicate

Recognized but not yet supported:
- elevenlabs
- together

### 4.3 Commands

- Default recommendation command
- `compare`
- `list`
- `stats`
- `cache`
- `--update-recommender`

### 4.4 Caching

- File-based cache per source
- TTL default 1 hour
- cache bypass with `--no-cache`
- cache management via `whichmodel cache`

### 4.5 Error Handling

- Typed CLI errors with exit codes and recovery hints
- No API key leakage in logs/errors

## 5. Non-Goals

- not a benchmark runner
- not a model execution router/proxy
- not a GUI/web app

## 6. Success Criteria

- stable CLI behavior and docs parity
- test suite and coverage green
- reliable source integration and fallback behavior
- ready-to-publish npm package metadata and licensing

## 7. Technical Constraints

- TypeScript strict mode
- Node.js 20+
- Vitest test suite
- prompts locked in `docs/prompts.md`

## 8. Release Notes (v1.0.0)

- stabilized subcommand global option behavior
- fixed cache bypass and empty-cache poisoning edge cases
- filtered negative sentinel pricing entries from provider catalogs
- aligned documentation with implementation
