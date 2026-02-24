# AI Agent Integration

> **Version:** 1.1
> **Last Updated:** 2026-02-24
> **Status:** Stable (v1.0.0)

## Overview

`whichmodel` is designed to be automation-friendly for coding/ops agents via CLI and JSON output.

## Recommended Invocation

```bash
whichmodel "summarize legal contracts and flag risks" --json
```

Machine-readable commands:

```bash
whichmodel list --json
whichmodel stats --json
whichmodel compare "openrouter::anthropic/claude-sonnet-4" "openrouter::openai/gpt-4o" --task "write code" --json
```

## JSON Contract

Top-level fields in recommendation JSON:
- `task`
- `taskAnalysis`
- `recommendations`
- `alternativesInOtherModalities`
- `meta`

Agents typically consume:
- `recommendations.cheapest.id`
- `recommendations.balanced.id`
- `recommendations.best.id`
- `taskAnalysis.detectedModality`
- `meta.recommenderModel`
- `meta.recommendationCostUsd`

## Operational Notes for Agents

- `--json`, `--no-cache`, and `--no-color` are global and apply to subcommands.
- `list` and `stats` do not require `OPENROUTER_API_KEY` for public OpenRouter catalog reads.
- `compare` and recommendation flows require `OPENROUTER_API_KEY`.
- For deterministic catalog refresh in CI, use `--no-cache`.

## Error Handling

Agents should branch on process exit code:
- `2` invalid arguments
- `3` missing API key
- `4` no models found
- `5` recommender LLM failure
- `6` network failure

Recommended strategy:
1. If code is `2`, fix invocation.
2. If code is `3`, inject required credential.
3. If code is `4/6`, retry with backoff and/or adjust sources.
4. If code is `5`, retry once and fall back to cached/previously approved model.
