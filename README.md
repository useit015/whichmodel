# whichmodel

`whichmodel` helps you choose the right AI model fast.

You describe a task in plain English, and the CLI recommends:
- cheapest
- balanced
- best

It uses live provider catalogs and task-aware reasoning so you can make a decision quickly instead of manually comparing models for 30 minutes.

## What You Get

- Task-aware recommendations (not just raw price sorting)
- Multi-modality support: text, image, video, audio, vision, embedding, multimodal
- Cost-aware picks with reasoning
- Script-friendly JSON mode
- Catalog exploration commands (`list`, `stats`, `compare`, `cache`)

## Status

- Version: `1.0.0`
- Stability: Stable
- Runtime: Node.js 20+

## Install

```bash
npm install -g whichmodel
```

Or without installing:

```bash
npx whichmodel "summarize legal contracts"
```

## Quick Start

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
whichmodel "summarize legal contracts and flag risks"
```

JSON output:

```bash
whichmodel "summarize legal contracts and flag risks" --json
```

Verbose metadata (tokens/cost/timing):

```bash
whichmodel "summarize legal contracts and flag risks" --verbose
```

## Example Recommendation Output

Sample terminal output (captured on **February 24, 2026**, values may change with live catalogs):

```text
🔍 Task Analysis
   Modality: TEXT
   Analyze text-based legal contracts to produce summaries and identify potential risks.

💰 Cheapest — openrouter::liquid/lfm2-8b-a1b
   $0.01 per 1M prompt tokens, $0.02 per 1M completion tokens

⚖️ Balanced — openrouter::deepseek/deepseek-v3.2
   $0.26 per 1M prompt tokens, $0.38 per 1M completion tokens

🏆 Best — openrouter::anthropic/claude-opus-4.6
   $5 per 1M prompt tokens, $25 per 1M completion tokens

⚡ This recommendation cost $0.0076 (deepseek/deepseek-v3.2)
```

## Command Cookbook

### 1. Recommend (default)

```bash
whichmodel "build a customer support chatbot" --json
```

### 2. Compare two models head-to-head

```bash
whichmodel compare \
  "openrouter::anthropic/claude-sonnet-4" \
  "openrouter::openai/gpt-4o" \
  --task "write production-ready TypeScript API code" \
  --json --no-cache
```

Sample JSON shape:

```json
{
  "winner": "B",
  "reasoning": "GPT-4o is more cost-effective for code generation...",
  "modelA": {
    "id": "openrouter::anthropic/claude-sonnet-4",
    "name": "Anthropic: Claude Sonnet 4"
  },
  "modelB": {
    "id": "openrouter::openai/gpt-4o",
    "name": "OpenAI: GPT-4o"
  }
}
```

### 3. List models

```bash
whichmodel list --source openrouter --limit 5 --no-cache
```

Sample output (Feb 24, 2026):

```text
305 models (showing top 5, sorted by price)

┌ ... ┐
│ openrouter::liquid/lfm2-8b-a1b              │ LiquidAI: LFM2-8B-A1B │ $0.01 / $0.02 │
│ openrouter::liquid/lfm-2.2-6b               │ LiquidAI: LFM2-2.6B   │ $0.01 / $0.02 │
│ openrouter::ibm-granite/granite-4.0-h-micro │ IBM: Granite 4.0 ...  │ $0.02 / $0.11 │
└ ... ┘
```

JSON mode:

```bash
whichmodel list --source openrouter --limit 20 --json
```

### 4. Stats (catalog snapshot)

```bash
whichmodel stats --json --no-cache
```

Sample output (Feb 24, 2026):

```json
{
  "totalModels": 305,
  "sources": ["openrouter"],
  "byModality": {
    "vision": { "count": 110, "priceRange": { "min": 0.04, "max": 150 } },
    "text": { "count": 188, "priceRange": { "min": 0.01, "max": 30 } },
    "multimodal": { "count": 7, "priceRange": { "min": 0.3, "max": 10 } }
  }
}
```

### 5. Cache inspection and clear

```bash
whichmodel cache --stats
whichmodel cache --clear
```

Sample stats output:

```text
Cache Statistics:
  Location: /Users/oussmustaine/.cache/whichmodel

  Source         Age        TTL    Models
  ───────────────────────────────────────
  fal            17m ago    3600s  2
  openrouter     16m ago    3600s  305
  replicate      17m ago    3600s  2
```

### 6. Update default recommender model

```bash
whichmodel --update-recommender
```

This analyzes current catalog candidates and updates your config only when a better default is found.

## Main Options

- `--json`: JSON output
- `--verbose`: add token/cost/timing metadata
- `--modality <type>`: force modality
- `--max-price <number>`: max unit price filter
- `--min-context <tokens>`: min context length filter
- `--min-resolution <WxH>`: min resolution filter for image/video
- `--exclude <ids>`: exclude model IDs (comma-separated, supports `*` suffix wildcard)
- `--sources <list>`: catalog sources (comma-separated)
- `--model <id>`: override recommender model
- `--estimate <workload>`: workload-based estimated costs
- `--no-color`: disable color output
- `--no-cache`: bypass cache and fetch fresh catalogs
- `--update-recommender`: update default recommender model

Global flags like `--json`, `--no-color`, and `--no-cache` apply to subcommands too.

## Sources

Currently supported:
- `openrouter`
- `fal`
- `replicate`

Recognized but not yet implemented:
- `elevenlabs`
- `together`

Default source is `openrouter`.

## API Keys

Required for recommendation and compare:
- `OPENROUTER_API_KEY`

Optional by source:
- `FAL_API_KEY`
- `REPLICATE_API_TOKEN`

Notes:
- `list` and `stats` can run without `OPENROUTER_API_KEY` using public OpenRouter catalog access.
- `compare` and default recommendation flow require `OPENROUTER_API_KEY`.

## Modalities

- `text`
- `image`
- `video`
- `audio_tts`
- `audio_stt`
- `audio_generation`
- `vision`
- `embedding`
- `multimodal`

## Development

Install dependencies:

```bash
npm install
```

Run dev mode:

```bash
npm run dev -- "generate product photos" --json
```

Catalog fetch script:

```bash
npm run catalog:fetch -- --sources openrouter
npm run catalog:fetch -- --sources openrouter,fal
npm run catalog:fetch -- --sources openrouter,replicate
```

Quality checks:

```bash
npm run lint
npm test
npm run test:coverage
npm run build
```

## Author

Oussama Nahiz
