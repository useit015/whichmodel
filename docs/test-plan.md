# Test Plan

> **Version:** 1.0
> **Last Updated:** 2025-02-23
> **Status:** Production (Phase 1)

---

## Overview

This document defines the testing strategy for `whichmodel`, including unit tests, integration tests, and mock data requirements.

---

## Testing Framework

- **Framework:** Vitest
- **Coverage Tool:** Vitest coverage (c8)
- **Mocking:** `vi.fn()`, `vi.stubGlobal()`
- **Snapshot Testing:** For output format validation

---

## Unit Tests

### 1. Catalog Module

#### `src/catalog/openrouter.ts`

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| Normalizes model correctly | Valid OpenRouter model | ModelEntry with all fields |
| Filters zero-pricing models | Model with 0/0 pricing | Returns null |
| Classifies text modality | `input: ["text"], output: ["text"]` | Modality: `text` |
| Classifies vision modality | `input: ["text", "image"], output: ["text"]` | Modality: `vision` |
| Classifies image modality | `input: ["text"], output: ["image"]` | Modality: `image` |
| Handles missing architecture | Model without architecture field | Defaults to `["text"]` |
| Handles null context_length | Model with `context_length: null` | `contextLength: undefined` |
| Extracts family correctly | `anthropic/claude-sonnet-4` | Family: `claude` |
| Extracts provider correctly | `anthropic/claude-sonnet-4` | Provider: `anthropic` |
| Handles API error | HTTP 500 response | Throws error |
| Handles timeout | Request > 10s | Throws timeout error |

```typescript
// tests/catalog/openrouter.test.ts
import { describe, it, expect, vi } from "vitest";
import { OpenRouterCatalog } from "../../src/catalog/openrouter.js";

describe("OpenRouterCatalog", () => {
  it("normalizes model to ModelEntry", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [{
          id: "anthropic/claude-sonnet-4",
          name: "Claude Sonnet 4",
          pricing: { prompt: "0.000003", completion: "0.000015" },
          context_length: 200000,
          architecture: {
            input_modalities: ["text", "image"],
            output_modalities: ["text"],
          },
        }],
      }),
    }));

    const catalog = new OpenRouterCatalog();
    const models = await catalog.fetch();

    expect(models).toHaveLength(1);
    expect(models[0]).toMatchObject({
      id: "openrouter::anthropic/claude-sonnet-4",
      source: "openrouter",
      modality: "vision",
      pricing: {
        type: "text",
        promptPer1mTokens: 3.0,
        completionPer1mTokens: 15.0,
      },
    });
  });
});
```

#### `src/catalog/compressor.ts`

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| Compresses model entry | Full ModelEntry | CompressedModel with fewer fields |
| Groups by modality | Array of models | Object keyed by modality |
| Preserves essential fields | Model with all fields | id, name, modality, pricing preserved |

---

### 2. Recommender Module

#### `src/recommender/prompts.ts`

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| Builds system prompt | None | Full system prompt string |
| Builds user prompt | Task + grouped models | Formatted user prompt |
| Includes constraints | Task + maxPrice constraint | Constraint in prompt |
| Handles no constraints | Task + no constraints | "None" for constraints |

#### `src/recommender/validator.ts`

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| Validates correct IDs | Recommendation with valid IDs | `{ valid: true }` |
| Catches invalid IDs | Recommendation with fake ID | `{ valid: false, invalidIds: [...] }` |
| Finds closest match | Invalid ID + valid ID set | Closest matching ID |
| Returns null for no match | Completely different ID | null |

```typescript
// tests/recommender/validator.test.ts
import { describe, it, expect } from "vitest";
import { validateRecommendation, findClosestModelId } from "../../src/recommender/validator.js";

describe("validateRecommendation", () => {
  it("validates correct model IDs", () => {
    const rec = {
      recommendations: {
        cheapest: { id: "openrouter::anthropic/claude-sonnet-4" },
        balanced: { id: "openrouter::openai/gpt-4o" },
        best: { id: "openrouter::google/gemini-2.5-pro" },
      },
    };

    const validIds = new Set([
      "openrouter::anthropic/claude-sonnet-4",
      "openrouter::openai/gpt-4o",
      "openrouter::google/gemini-2.5-pro",
    ]);

    const result = validateRecommendation(rec, validIds);
    expect(result.valid).toBe(true);
  });

  it("catches invalid model IDs", () => {
    const rec = {
      recommendations: {
        cheapest: { id: "fake::model/does-not-exist" },
        balanced: { id: "openrouter::openai/gpt-4o" },
        best: { id: "openrouter::google/gemini-2.5-pro" },
      },
    };

    const result = validateRecommendation(rec, validIds);
    expect(result.valid).toBe(false);
    expect(result.invalidIds).toContain("fake::model/does-not-exist");
  });
});
```

