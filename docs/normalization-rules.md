# Normalization Rules

> **Version:** 1.0
> **Last Updated:** 2025-02-23
> **Status:** Production (Phase 1)

---

## Overview

This document defines how raw API responses from different catalog sources are normalized into the unified `ModelEntry` format.

---

## Modality Classification

### Decision Tree

```
START
  │
  ├─ Does output include "image"?     → IMAGE
  │
  ├─ Does output include "video"?     → VIDEO
  │
  ├─ Does output include "audio"?
  │   ├─ Is input audio?              → AUDIO_STT
  │   └─ Is input text?               → AUDIO_TTS
  │
  ├─ Does output include "music"?     → AUDIO_GENERATION
  │
  ├─ Does input include "image"
  │   AND output include "text"?      → VISION
  │
  ├─ Is output embedding/vector?      → EMBEDDING
  │
  ├─ Multiple input/output modalities → MULTIMODAL
  │
  └─ Default                          → TEXT
```

### Classification Code

```typescript
function classifyModality(
  input: string[],
  output: string[]
): Modality {
  // Output-based (highest priority)
  if (output.includes("image")) return "image";
  if (output.includes("video")) return "video";

  if (output.includes("audio")) {
    if (input.includes("audio")) return "audio_stt";
    return "audio_tts";
  }

  if (output.includes("music") || output.includes("sound")) {
    return "audio_generation";
  }

  if (output.includes("embedding") || output.includes("vector")) {
    return "embedding";
  }

  // Input-based
  if (input.includes("image") && output.includes("text")) {
    return "vision";
  }

  // Check for multimodal
  const totalModalities = new Set([...input, ...output]).size;
  if (totalModalities > 2) {
    return "multimodal";
  }

  // Default
  return "text";
}
```

### Edge Cases

| Input | Output | Result | Reasoning |
|-------|--------|--------|-----------|
| `["text"]` | `["text"]` | `text` | Standard text-to-text |
| `["text", "image"]` | `["text"]` | `vision` | Can see images, outputs text |
| `["text"]` | `["image"]` | `image` | Text-to-image generation |
| `["image"]` | `["video"]` | `video` | Image-to-video |
| `["audio"]` | `["text"]` | `audio_stt` | Speech-to-text |
| `["text"]` | `["audio"]` | `audio_tts` | Text-to-speech |
| `["text"]` | `["embedding"]` | `embedding` | Embedding model |
| `["text", "image"]` | `["text", "image"]` | `multimodal` | Multiple I/O |

---

## Family Extraction

### Patterns

Extract the model family from the model ID or name:

| Pattern | Family | Examples |
|---------|--------|----------|
| `*claude*` | `claude` | claude-3-opus, claude-sonnet-4 |
| `*gpt*` | `gpt` | gpt-4o, gpt-4-turbo |
| `*gemini*` | `gemini` | gemini-2.0-flash, gemini-2.5-pro |
| `*deepseek*` | `deepseek` | deepseek-v3.2, deepseek-coder |
| `*llama*` | `llama` | llama-3.1-8b, llama-3.3-70b |
| `*qwen*` | `qwen` | qwen-2.5-72b, qwen-coder |
| `*mistral*` | `mistral` | mistral-large, mixtral-8x7b |
| `*flux*` | `flux` | flux-1.1-pro, flux-dev |
| `*dall-e*` / `*dalle*` | `dalle` | dall-e-3 |
| `*stable-diffusion*` / `*sdxl*` | `stable-diffusion` | stable-diffusion-xl |
| `*whisper*` | `whisper` | whisper-1, whisper-large-v3 |
| `*midjourney*` | `midjourney` | midjourney-v6 |
| `*runway*` | `runway` | runway-gen3-alpha |
| `*elevenlabs*` / `*eleven*` | `elevenlabs` | eleven-multilingual-v2 |
| Default | `other` | Unknown families |

### Code

```typescript
function extractFamily(id: string, name?: string): string {
  const combined = `${id} ${name ?? ""}`.toLowerCase();

  const families: [RegExp, string][] = [
    [/claude/, "claude"],
    [/gpt/, "gpt"],
    [/gemini/, "gemini"],
    [/deepseek/, "deepseek"],
    [/llama/, "llama"],
    [/qwen/, "qwen"],
    [/mistral|mixtral/, "mistral"],
    [/flux/, "flux"],
    [/dall-e|dalle/, "dalle"],
    [/stable-diffusion|sdxl/, "stable-diffusion"],
    [/whisper/, "whisper"],
    [/midjourney/, "midjourney"],
    [/runway/, "runway"],
    [/elevenlabs|eleven-/, "elevenlabs"],
    [/kling/, "kling"],
    [/ideogram/, "ideogram"],
    [/recraft/, "recraft"],
  ];

  for (const [pattern, family] of families) {
    if (pattern.test(combined)) {
      return family;
    }
  }

  return "other";
}
```

---

## Provider Extraction

Extract the provider from the model ID:

| Source | ID Format | Provider Extraction |
|--------|-----------|---------------------|
| OpenRouter | `provider/model-name` | Split on `/`, take first |
| fal.ai | `owner/model-name` | Split on `/`, take first |
| Replicate | `owner/model-name` | Split on `/`, take first |

```typescript
function extractProvider(id: string): string {
  // Remove source prefix if present
  const withoutSource = id.replace(/^[^:]+::/, "");
  // Split on / and take first part
  return withoutSource.split("/")[0] ?? "unknown";
}
```

---

## Pricing Normalization

### Text Models

Convert per-token pricing to per-1M tokens:

