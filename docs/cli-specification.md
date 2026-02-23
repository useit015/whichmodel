# CLI Specification

> **Version:** 1.0
> **Last Updated:** 2025-02-23
> **Status:** Production (Phase 1)

---

## Overview

`whichmodel` is a CLI tool that recommends AI models based on natural language task descriptions. This document defines the complete CLI interface contract.

---

## Installation

```bash
# npm
npm install -g whichmodel

# npx (no install)
npx whichmodel "summarize documents"

# bun
bunx whichmodel "summarize documents"
```

---

## Commands

### Default Command (Recommend)

The primary command recommends models for a task.

```bash
whichmodel [task...] [options]
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `task` | string[] | Yes | Task description (space-separated words or quoted string) |

**Examples:**

```bash
# Quoted task
whichmodel "summarize legal contracts and flag risks"

# Unquoted (space-separated)
whichmodel summarize legal contracts

# With options
whichmodel "generate images" --modality image --max-price 0.05
```

---

### Compare Command (Phase 3)

Compare two models head-to-head for a specific task.

```bash
whichmodel compare <modelA> <modelB> --task <description> [options]
```

**Arguments:**

| Argument | Type | Required | Description |
|----------|------|----------|-------------|
| `modelA` | string | Yes | First model ID |
| `modelB` | string | Yes | Second model ID |
| `--task` | string | Yes | Task to compare for |

**Examples:**

```bash
whichmodel compare "openrouter::anthropic/claude-sonnet-4" "openrouter::openai/gpt-4o" --task "write marketing copy"
```

---

### List Command (Phase 3)

List available models.

```bash
whichmodel list [options]
```

**Options:**

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--modality` | string | all | Filter by modality |
| `--source` | string | all | Filter by catalog source |
| `--sort` | string | price | Sort by: price, name, context |
| `--limit` | number | 50 | Max models to show |
| `--json` | boolean | false | Output as JSON |

**Examples:**

```bash
whichmodel list
whichmodel list --modality image --sort price
whichmodel list --source openrouter --json
```

---

### Stats Command (Phase 3)

Show catalog statistics.

```bash
whichmodel stats [options]
```

**Output:**

```
Catalog: 312 models from 1 source

┌────────────────┬───────┬────────────────────────────┐
│ Modality       │ Count │ Price Range                │
├────────────────┼───────┼────────────────────────────┤
│ Text           │   287 │ $0.01 - $60.00 / 1M tokens │
│ Image          │     0 │ N/A                        │
│ Video          │     0 │ N/A                        │
│ Audio (TTS)    │     0 │ N/A                        │
│ Audio (STT)    │     0 │ N/A                        │
│ Embedding      │     0 │ N/A                        │
│ Vision         │    25 │ Varies                     │
└────────────────┴───────┴────────────────────────────┘

Sources configured: openrouter
Missing sources: fal (set FAL_API_KEY), replicate (set REPLICATE_API_TOKEN)
```

---

## Options (Main Command)

### Output Format

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--json` | | boolean | false | Output as JSON |
| `--verbose` | `-v` | boolean | false | Show detailed output (tokens, cost, timing) |
| `--no-color` | | boolean | false | Disable colored output |
| `--help` | `-h` | | | Show help message |
| `--version` | | | | Show version number |

### Modality Override

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--modality` | `-m` | string | auto | Force a specific modality |

**Valid values:** `text`, `image`, `video`, `audio_tts`, `audio_stt`, `audio_generation`, `vision`, `embedding`, `multimodal`

### Filtering

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--max-price` | number | none | Maximum price per unit (USD) |
| `--min-context` | number | none | Minimum context length (tokens) |
| `--min-resolution` | string | none | Minimum resolution (e.g., "1024x1024") |
| `--exclude` | string | none | Model IDs to exclude (comma-separated, supports `*` wildcard) |

### Catalog Sources

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--sources` | string | openrouter | Catalog sources (comma-separated) |

**Valid values:** `openrouter`, `fal`, `replicate`, `elevenlabs`, `together`

