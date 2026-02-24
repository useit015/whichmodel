# whichmodel

`whichmodel` is a TypeScript CLI that recommends AI models from a natural-language task.

It fetches live catalogs, analyzes your task, and returns 3 picks:
- Cheapest
- Balanced
- Best

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

JSON output:

```bash
whichmodel "summarize legal contracts and flag risks" --json
```

Verbose metadata:

```bash
whichmodel "summarize legal contracts and flag risks" --verbose
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

Note: `compare` requires `OPENROUTER_API_KEY` because it uses an LLM comparison pass.

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
- `--verbose`: include tokens/cost/timing on recommendation output
- `--modality <type>`: force modality
- `--max-price <number>`: max unit price filter
- `--min-context <tokens>`: min context length filter
- `--min-resolution <WxH>`: min image/video resolution filter
- `--exclude <ids>`: exclude IDs (comma-separated, supports `*` suffix wildcard)
- `--sources <list>`: catalog sources (comma-separated)
- `--model <id>`: override recommender model
- `--estimate <workload>`: override estimated costs with workload-based estimates
- `--no-color`: disable colored output
- `--no-cache`: force fresh catalog fetch and bypass cache
- `--update-recommender`: update default recommender model in config

Global options like `--json`, `--no-color`, and `--no-cache` apply to subcommands as well.

## Sources

Supported now:
- `openrouter`
- `fal`
- `replicate`

Known but not implemented yet:
- `elevenlabs`
- `together`

Default source is `openrouter`.

## API Keys

Required for recommendation and compare:
- `OPENROUTER_API_KEY`

Optional by source:
- `FAL_API_KEY`
- `REPLICATE_API_TOKEN`

`list` and `stats` can run without `OPENROUTER_API_KEY` when using public OpenRouter catalog access.

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
