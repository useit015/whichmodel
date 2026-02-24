# whichmodel

`whichmodel` is a CLI that tells you which AI model to use for a task.

Describe what you want to build, and it returns 3 practical recommendations:
- cheapest
- balanced
- best

It supports text, image, video, audio, vision, embedding, and multimodal workloads.

## Why Use It

Choosing a model is hard because price, quality, and capabilities change fast. `whichmodel` helps you decide quickly with live catalog data and task-aware reasoning.

Good for:
- picking a model before building a feature
- comparing cost/performance tradeoffs
- automating model selection in scripts/agents

## Status

- Version: `1.0.0`
- Release: Stable
- Runtime: Node.js 20+

## Install

```bash
npm install -g whichmodel
```

Or run without install:

```bash
npx whichmodel "summarize legal contracts"
```

## Quick Start

```bash
export OPENROUTER_API_KEY="sk-or-v1-..."
whichmodel "summarize legal contracts and flag risks"
```

Get JSON:

```bash
whichmodel "summarize legal contracts and flag risks" --json
```

Include extra metadata (tokens/cost/timing):

```bash
whichmodel "summarize legal contracts and flag risks" --verbose
```

## Example Result (Terminal)

```text
🔍 Task Analysis
   Modality: TEXT
   Analyze legal contract text to produce summaries and identify potential risks.

💰 Cheapest — openrouter::liquid/lfm-2.2-6b
   Very low cost, acceptable for basic summarization tasks.

⚖️ Balanced — openrouter::deepseek/deepseek-v3.2
   Strong reasoning quality at a low price.

🏆 Best — openrouter::qwen/qwen3-max-thinking
   Highest quality for nuanced legal analysis.

⚡ This recommendation cost $0.0075 (deepseek/deepseek-v3.2)
```

## Example Result (`--json`)

```json
{
  "task": "summarize legal contracts and flag risks",
  "taskAnalysis": {
    "detectedModality": "text"
  },
  "recommendations": {
    "cheapest": { "id": "openrouter::liquid/lfm-2.2-6b" },
    "balanced": { "id": "openrouter::deepseek/deepseek-v3.2" },
    "best": { "id": "openrouter::qwen/qwen3-max-thinking" }
  },
  "meta": {
    "recommenderModel": "deepseek/deepseek-v3.2",
    "recommendationCostUsd": 0.007495,
    "version": "1.0.0"
  }
}
```

## Commands

### Recommend (default)

```bash
whichmodel [task...] [options]
```

### Compare

```bash
whichmodel compare <modelA> <modelB> --task "..." [--json]
```

`compare` requires `OPENROUTER_API_KEY` because it runs an LLM comparison pass.

### List

```bash
whichmodel list [--modality <type>] [--source <name>] [--sort <price|name|context>] [--limit <n>] [--json]
```

### Stats

```bash
whichmodel stats [--json]
```

### Cache

```bash
whichmodel cache --stats
whichmodel cache --clear
```

## Main Options

- `--json`: JSON output
- `--verbose`: include extra recommendation metadata
- `--modality <type>`: force modality
- `--max-price <number>`: max unit price filter
- `--min-context <tokens>`: min context length filter
- `--min-resolution <WxH>`: min resolution filter for image/video
- `--exclude <ids>`: exclude IDs (comma-separated, supports `*` suffix wildcard)
- `--sources <list>`: catalog sources (comma-separated)
- `--model <id>`: override recommender model
- `--estimate <workload>`: workload-based cost estimation
- `--no-color`: disable colored output
- `--no-cache`: bypass cache and fetch fresh catalog
- `--update-recommender`: update default recommender model in config

Global options like `--json`, `--no-color`, and `--no-cache` apply to subcommands.

## Sources

Supported:
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

`list` and `stats` can run without `OPENROUTER_API_KEY` when using OpenRouter's public catalog access.

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

Install deps:

```bash
npm install
```

Run in dev mode:

```bash
npm run dev -- "generate product photos" --json
```

Fetch catalogs directly:

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