### Recommender Model

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--model` | string | deepseek/deepseek-v3.2 | Override recommender LLM |

### Cost Estimation

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--estimate` | string | none | Workload description for cost estimation |

**Example:** `--estimate "500 images per month at 1024x1024"`

---

## Exit Codes

| Code | Constant | Meaning | User Action |
|------|----------|---------|-------------|
| 0 | SUCCESS | Success | None |
| 1 | GENERAL_ERROR | General/unexpected error | Check error message |
| 2 | INVALID_ARGUMENTS | Invalid or missing arguments | Check usage with --help |
| 3 | NO_API_KEY | No API key configured | Set OPENROUTER_API_KEY |
| 4 | NO_MODELS_FOUND | No models found from sources | Check sources, add API keys |
| 5 | LLM_FAILED | LLM recommendation failed | Retry or use --model to change |
| 6 | NETWORK_ERROR | Network timeout or failure | Check connection |

---

## Output Formats

### Terminal Output (Default)

```
🔍 Task Analysis
   Modality: TEXT
   Input-heavy comprehension task. Needs strong reasoning...

💰 Cheapest — openrouter::deepseek/deepseek-v3.2
   $0.26 / $0.38 per 1M tokens (in/out) · Context: 164K
   Strong reasoning at the lowest price point...
   Est. ~$8/mo for 200 contracts, ~15K tokens each

⚖️  Balanced — openrouter::google/gemini-2.5-flash
   $0.15 / $0.60 per 1M tokens (in/out) · Context: 1M
   Million-token context means no chunking needed...
   Est. ~$18/mo for 200 contracts, ~15K tokens each

🏆 Best — openrouter::anthropic/claude-sonnet-4
   $3.00 / $15.00 per 1M tokens (in/out) · Context: 200K
   Best-in-class document comprehension...
   Est. ~$420/mo for 200 contracts, ~15K tokens each

⚡ This recommendation cost $0.003 (deepseek/deepseek-v3.2)
```

### JSON Output (`--json`)

```json
{
  "task": "summarize legal contracts and flag risks",
  "taskAnalysis": {
    "summary": "Legal document summarization with risk identification",
    "detectedModality": "text",
    "modalityReasoning": "Task requires text output summarizing legal documents",
    "keyRequirements": ["long context", "reasoning", "accuracy", "structured output"],
    "costFactors": "Input-heavy, documents can be 50+ pages"
  },
  "recommendations": {
    "cheapest": {
      "id": "openrouter::deepseek/deepseek-v3.2",
      "reason": "Strong reasoning at the lowest price point. 164K context handles most contracts.",
      "pricingSummary": "$0.26 / $0.38 per 1M tokens (in/out)",
      "estimatedCost": "~$8/mo for 200 contracts, ~15K tokens each"
    },
    "balanced": {
      "id": "openrouter::google/gemini-2.5-flash",
      "reason": "Million-token context means no chunking needed for any contract.",
      "pricingSummary": "$0.15 / $0.60 per 1M tokens (in/out)",
      "estimatedCost": "~$18/mo for 200 contracts, ~15K tokens each"
    },
    "best": {
      "id": "openrouter::anthropic/claude-sonnet-4",
      "reason": "Best-in-class document comprehension with nuanced legal analysis.",
      "pricingSummary": "$3.00 / $15.00 per 1M tokens (in/out)",
      "estimatedCost": "~$420/mo for 200 contracts, ~15K tokens each"
    }
  },
  "alternativesInOtherModalities": null,
  "meta": {
    "recommenderModel": "deepseek/deepseek-v3.2",
    "recommendationCostUsd": 0.003,
    "promptTokens": 25430,
    "completionTokens": 412,
    "catalogSources": ["openrouter"],
    "catalogTotalModels": 312,
    "catalogModelsInModality": 287,
    "timestamp": "2025-02-23T14:30:00Z",
    "version": "0.1.0"
  }
}
```

### Verbose Output (`--verbose`)

