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

```bash
whichmodel "summarize legal contracts and flag risks" --no-color --no-cache
```

Sample output:

```text
- Fetching model catalog...
🔍 Task Analysis
   Modality: TEXT
   Analyze text-based legal contracts to produce summaries and identify potential risks.
   The task involves processing and understanding written legal language (contracts) to generate textual summaries and risk assessments. No image, audio, or video input is mentioned.

💰 Cheapest — openrouter::liquid/lfm2-8b-a1b
   $0.01 per 1M prompt tokens, $0.02 per 1M completion tokens
   Extremely low cost ($0.01/$0.02 per 1M tokens) makes it viable for bulk processing of simple contracts where basic summarization is acceptable. However, its small 8B parameter size and 32K context limit mean it may miss nuanced legal risks and struggle with very long documents.
   Est. $0.15 for processing ten 50k-token contracts (500k input tokens) and generating 25k tokens of summary/risk output.

⚖️ Balanced — openrouter::deepseek/deepseek-v3.2
   $0.26 per 1M prompt tokens, $0.38 per 1M completion tokens
   Excellent balance of cost, strong reasoning (DeepSeek family), and a 163K context window. At $0.26/$0.38 per 1M tokens, it offers significantly better analytical capability than the cheapest options, making it suitable for reliable contract summarization and risk identification without premium pricing.
   Est. $2.30 for processing ten 50k-token contracts and generating detailed 50k tokens of analysis.

🏆 Best — openrouter::anthropic/claude-opus-4.6
   $5 per 1M prompt tokens, $25 per 1M completion tokens
   Claude Opus is renowned for its exceptional reasoning, nuance, and instruction-following, making it the top choice for high-stakes legal analysis. Its 1M token context handles the longest contracts. While expensive, the quality and reliability for risk flagging justify the cost for critical legal work.
   Est. $37.50 for processing one very long 200k-token contract and generating a comprehensive 10k token risk analysis.

💡 Tip: A vision model could be used if contracts are provided as scanned images or PDFs requiring OCR, but the core task of summarization and risk analysis remains textual. The provided catalog's vision models (e.g., Claude Opus 4.6 vision) could handle image input but at a higher cost for the same textual analysis capability.

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

Sample output:

```json
{
  "winner": "B",
  "reasoning": "GPT-4o is more cost-effective for code generation with lower token pricing, and its 128K context window is sufficient for writing production-ready TypeScript API code. Claude Sonnet's longer context is unnecessary overhead for this specific task.",
  "modelA": {
    "id": "openrouter::anthropic/claude-sonnet-4",
    "name": "Anthropic: Claude Sonnet 4",
    "strengths": [
      "Extremely large 1M token context window",
      "Strong reasoning capabilities for complex logic"
    ],
    "weaknesses": [
      "Higher cost per token",
      "Overkill context for typical API code"
    ],
    "estimatedCost": "$18 per 1M output tokens",
    "suitedFor": [
      "Massive document analysis",
      "Extremely long-form content generation",
      "Complex multi-step reasoning tasks"
    ]
  },
  "modelB": {
    "id": "openrouter::openai/gpt-4o",
    "name": "OpenAI: GPT-4o",
    "strengths": [
      "Lower cost per token",
      "Sufficient context for API development",
      "Fast response times"
    ],
    "weaknesses": ["Smaller context window than Claude Sonnet"],
    "estimatedCost": "$12.5 per 1M output tokens",
    "suitedFor": [
      "Code generation and review",
      "API development",
      "General programming tasks",
      "Cost-sensitive applications"
    ]
  }
}
```

### 3. List models

```bash
whichmodel list --source openrouter --limit 5 --no-cache
```

Sample output:

```text
> whichmodel@1.0.0 dev
> tsx src/index.ts list --source openrouter --limit 5 --no-color --no-cache

- Fetching catalog...
305 models (showing top 5, sorted by price)

┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ID                                           │ Name                    │ Pricing           │ Context │ Source │
├───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ openrouter::liquid/lfm2-8b-a1b               │ LiquidAI: LFM2-8B-A1B   │ $0.01 / $0.02     │ 33K     │ openrouter │
│ openrouter::liquid/lfm-2.2-6b                │ LiquidAI: LFM2-2.6B     │ $0.01 / $0.02     │ 33K     │ openrouter │
│ openrouter::ibm-granite/granite-4.0-h-micro  │ IBM: Granite 4.0 Micro  │ $0.02 / $0.11     │ 131K    │ openrouter │
│ openrouter::google/gemma-3n-e4b-it           │ Google: Gemma 3n 4B     │ $0.02 / $0.04     │ 33K     │ openrouter │
│ openrouter::meta-llama/llama-guard-3-8b      │ Llama Guard 3 8B        │ $0.02 / $0.06     │ 131K    │ openrouter │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

Use --limit 305 to show all, or filter with --modality, --source
```

JSON mode:

```bash
whichmodel list --source openrouter --limit 20 --json
```

### 4. Stats (catalog snapshot)

```bash
whichmodel stats --json --no-cache
```

Sample output:

```json
{
  "totalModels": 305,
  "sources": ["openrouter"],
  "byModality": {
    "vision": { "count": 110, "priceRange": { "min": 0.04, "max": 150 } },
    "text": { "count": 188, "priceRange": { "min": 0.01, "max": 30 } },
    "multimodal": { "count": 7, "priceRange": { "min": 0.3, "max": 10 } }
  },
  "configuredSources": ["openrouter"],
  "missingSources": [
    {
      "name": "fal",
      "envVar": "FAL_API_KEY",
      "getUrl": "https://fal.ai/dashboard/keys"
    },
    {
      "name": "replicate",
      "envVar": "REPLICATE_API_TOKEN",
      "getUrl": "https://replicate.com/account/api-tokens"
    },
    {
      "name": "elevenlabs",
      "envVar": "ELEVENLABS_API_KEY",
      "getUrl": "https://elevenlabs.io/app/settings/api-keys"
    },
    {
      "name": "together",
      "envVar": "TOGETHER_API_KEY",
      "getUrl": "https://api.together.xyz/settings/api-keys"
    }
  ]
}
```

### 5. Cache inspection and clear

```bash
whichmodel cache --stats
whichmodel cache --clear
```

Example output:

```text
Cache Statistics:
  Location: ~/.cache/whichmodel

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
