# OpenRouter LLM API Integration (Recommender)

> **Version:** 1.0
> **Last Updated:** 2025-02-23
> **Status:** Production (Phase 1)

---

## Overview

The recommender engine uses OpenRouter's chat completion API to analyze tasks and recommend models. We use a cheap model (DeepSeek V3.2) for cost efficiency while maintaining recommendation quality.

---

## API Endpoint

### Chat Completions

```
POST https://openrouter.ai/api/v1/chat/completions
```

**Authentication:** Required (Bearer token)

**Rate Limit:** Varies by account, assume ~60 requests/minute

**Timeout Recommendation:** 30 seconds (LLM inference can be slow)

---

## Authentication

### Required Headers

```http
Authorization: Bearer sk-or-...
Content-Type: application/json
HTTP-Referer: https://github.com/whichmodel/whichmodel  # Optional, for rankings
X-Title: whichmodel CLI                                  # Optional, for rankings
```

### Getting an API Key

1. Visit https://openrouter.ai/keys
2. Create an account or sign in
3. Generate a new API key
4. Set environment variable:

```bash
export OPENROUTER_API_KEY=sk-or-...
```

---

## Request

### Schema

```typescript
interface OpenRouterChatRequest {
  /** Model to use for completion */
  model: string;

  /** Conversation messages */
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;

  /** Force JSON output */
  response_format?: { type: "json_object" };

  /** Sampling temperature (0-2, default 1) */
  temperature?: number;

  /** Maximum tokens in response */
  max_tokens?: number;
}
```

### Default Model Selection

| Priority | Model | Cost (per 1M tokens) | Use Case |
|----------|-------|---------------------|----------|
| 1 (default) | `deepseek/deepseek-v3.2` | $0.26 / $0.38 | Best value, good reasoning |
| 2 (fallback) | `openai/gpt-4o-mini` | $0.15 / $0.60 | If DeepSeek unavailable |

### Example Request

```json
{
  "model": "deepseek/deepseek-v3.2",
  "messages": [
    {
      "role": "system",
      "content": "You are an expert AI model selector..."
    },
    {
      "role": "user",
      "content": "## Task Description\nsummarize legal contracts\n\n## Available Models\n..."
    }
  ],
  "response_format": { "type": "json_object" },
  "temperature": 0.3
}
```

---

## Response

### Schema

```typescript
interface OpenRouterChatResponse {
  id: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;  // JSON string when response_format is set
    };
    finish_reason: "stop" | "length" | "content_filter" | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}
```

### Example Response

```json
{
  "id": "gen-1234567890",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "{\"taskAnalysis\":{\"summary\":\"Legal document summarization\",\"detectedModality\":\"text\",\"modalityReasoning\":\"Task requires text output\",\"keyRequirements\":[\"long context\",\"reasoning\",\"accuracy\"],\"costFactors\":\"Input-heavy, documents can be 50+ pages\"},\"recommendations\":{\"cheapest\":{\"id\":\"openrouter::deepseek/deepseek-v3.2\",\"reason\":\"Strong reasoning at lowest price\",\"pricingSummary\":\"$0.26 / $0.38 per 1M tokens\",\"estimatedCost\":\"~$8/mo for 200 contracts\"},\"balanced\":{...},\"best\":{...}},\"alternativesInOtherModalities\":null}"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 25430,
    "completion_tokens": 412,
    "total_tokens": 25842
  },
  "model": "deepseek/deepseek-v3.2"
}
```

---

## Token Budget

### Estimated Token Usage

| Component | Tokens | Notes |
|-----------|--------|-------|
| System prompt | ~1,500 | Fixed, doesn't change |
| User prompt template | ~100 | Fixed structure |
| Compressed catalog | ~20,000-30,000 | Varies by number of models |
| User task | ~50-200 | Depends on description length |
| **Total input** | **~22,000-32,000** | |
| Expected output | ~400-600 | Structured JSON recommendation |

### Cost Estimation

Using DeepSeek V3.2 ($0.26/$0.38 per 1M tokens):

```
Input:  27,000 tokens × $0.26/1M = $0.00702
Output:   500 tokens × $0.38/1M = $0.00019
----------------------------------------------
Total:                          ~$0.007 per recommendation
```

**Budget target:** <$0.01 per recommendation (achieved)

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Parse JSON response |
| 400 | Bad Request | Log error, check prompt format |
| 401 | Invalid API Key | Show error, suggest checking key |
| 402 | Insufficient Credits | Show error, suggest adding credits |
| 429 | Rate Limited | Retry with exponential backoff |
| 500-503 | Server Error | Retry with backoff |
| Timeout | Network issue | Retry once, then use fallback |

### Retry Strategy

```
Max attempts: 3
Backoff: Exponential (1s, 2s, 4s)
After 3 failures: Use price-sorted fallback
```

### JSON Parsing Errors

If the LLM returns invalid JSON:

1. Attempt to parse
2. If fails, retry once with stricter prompt
3. If still fails, use fallback mode

```typescript
try {
  const parsed = JSON.parse(content);
  return parsed;
} catch (e) {
  if (attempt < MAX_RETRIES) {
    // Retry with additional instruction
    return retry("IMPORTANT: Return only valid JSON. No markdown, no explanation.");
  }
  return priceSortedFallback(task, models);
}
```

---

## Model ID Validation

The LLM may recommend model IDs that don't exist in the catalog. We validate:

### Validation Logic