#### `src/recommender/fallback.ts`

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| Sorts by price | Array of models | Price-sorted array |
| Detects modality from keywords | "generate images" | `image` |
| Returns 3 tiers | Array of 10 models | cheapest, balanced, best |

---

### 3. Formatter Module

#### `src/formatter/pricing.ts`

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| Formats text pricing | TextPricing | "$3.00 / $15.00 per 1M tokens (in/out)" |
| Formats image pricing (per image) | ImagePricing with perImage | "$0.04 / image" |
| Formats image pricing (per MP) | ImagePricing with perMegapixel | "$0.02 / megapixel" |
| Formats video pricing | VideoPricing | "$0.10 / second" |
| Formats audio pricing (TTS) | AudioPricing with perCharacter | "$0.030 / 1K characters" |
| Formats audio pricing (STT) | AudioPricing with perMinute | "$0.006 / minute" |
| Formats embedding pricing | EmbeddingPricing | "$0.02 / 1M tokens" |

#### `src/formatter/terminal.ts`

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| Formats full recommendation | Recommendation object | Multi-line formatted string |
| Includes all tiers | Recommendation | cheapest, balanced, best sections |
| Includes task analysis | Recommendation with analysis | Analysis section at top |
| Includes metadata | Recommendation + meta | Cost line at bottom |
| Handles null alternatives | alternativesInOtherModalities: null | No tip section |

---

### 4. Config Module

#### `src/config.ts`

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| Loads from env | OPENROUTER_API_KEY set | Config with apiKey |
| Uses defaults | No env vars | Config with default values |
| Validates missing key | No OPENROUTER_API_KEY | Returns error string |
| Validates key format | Key starting with sk-or- | Returns null (valid) |
| Warns on bad format | Key not starting with sk-or- | Returns warning |

---

## Integration Tests

### 1. Full Flow

| Test | Mock | Verification |
|------|------|--------------|
| Text task recommendation | OpenRouter catalog + LLM | Valid Recommendation object |
| JSON output | OpenRouter catalog + LLM | Valid JSON string |
| Verbose output | OpenRouter catalog + LLM | Output includes timing details |
| With constraints | OpenRouter catalog + LLM | Models match constraints |

### 2. Error Handling

| Test | Scenario | Verification |
|------|----------|--------------|
| API key missing | No OPENROUTER_API_KEY | Exit code 3, error message |
| Catalog fetch fails | HTTP 500 from OpenRouter | Retry, then exit code 4 |
| LLM timeout | LLM takes > 30s | Retry, then fallback mode |
| Invalid JSON from LLM | LLM returns garbage | Retry, then fallback mode |

### 3. Modality Detection

Test with 20+ task descriptions:

| Task Description | Expected Modality |
|-----------------|-------------------|
| "write video scripts for YouTube" | `text` |
| "generate product photos" | `image` |
| "create 15-second ad clips" | `video` |
| "transcribe my podcast" | `audio_stt` |
| "add voiceover to blog posts" | `audio_tts` |
| "analyze screenshots" | `vision` |
| "build semantic search" | `embedding` |
| "generate background music" | `audio_generation` |
| "write marketing emails" | `text` |
| "summarize legal contracts" | `text` |
| "create pixel art sprites" | `image` |
| "convert images to video" | `video` |
| "clone a voice from samples" | `audio_tts` |
| "extract text from PDFs" | `vision` |
| "build a chatbot" | `text` |
| "generate logo designs" | `image` |
| "analyze competitor websites" | `vision` |
| "create vector embeddings" | `embedding` |
| "make anime-style avatars" | `image` |
| "caption videos with subtitles" | `audio_stt` |

---

## Mock Data

### `fixtures/openrouter-catalog.json`

A representative sample of OpenRouter API response:

