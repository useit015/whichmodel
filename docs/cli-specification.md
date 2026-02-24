# CLI Specification

> **Version:** 1.1
> **Last Updated:** 2026-02-24
> **Status:** Stable (v1.0.0)

## Overview

`whichmodel` recommends AI models from natural-language tasks and supports catalog exploration commands.

## Installation

```bash
npm install -g whichmodel
# or
npx whichmodel "summarize documents"
```

## Commands

### Recommend (default)

```bash
whichmodel [task...] [options]
```

Arguments:
- `task` (`string[]`, required): task description

### Compare

```bash
whichmodel compare <modelA> <modelB> --task <description> [options]
```

Options:
- `--task <description>` (required)
- `--json`
- `-v, --verbose`

### List

```bash
whichmodel list [options]
```

Options:
- `--modality <type>`
- `--source <name>`
- `--sort <field>` (`price|name|context`, default: `price`)
- `--limit <n>` (default: `50`)
- `--json`

### Stats

```bash
whichmodel stats [options]
```

Options:
- `--json`

### Cache

```bash
whichmodel cache [options]
```

Options:
- `--stats`
- `--clear`

## Main Options (Recommend)

- `--json`
- `-v, --verbose`
- `--no-color`
- `-m, --modality <type>`
- `--max-price <number>`
- `--min-context <tokens>`
- `--min-resolution <WxH>`
- `--exclude <ids>`
- `--sources <list>`
- `--model <id>`
- `--estimate <workload>`
- `--no-cache`
- `--update-recommender`

Global options `--json`, `--no-color`, and `--no-cache` are honored by subcommands.

## Sources

Valid source values:
- `openrouter`
- `fal`
- `replicate`
- `elevenlabs` (recognized, not supported)
- `together` (recognized, not supported)

Supported values right now:
- `openrouter`
- `fal`
- `replicate`

## Modalities

Valid modality values:
- `text`
- `image`
- `video`
- `audio_tts`
- `audio_stt`
- `audio_generation`
- `vision`
- `embedding`
- `multimodal`

## Exit Codes

- `0`: success
- `1`: general/unexpected error
- `2`: invalid arguments
- `3`: missing API key
- `4`: no models found
- `5`: recommender LLM failure
- `6`: network failure

## Environment

- `OPENROUTER_API_KEY`: required for recommendation and compare LLM calls
- `FAL_API_KEY`: required when using `fal` source
- `REPLICATE_API_TOKEN`: required when using `replicate` source
- `WHICHMODEL_MODEL`: default recommender override
- `WHICHMODEL_CACHE_TTL`: cache TTL in seconds (default `3600`)
- `WHICHMODEL_CONFIG`: custom config path
- `NO_COLOR`: standard color-disable env

## Examples

```bash
whichmodel "summarize legal contracts"
whichmodel "generate product photos" --sources openrouter,fal --estimate "500 images/month at 1024x1024"
whichmodel compare "openrouter::anthropic/claude-sonnet-4" "openrouter::openai/gpt-4o" --task "write code"
whichmodel list --modality image --sort price --limit 20 --json
whichmodel stats --json
whichmodel cache --stats
```