```typescript
function validateRecommendation(
  rec: Recommendation,
  validIds: Set<string>
): ValidationResult {
  const invalidIds: string[] = [];

  for (const tier of ["cheapest", "balanced", "best"] as const) {
    const pick = rec.recommendations[tier];
    if (!pick?.id || !validIds.has(pick.id)) {
      invalidIds.push(pick?.id ?? "undefined");
    }
  }

  return {
    valid: invalidIds.length === 0,
    invalidIds,
  };
}
```

### Handling Invalid IDs

If validation fails:

1. Log the invalid IDs
2. Find closest match using string similarity
3. If close match found (>30% similarity), use it with warning
4. Otherwise, retry once with corrected context

```typescript
function findClosestModelId(
  invalidId: string,
  validIds: Set<string>
): string | null {
  const needle = invalidId.replace(/^[^:]+::/, "").toLowerCase();

  for (const id of validIds) {
    const candidate = id.replace(/^[^:]+::/, "").toLowerCase();
    // Simple substring matching
    if (candidate.includes(needle) || needle.includes(candidate)) {
      return id;
    }
  }

  return null;
}
```

---

## Sample Implementation

```typescript
import type { Recommendation, ModelEntry } from "../types.js";
import { buildSystemPrompt, buildUserPrompt } from "./prompts.js";
import { validateRecommendation } from "./validator.js";
import { priceSortedFallback } from "./fallback.js";
import { getConfig } from "../config.js";

const MAX_RETRIES = 3;

export async function recommend(
  task: string,
  models: ModelEntry[],
  constraints?: Constraints
): Promise<Recommendation> {
  const config = getConfig();

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(task, models, constraints);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: config.recommenderModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            response_format: { type: "json_object" },
            temperature: 0.3,
          }),
          signal: AbortSignal.timeout(30000),
        }
      );

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`LLM API ${res.status}: ${body}`);
      }

      const data = await res.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error("Empty LLM response");
      }

      const parsed = JSON.parse(content) as Recommendation;

      // Validate model IDs
      const validModelIds = new Set(models.map((m) => m.id));
      const validation = validateRecommendation(parsed, validModelIds);

      if (validation.valid) {
        return parsed;
      }

      console.error(
        `Attempt ${attempt + 1}: Invalid model IDs: ${validation.invalidIds.join(", ")}`
      );

    } catch (err) {
      if (attempt === MAX_RETRIES - 1) {
        console.error("LLM recommendation failed, using fallback");
        return priceSortedFallback(task, models);
      }

      // Exponential backoff
      await sleep(1000 * 2 ** attempt);
    }
  }

  return priceSortedFallback(task, models);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

---

## Fallback Mode

When the LLM fails completely, we use a deterministic fallback:

### Fallback Logic

```typescript
function priceSortedFallback(
  task: string,
  models: ModelEntry[]
): Recommendation {
  // Simple keyword-based modality detection
  const modality = detectModalityFromKeywords(task);

  // Filter to modality
  const filtered = models.filter((m) => m.modality === modality);

  // Sort by price (cheapest first)
  const sorted = filtered.sort((a, b) => {
    const priceA = getAveragePrice(a);
    const priceB = getAveragePrice(b);
    return priceA - priceB;
  });

  // Return top 3 as cheapest/balanced/best
  return {
    taskAnalysis: {
      summary: "Fallback recommendation (LLM unavailable)",
      detectedModality: modality,
      modalityReasoning: "Detected from keywords",
      keyRequirements: [],
      costFactors: "Unknown",
    },
    recommendations: {
      cheapest: toModelPick(sorted[0]),
      balanced: toModelPick(sorted[Math.floor(sorted.length / 2)]),
      best: toModelPick(sorted[sorted.length - 1]),
    },
    alternativesInOtherModalities: null,
  };
}
```

### Fallback Output Warning

```
⚠️  LLM recommendation failed. Showing price-sorted models instead.

Detected modality: IMAGE (based on keywords)

Cheapest image generation models:
  1. fal::stabilityai/sdxl          — $0.003/image
  2. fal::black-forest-labs/flux    — $0.04/image
  3. openrouter::openai/dall-e-3    — $0.04/image

Note: These are not task-specific. Retry or use:
      whichmodel "<task>" --model gpt-4o-mini
```

---

## Testing

### Unit Test Cases

1. **Happy path:** Valid JSON response parsed correctly
2. **Invalid JSON:** Retry triggered, then fallback
3. **Invalid model ID:** Validation catches and logs
4. **API error:** Retry with backoff
5. **Timeout:** Fallback triggered

### Integration Test Cases

1. **Live API call:** Recommendation for "summarize documents"
2. **Modality detection:** Various tasks correctly classified
3. **Cost tracking:** Token usage logged correctly

### Mock Data

See `fixtures/recommendation-response.json` for test fixtures.

---

## Monitoring

### Metrics to Track

1. **Latency:** Time from request to response
2. **Token usage:** Prompt and completion tokens per call
3. **Cost:** Actual cost per recommendation
4. **Error rate:** Percentage of calls requiring fallback
5. **Invalid ID rate:** Percentage of recommendations with invalid IDs

### Logging

```typescript
console.log({
  event: "llm_recommendation",
  model: config.recommenderModel,
  promptTokens: data.usage?.prompt_tokens,
  completionTokens: data.usage?.completion_tokens,
  costUsd: calculateCost(data.usage),
  latencyMs: Date.now() - startTime,
  fallback: false,
});
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-02-23 | Initial documentation |
