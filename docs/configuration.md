# Configuration Specification

> **Version:** 1.1
> **Last Updated:** 2026-02-24
> **Status:** Stable (v1.0.0)

## Overview

`whichmodel` resolves configuration in this order:
1. CLI flags
2. Environment variables
3. Config file
4. Built-in defaults

## Environment Variables

### Required for LLM calls

- `OPENROUTER_API_KEY`

This is required for:
- default recommendation flow
- `compare` command
- `--update-recommender`

### Optional source keys

- `FAL_API_KEY`
- `REPLICATE_API_TOKEN`
- `ELEVENLABS_API_KEY` (future source)
- `TOGETHER_API_KEY` (future source)

### Optional behavior

- `WHICHMODEL_MODEL` (default: `deepseek/deepseek-v3.2`)
- `WHICHMODEL_CACHE_TTL` (default: `3600`)
- `WHICHMODEL_CONFIG` (custom config path)
- `NO_COLOR` (disable colors)

## Config File

Default location:
- macOS/Linux: `~/.config/whichmodel/config.json`
- Windows: `%APPDATA%\whichmodel\config.json`

Config file schema used by current implementation:

```json
{
  "apiKey": "sk-or-v1-...",
  "recommenderModel": "deepseek/deepseek-v3.2",
  "cacheTtl": 3600,
  "falApiKey": "...",
  "replicateApiToken": "...",
  "elevenLabsApiKey": "...",
  "togetherApiKey": "..."
}
```

## Cache Location

- macOS/Linux: `~/.cache/whichmodel/` (or `$XDG_CACHE_HOME/whichmodel/`)
- Windows: `%LOCALAPPDATA%\whichmodel\cache\`

Cache files:
- `openrouter-catalog.json`
- `fal-catalog.json`
- `replicate-catalog.json`

## Runtime Notes

- `list` and `stats` can run without `OPENROUTER_API_KEY` for OpenRouter public catalog access.
- `compare` still requires `OPENROUTER_API_KEY` because it performs an LLM compare pass.
- Empty cache payloads are treated as invalid and ignored.
- `--no-cache` forces fresh fetch and bypasses cache for all command flows.