```json
{
  "data": [
    {
      "id": "anthropic/claude-sonnet-4",
      "name": "Claude Sonnet 4",
      "context_length": 200000,
      "pricing": {
        "prompt": "0.000003",
        "completion": "0.000015"
      },
      "architecture": {
        "input_modalities": ["text", "image"],
        "output_modalities": ["text"]
      }
    },
    {
      "id": "openai/gpt-4o",
      "name": "GPT-4o",
      "context_length": 128000,
      "pricing": {
        "prompt": "0.0000025",
        "completion": "0.00001"
      },
      "architecture": {
        "input_modalities": ["text", "image"],
        "output_modalities": ["text"]
      }
    },
    {
      "id": "deepseek/deepseek-v3.2",
      "name": "DeepSeek V3.2",
      "context_length": 164000,
      "pricing": {
        "prompt": "0.00000026",
        "completion": "0.00000038"
      },
      "architecture": {
        "input_modalities": ["text"],
        "output_modalities": ["text"]
      }
    },
    {
      "id": "google/gemini-2.5-flash",
      "name": "Gemini 2.5 Flash",
      "context_length": 1000000,
      "pricing": {
        "prompt": "0.00000015",
        "completion": "0.0000006"
      },
      "architecture": {
        "input_modalities": ["text", "image"],
        "output_modalities": ["text"]
      }
    },
    {
      "id": "meta-llama/llama-3.3-70b-instruct",
      "name": "Llama 3.3 70B Instruct",
      "context_length": 128000,
      "pricing": {
        "prompt": "0.00000035",
        "completion": "0.0000004"
      },
      "architecture": {
        "input_modalities": ["text"],
        "output_modalities": ["text"]
      }
    },
    {
      "id": "zero-pricing/model",
      "name": "Zero Pricing Model",
      "context_length": 4096,
      "pricing": {
        "prompt": "0",
        "completion": "0"
      }
    }
  ]
}
```

### `fixtures/recommendation-response.json`

A sample LLM recommendation response:

```json
{
  "taskAnalysis": {
    "summary": "Legal document summarization with risk identification",
    "detectedModality": "text",
    "modalityReasoning": "Task requires text output summarizing legal documents",
    "keyRequirements": ["long context", "reasoning", "accuracy"],
    "costFactors": "Input-heavy, documents can be 50+ pages"
  },
  "recommendations": {
    "cheapest": {
      "id": "openrouter::deepseek/deepseek-v3.2",
      "reason": "Strong reasoning at lowest price. 164K context handles most contracts.",
      "pricingSummary": "$0.26 / $0.38 per 1M tokens (in/out)",
      "estimatedCost": "~$8/mo for 200 contracts"
    },
    "balanced": {
      "id": "openrouter::google/gemini-2.5-flash",
      "reason": "Million-token context, no chunking needed.",
      "pricingSummary": "$0.15 / $0.60 per 1M tokens (in/out)",
      "estimatedCost": "~$18/mo for 200 contracts"
    },
    "best": {
      "id": "openrouter::anthropic/claude-sonnet-4",
      "reason": "Best-in-class document comprehension.",
      "pricingSummary": "$3.00 / $15.00 per 1M tokens (in/out)",
      "estimatedCost": "~$420/mo for 200 contracts"
    }
  },
  "alternativesInOtherModalities": null
}
```

---

## Coverage Targets

| Module | Target | Priority |
|--------|--------|----------|
| `catalog/openrouter.ts` | >90% | Critical |
| `catalog/compressor.ts` | >95% | Critical |
| `recommender/prompts.ts` | >90% | Critical |
| `recommender/validator.ts` | >95% | Critical |
| `recommender/fallback.ts` | >90% | High |
| `formatter/pricing.ts` | >95% | Critical |
| `formatter/terminal.ts` | >85% | High |
| `config.ts` | >95% | Critical |
| `cli.ts` | >80% | Medium |

**Overall target: >85%**

---

## CI/CD Test Commands

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- catalog/openrouter.test.ts

# Run in watch mode
npm run test:watch

# Run integration tests only
npm test -- --grep "integration"

# Generate coverage report
npm run test:coverage && open coverage/index.html
```

---

## Smoke Tests (Manual)

After deployment, run these manually:

```bash
# Basic text task
whichmodel "summarize legal contracts"

# JSON output
whichmodel "write marketing emails" --json

# Verbose mode
whichmodel "build a chatbot" --verbose

# With constraint
whichmodel "analyze documents" --max-price 1.0

# Force modality
whichmodel "create graphics" --modality image

# Error cases
whichmodel                          # Missing task
whichmodel "test" --modality foo    # Invalid modality
OPENROUTER_API_KEY= whichmodel "test"  # Missing key
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-02-23 | Initial test plan |
