# Output Examples

> **Version:** 1.1
> **Last Updated:** 2026-02-24
> **Status:** Stable (v1.0.0)

## Recommendation (Terminal)

Command:

```bash
whichmodel "summarize legal contracts and flag risks"
```

Example:

```text
🔍 Task Analysis
   Modality: TEXT
   Analyze legal contract text to produce summaries and identify potential risks.
   The task involves processing and analyzing textual legal documents.

💰 Cheapest — openrouter::liquid/lfm-2.2-6b
   $0.01 per 1M prompt tokens, $0.02 per 1M completion tokens.
   Extremely low cost per token...
   Est. $0.05 for processing a 10-page contract (~25k tokens) and generating a 500-token summary.

⚖️ Balanced — openrouter::deepseek/deepseek-v3.2
   $0.26 per 1M prompt tokens, $0.38 per 1M completion tokens.
   Excellent balance of cost and capability...
   Est. $0.10 for processing a 10-page contract...

🏆 Best — openrouter::qwen/qwen3-max-thinking
   $1.20 per 1M prompt tokens, $6.00 per 1M completion tokens.
   Top-tier reasoning model for nuanced legal risk extraction...
   Est. $0.45 for processing a complex 50-page contract...

⚡ This recommendation cost $0.0075 (deepseek/deepseek-v3.2)
```

## Recommendation (`--json`)

```bash
whichmodel "summarize legal contracts and flag risks" --json
```

```json
{
  "task": "summarize legal contracts and flag risks",
  "taskAnalysis": {
    "summary": "...",
    "detectedModality": "text",
    "modalityReasoning": "...",
    "keyRequirements": ["..."],
    "costFactors": "..."
  },
  "recommendations": {
    "cheapest": { "id": "...", "reason": "...", "pricingSummary": "...", "estimatedCost": "..." },
    "balanced": { "id": "...", "reason": "...", "pricingSummary": "...", "estimatedCost": "..." },
    "best": { "id": "...", "reason": "...", "pricingSummary": "...", "estimatedCost": "..." }
  },
  "alternativesInOtherModalities": null,
  "meta": {
    "recommenderModel": "deepseek/deepseek-v3.2",
    "recommendationCostUsd": 0.007495,
    "promptTokens": 29144,
    "completionTokens": 550,
    "recommendationLatencyMs": 14534,
    "catalogSources": ["openrouter"],
    "catalogTotalModels": 305,
    "catalogModelsInModality": 188,
    "timestamp": "2026-02-24T04:41:43.283Z",
    "version": "1.0.0"
  }
}
```

## List (`--json`)

```bash
whichmodel list --source openrouter --limit 2 --json
```

```json
{
  "models": [
    {
      "id": "openrouter::liquid/lfm2-8b-a1b",
      "name": "LiquidAI: LFM2-8B-A1B",
      "pricing": "$0.01 / $0.02",
      "context": 32768,
      "modality": "text",
      "source": "openrouter"
    }
  ],
  "count": 1
}
```

## Stats (`--json`)

```bash
whichmodel stats --json
```

```json
{
  "totalModels": 305,
  "sources": ["openrouter"],
  "byModality": {
    "text": {
      "count": 188,
      "priceRange": {
        "min": 0.01,
        "max": 30
      }
    }
  },
  "configuredSources": ["openrouter"],
  "missingSources": [
    {
      "name": "fal",
      "envVar": "FAL_API_KEY",
      "getUrl": "https://fal.ai/dashboard/keys"
    }
  ]
}
```

## Error Output

```text
Error: OPENROUTER_API_KEY is not set.
Set OPENROUTER_API_KEY and retry.
```