```
🔍 Task Analysis
   Modality: TEXT
   ...

💰 Cheapest — openrouter::deepseek/deepseek-v3.2
   ...

📋 Details:
   Prompt tokens: 25,430
   Completion tokens: 412
   LLM latency: 3.2s
   Catalog fetch: 1.1s
   Total time: 4.5s
   Recommender model: deepseek/deepseek-v3.2
   Cost: $0.00681 (input) + $0.00016 (output) = $0.00697
```

---

## Help Text

### Main Help (`whichmodel --help`)

```
whichmodel - Tell me what you want to build. I'll tell you which AI model to use.

USAGE:
  whichmodel <task> [options]

ARGUMENTS:
  <task>              Task description (e.g., "generate product photos")

OPTIONS:
  -j, --json          Output as JSON
  -v, --verbose       Show detailed output (tokens, cost, timing)
  --no-color          Disable colored output

  -m, --modality      Force modality (text, image, video, audio, vision, embedding)
  --max-price         Maximum price per unit (USD)
  --min-context       Minimum context length (tokens)
  --min-resolution    Minimum resolution (e.g., 1024x1024)
  --exclude           Model IDs to exclude (comma-separated, supports *)
  --sources           Catalog sources (comma-separated, default: openrouter)
  --model             Override recommender LLM (default: deepseek/deepseek-v3.2)
  --estimate          Workload description for cost estimation

COMMANDS:
  compare             Compare two models head-to-head
  list                List available models
  stats               Show catalog statistics

EXAMPLES:
  whichmodel "summarize legal contracts"
  whichmodel "generate images" --modality image --max-price 0.05
  whichmodel "transcribe podcasts" --json

ENVIRONMENT:
  OPENROUTER_API_KEY  Required. Get at https://openrouter.ai/keys
  FAL_API_KEY         Optional. Enables fal.ai catalog
  REPLICATE_API_TOKEN Optional. Enables Replicate catalog

MORE INFO:
  https://github.com/whichmodel/whichmodel

VERSION:
  0.1.0
```

### Compare Help (`whichmodel compare --help`)

```
whichmodel compare - Compare two models head-to-head for a task

USAGE:
  whichmodel compare <modelA> <modelB> --task <description>

ARGUMENTS:
  <modelA>            First model ID (e.g., openrouter::anthropic/claude-sonnet-4)
  <modelB>            Second model ID

OPTIONS:
  --task              Task to compare for (required)
  --json              Output as JSON
  --verbose           Show detailed output

EXAMPLES:
  whichmodel compare "openrouter::anthropic/claude-sonnet-4" "openrouter::openai/gpt-4o" --task "write code"
```

---

## Shell Completion (Future)

Generate shell completion scripts:

```bash
# Bash
whichmodel completion bash > /etc/bash_completion.d/whichmodel

# Zsh
whichmodel completion zsh > "${fpath[1]}/_whichmodel"

# Fish
whichmodel completion fish > ~/.config/fish/completions/whichmodel.fish
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENROUTER_API_KEY` | Yes | - | OpenRouter API key |
| `FAL_API_KEY` | No | - | fal.ai API key |
| `REPLICATE_API_TOKEN` | No | - | Replicate API token |
| `ELEVENLABS_API_KEY` | No | - | ElevenLabs API key |
| `TOGETHER_API_KEY` | No | - | Together AI API key |
| `WHICHMODEL_MODEL` | No | deepseek/deepseek-v3.2 | Default recommender model |
| `WHICHMODEL_CACHE_TTL` | No | 3600 | Cache TTL in seconds |
| `NO_COLOR` | No | - | Disable colors (standard) |

---

## Configuration File (Phase 3)

Location: `~/.config/whichmodel/config.json` (or `%APPDATA%/whichmodel/config.json` on Windows)

```json
{
  "apiKey": "sk-or-...",
  "recommenderModel": "deepseek/deepseek-v3.2",
  "defaultSources": ["openrouter"],
  "excludeModels": ["openrouter::meta-llama/llama-2-7b"],
  "outputFormat": "terminal",
  "colorOutput": true
}
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-02-23 | Initial CLI specification |