```typescript
// OpenRouter returns "0.000003" (per token)
const promptPerToken = parseFloat(raw.pricing.prompt); // 0.000003
const promptPer1m = promptPerToken * 1_000_000;        // 3.0

// Result: $3.00 per 1M tokens
```

### Image Models

Different providers use different units:

| Provider | Unit | Normalization |
|----------|------|---------------|
| fal.ai | Per image | Direct |
| fal.ai | Per megapixel | Keep as-is |
| Replicate | Per run | Direct |
| OpenRouter | Per image | Direct |

```typescript
function normalizeImagePricing(raw: FalModel): ImagePricing {
  const pricing: ImagePricing = { type: "image" };

  if (raw.pricing.per_image) {
    pricing.perImage = raw.pricing.per_image;
  }
  if (raw.pricing.per_megapixel) {
    pricing.perMegapixel = raw.pricing.per_megapixel;
  }

  return pricing;
}
```

### Video Models

| Provider | Unit | Normalization |
|----------|------|---------------|
| fal.ai | Per second | Direct |
| Replicate | Per run | → perGeneration |
| Runway | Per second | Direct |

### Audio Models

| Type | Common Units |
|------|-------------|
| TTS | Per character, per 1K characters |
| STT | Per minute, per second |
| Generation | Per generation, per second |

```typescript
function normalizeAudioPricing(raw: AudioModel): AudioPricing {
  const pricing: AudioPricing = { type: "audio" };

  // Normalize to per-character for TTS
  if (raw.pricing.per_character) {
    pricing.perCharacter = raw.pricing.per_character;
  } else if (raw.pricing.per_1k_characters) {
    pricing.perCharacter = raw.pricing.per_1k_characters / 1000;
  }

  // Normalize to per-minute for STT
  if (raw.pricing.per_minute) {
    pricing.perMinute = raw.pricing.per_minute;
  } else if (raw.pricing.per_second) {
    pricing.perMinute = raw.pricing.per_second * 60;
  }

  return pricing;
}
```

### Embedding Models

Always per-token, normalize to per-1M:

```typescript
const per1m = parseFloat(raw.pricing.per_token) * 1_000_000;
```

---

## Context Length Handling

### Null/Zero Values

```typescript
// If context_length is null, undefined, or 0, set to undefined
contextLength: raw.context_length && raw.context_length > 0
  ? raw.context_length
  : undefined
```

### Context vs Max Completion

Some models report both. Use `context_length` as total:

```typescript
contextLength: raw.context_length ?? raw.top_provider?.context_length
```

---

## Duplicate Model Handling

### Same Model, Different Sources

If the same model appears in multiple sources (e.g., `gpt-4o` in OpenRouter and Replicate):

1. **Keep both** - they may have different pricing
2. **ID includes source** - `openrouter::openai/gpt-4o` vs `replicate::openai/gpt-4o`
3. **User can filter** - via `--sources` flag

### De-duplication (Future)

For `whichmodel list`, consider:
- Same provider/model in multiple sources
- Keep the cheapest version
- Mark with `[multiple sources]`

---

## Field Defaults

| Field | Default | When Applied |
|-------|---------|--------------|
| `inputModalities` | `["text"]` | Missing from API |
| `outputModalities` | `["text"]` | Missing from API |
| `contextLength` | `undefined` | Missing or zero |
| `supportsStreaming` | `true` | Text models |
| `supportsStreaming` | `false` | Image/video models |

---

## Filtering Rules

### Exclude on Fetch

Filter out models during normalization:

1. **Zero pricing** - Both prompt and completion are 0
2. **Deprecated** - Name contains "deprecated" or "legacy"
3. **Private** - Requires special access (if flagged)

```typescript
function shouldExclude(model: RawModel): boolean {
  const prompt = parseFloat(model.pricing?.prompt ?? "0");
  const completion = parseFloat(model.pricing?.completion ?? "0");

  if (prompt === 0 && completion === 0) return true;
  if (/deprecated|legacy/i.test(model.name)) return true;

  return false;
}
```

### Filter on Query

User filters applied after normalization:

```typescript
function applyFilters(
  models: ModelEntry[],
  constraints: Constraints
): ModelEntry[] {
  let filtered = models;

  if (constraints.modality) {
    filtered = filtered.filter(m => m.modality === constraints.modality);
  }

  if (constraints.minContext) {
    filtered = filtered.filter(
      m => !m.contextLength || m.contextLength >= constraints.minContext!
    );
  }

  if (constraints.maxPrice) {
    filtered = filtered.filter(m => getAveragePrice(m) <= constraints.maxPrice!);
  }

  if (constraints.exclude) {
    for (const pattern of constraints.exclude) {
      filtered = filtered.filter(m => !matchPattern(m.id, pattern));
    }
  }

  return filtered;
}
```

---

## Validation

### Required Fields

Every `ModelEntry` must have:

- `id` (non-empty string)
- `source` (valid source ID)
- `name` (non-empty string)
- `modality` (valid Modality value)
- `pricing` (valid Pricing object)
- `provider` (non-empty string)
- `family` (non-empty string)

### Validation Code

```typescript
function validateModelEntry(model: ModelEntry): boolean {
  if (!model.id || typeof model.id !== "string") return false;
  if (!model.source || typeof model.source !== "string") return false;
  if (!model.name || typeof model.name !== "string") return false;

  const validModalities: Modality[] = [
    "text", "image", "video", "audio_tts", "audio_stt",
    "audio_generation", "vision", "embedding", "multimodal"
  ];
  if (!validModalities.includes(model.modality)) return false;

  if (!model.pricing || typeof model.pricing !== "object") return false;
  if (!model.pricing.type) return false;

  return true;
}
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-02-23 | Initial normalization rules |
