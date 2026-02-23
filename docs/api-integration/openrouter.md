# OpenRouter Catalog API Integration

> **Version:** 1.0
> **Last Updated:** 2025-02-23
> **Status:** Production (Phase 1)

---

## Overview

OpenRouter provides a unified API for accessing 300+ AI models from various providers. The catalog endpoint returns metadata about all available models including pricing, capabilities, and context lengths.

---

## API Endpoint

### List Models

```
GET https://openrouter.ai/api/v1/models
```

**Authentication:** Not required for listing models (public endpoint)

**Rate Limit:** Not documented, assume ~60 requests/minute

**Timeout Recommendation:** 10 seconds

---

## Request

### Headers

```http
Accept: application/json
```

No authentication required for the catalog endpoint.

### Parameters

None - the endpoint returns all available models.

### Example Request

```bash
curl -s "https://openrouter.ai/api/v1/models" | jq '.data[0]'
```

---

## Response

### Schema

```typescript
interface OpenRouterResponse {
  data: OpenRouterModel[];
}

interface OpenRouterModel {
  id: string;                    // e.g., "anthropic/claude-sonnet-4"
  name: string;                  // e.g., "Claude Sonnet 4"
  description?: string;          // Model description
  context_length: number;        // Max context in tokens
  pricing: {
    prompt: string;              // Price per token (as string)
    completion: string;          // Price per token (as string)
    image?: string;              // Price per image (for image models)
    request?: string;            // Price per request (if applicable)
  };
  architecture?: {
    modality?: string;           // e.g., "text->text"
    tokenizer?: string;
    instruct_type?: string;
    input_modalities?: string[]; // e.g., ["text", "image"]
    output_modalities?: string[]; // e.g., ["text"]
  };
  top_provider?: {
    context_length?: number;
    max_completion_tokens?: number;
    is_moderated?: boolean;
  };
  per_request_limits?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
}
```

### Example Response (Truncated)

```json
{
  "data": [
    {
      "id": "anthropic/claude-sonnet-4",
      "name": "Claude Sonnet 4",
      "description": "Claude Sonnet 4 delivers exceptional performance...",
      "context_length": 200000,
      "pricing": {
        "prompt": "0.000003",
        "completion": "0.000015"
      },
      "architecture": {
        "modality": "text->text",
        "tokenizer": "Claude",
        "instruct_type": "chat",
        "input_modalities": ["text", "image"],
        "output_modalities": ["text"]
      },
      "top_provider": {
        "context_length": 200000,
        "max_completion_tokens": 16384,
        "is_moderated": false
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
    }
  ]
}
```

---

## Field Mapping: OpenRouter → ModelEntry

| OpenRouter Field | ModelEntry Field | Transformation |
|-----------------|------------------|----------------|
| `id` | `id` | Prefix with `openrouter::` |
| - | `source` | Always `"openrouter"` |
| `name` | `name` | Direct copy |
| - | `modality` | Derived from `input_modalities` + `output_modalities` |
| `architecture.input_modalities` | `inputModalities` | Default to `["text"]` if missing |
| `architecture.output_modalities` | `outputModalities` | Default to `["text"]` if missing |
| `pricing.prompt` | `pricing.promptPer1mTokens` | Parse string, multiply by 1,000,000 |
| `pricing.completion` | `pricing.completionPer1mTokens` | Parse string, multiply by 1,000,000 |
| `context_length` | `contextLength` | Direct copy |
| `id.split("/")[0]` | `provider` | Extract from model ID |
| - | `family` | Extract from model name (claude, gpt, etc.) |
| - | `pricing.type` | Always `"text"` for OpenRouter models |

---

## Modality Classification Logic

```typescript
function classifyModality(input: string[], output: string[]): Modality {
  // Output-based classification (priority)
  if (output.includes("image")) return "image";
  if (output.includes("video")) return "video";
  if (output.includes("audio")) return "audio_tts";

  // Input-based classification
  if (input.includes("image") && output.includes("text")) return "vision";

  // Default
  return "text";
}
```

### Examples

| input_modalities | output_modalities | Result |
|-----------------|-------------------|--------|
| `["text"]` | `["text"]` | `text` |
| `["text", "image"]` | `["text"]` | `vision` |
| `["text"]` | `["image"]` | `image` |
| `["text"]` | `["audio"]` | `audio_tts` |

---

## Edge Cases

### 1. Models with Zero Pricing

Some models have `"0"` for both prompt and completion pricing.

**Action:** Filter out these models - they're typically:
- Deprecated models
- Provider-specific free tiers with limitations
- Placeholder entries

```typescript
if (promptPrice === 0 && completionPrice === 0) {
  return null; // Skip this model
}
```

### 2. Missing `architecture` Field

