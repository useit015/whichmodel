# whichmodel

`whichmodel` is a TypeScript CLI that recommends AI models from a natural-language task description.

It fetches live model catalogs, analyzes your task, and returns three picks:
- Cheapest
- Balanced
- Best

## Requirements

- Node.js 20+
- `OPENROUTER_API_KEY` (required for recommendations)
- Optional source keys:
  - `FAL_API_KEY`
  - `REPLICATE_API_TOKEN`

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
export OPENROUTER_API_KEY="sk-or-..."

whichmodel "summarize legal contracts and flag risks"
```

JSON output:

```bash
whichmodel "summarize legal contracts and flag risks" --json
```

Verbose output (tokens, cost, timing):

```bash
whichmodel "summarize legal contracts and flag risks" --verbose
```

## Catalog Sources

Use `--sources` to control catalog providers:

```bash
whichmodel "generate product photos" --sources openrouter,fal
whichmodel "transcribe podcast episodes" --sources openrouter,replicate
```

Currently supported:
- `openrouter`
- `fal`
- `replicate`

Known but not yet implemented:
- `elevenlabs`
- `together`

## Main Options

- `--json` output JSON payload
- `--verbose` include token usage, recommendation cost, and timing
- `--modality <type>` force modality
- `--max-price <number>` filter by max unit price
- `--min-context <tokens>` filter by minimum context length
- `--min-resolution <WxH>` filter image/video resolution
- `--exclude <ids>` exclude model ids (supports `*` suffix wildcard)
- `--sources <list>` comma-separated catalog sources
- `--model <id>` override recommender model
- `--no-color` disable terminal colors

## Modalities

Supported modalities:
- `text`
- `image`
- `video`
- `audio_tts`
- `audio_stt`
- `audio_generation`
- `vision`
- `embedding`
- `multimodal`

## Subcommands

These are defined but not implemented yet:
- `whichmodel compare <modelA> <modelB> --task "..."`
- `whichmodel list`
- `whichmodel stats`

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

Run tests, lint, and build:

```bash
npm test
npm run lint
npm run build
```