Some older models may not have the `architecture` object.

**Action:** Default to text modality:

```typescript
const inputMod = raw.architecture?.input_modalities ?? ["text"];
const outputMod = raw.architecture?.output_modalities ?? ["text"];
```

### 3. Missing `context_length`

Some models may have `null` or `0` for context_length.

**Action:** Set to `undefined` in ModelEntry:

```typescript
contextLength: raw.context_length > 0 ? raw.context_length : undefined
```

### 4. Pricing as String

OpenRouter returns pricing as strings (e.g., `"0.000003"`).

**Action:** Parse and convert:

```typescript
const promptPrice = parseFloat(raw.pricing?.prompt ?? "0");
const promptPer1m = promptPrice * 1_000_000; // $3.00 per 1M tokens
```

### 5. Very Long Model Names

Some model names include version strings that are very long.

**Action:** Use as-is for now; display layer handles truncation.

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Parse response |
| 401 | Unauthorized | Log warning (shouldn't happen for public endpoint) |
| 429 | Rate Limited | Retry with exponential backoff (1s, 2s, 4s) |
| 500-503 | Server Error | Retry once, then use cache if available |
| Timeout | Network issue | Use cache if available, else fail |

### Retry Strategy

```
Attempt 1: Immediate
Attempt 2: Wait 1 second
Attempt 3: Wait 2 seconds
Then: Use cache or fail with exit code 4
```

---

## Sample Implementation

```typescript
import type { CatalogSource, ModelEntry } from "../types.js";

interface OpenRouterModel {
  id: string;
  name: string;
  pricing: { prompt: string; completion: string };
  context_length: number;
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
  };
}

interface OpenRouterResponse {
  data: OpenRouterModel[];
}

export class OpenRouterCatalog implements CatalogSource {
  readonly sourceId = "openrouter";

  async fetch(): Promise<ModelEntry[]> {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      throw new Error(`OpenRouter API error: ${res.status}`);
    }

    const { data } = (await res.json()) as OpenRouterResponse;

    return data
      .map((m) => this.normalize(m))
      .filter((m): m is ModelEntry => m !== null);
  }

  private normalize(raw: OpenRouterModel): ModelEntry | null {
    const promptPrice = parseFloat(raw.pricing?.prompt ?? "0");
    const completionPrice = parseFloat(raw.pricing?.completion ?? "0");

    // Skip models with no pricing
    if (promptPrice === 0 && completionPrice === 0) return null;

    const inputMod = raw.architecture?.input_modalities ?? ["text"];
    const outputMod = raw.architecture?.output_modalities ?? ["text"];

    return {
      id: `openrouter::${raw.id}`,
      source: "openrouter",
      name: raw.name,
      modality: this.classifyModality(inputMod, outputMod),
      inputModalities: inputMod,
      outputModalities: outputMod,
      pricing: {
        type: "text",
        promptPer1mTokens: this.round(promptPrice * 1_000_000, 4),
        completionPer1mTokens: this.round(completionPrice * 1_000_000, 4),
      },
      contextLength: raw.context_length > 0 ? raw.context_length : undefined,
      provider: raw.id.split("/")[0] ?? "unknown",
      family: this.extractFamily(raw.id),
    };
  }

  private classifyModality(input: string[], output: string[]): Modality {
    if (output.includes("image")) return "image";
    if (output.includes("video")) return "video";
    if (output.includes("audio")) return "audio_tts";
    if (input.includes("image") && output.includes("text")) return "vision";
    return "text";
  }

  private extractFamily(id: string): string {
    const name = id.split("/")[1]?.toLowerCase() ?? "";
    if (name.includes("claude")) return "claude";
    if (name.includes("gpt")) return "gpt";
    if (name.includes("gemini")) return "gemini";
    if (name.includes("deepseek")) return "deepseek";
    if (name.includes("llama")) return "llama";
    if (name.includes("qwen")) return "qwen";
    if (name.includes("mistral")) return "mistral";
    return "other";
  }

  private round(n: number, decimals: number): number {
    const factor = 10 ** decimals;
    return Math.round(n * factor) / factor;
  }
}
```

---

## Testing

### Unit Test Cases

1. **Happy path:** Valid response with multiple models
2. **Zero pricing:** Model with `"0"` pricing is filtered out
3. **Missing architecture:** Model defaults to text modality
4. **Vision model:** Model with image input correctly classified as "vision"
5. **Image generation:** Model with image output correctly classified as "image"
6. **Family extraction:** Various model IDs correctly map to families

### Integration Test Cases

1. **Live API call:** Fetch and verify at least 100 models returned
2. **Rate limiting:** Rapid calls don't cause 429 (within reason)
3. **Timeout handling:** Simulated timeout triggers retry

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-02-23 | Initial documentation |
