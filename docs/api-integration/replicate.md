# Replicate API Integration

> **Version:** 1.0
> **Last Updated:** 2025-02-23
> **Status:** Phase 3 (Not yet implemented)

---

## Overview

Replicate provides a broad catalog of AI models including text, image, video, and audio. This integration significantly expands `whichmodel`'s catalog coverage.

---

## API Endpoint

### List Models

```
GET https://api.replicate.com/v1/models
```

**Authentication:** Required (Token)

**Rate Limit:** Varies by plan

**Timeout Recommendation:** 10 seconds

---

## Authentication

### Required Headers

```http
Authorization: Token r8_...
Content-Type: application/json
```

### Getting an API Token

1. Visit https://replicate.com/account
2. Create an account
3. Generate an API token
4. Set environment variable:

```bash
export REPLICATE_API_TOKEN=r8_...
```

---

## Response Schema

```typescript
interface ReplicateModel {
  url: string;                   // e.g., "owner/name"
  owner: string;                 // e.g., "stability-ai"
  name: string;                  // e.g., "sdxl"
  description?: string;
  visibility: "public" | "private";
  github_url?: string;
  paper_url?: string;
  license_url?: string;
  run_count: number;
  cover_image_url?: string;
  default_example?: {
    input: Record<string, any>;
    output: any;
  };
  latest_version?: {
    id: string;
    created_at: string;
    cog_version: string;
    openapi_schema: {
      components: {
        schemas: {
          Input: {
            properties: Record<string, any>;
          };
          Output: {
            type: string;
          };
        };
      };
    };
  };
}
```

---

## Field Mapping: Replicate → ModelEntry

| Replicate Field | ModelEntry Field | Transformation |
|-----------------|------------------|----------------|
| `url` | `id` | Prefix with `replicate::` |
| - | `source` | Always `"replicate"` |
| `name` | `name` | Direct copy |
| `owner` | `provider` | Direct copy |
| - | `modality` | Derive from input/output schemas |

### Modality Detection

Derive modality from OpenAPI schema:

```typescript
function detectModality(model: ReplicateModel): Modality {
  const inputSchema = model.latest_version?.openapi_schema?.components?.schemas?.Input;
  const outputSchema = model.latest_version?.openapi_schema?.components?.schemas?.Output;

  if (!inputSchema || !outputSchema) return "text";

  const inputTypes = Object.values(inputSchema.properties || {})
    .map((p: any) => p.type);
  const outputType = outputSchema.type;

  if (outputType === "string" && outputSchema.format === "uri") {
    if (inputTypes.includes("image")) return "image";
    if (inputTypes.includes("video")) return "video";
    if (inputTypes.includes("audio")) return "audio_tts";
  }

  return "text";
}
```

---

## Popular Models

| Model ID | Modality | Notes |
|----------|----------|-------|
| `stability-ai/sdxl` | Image | Stable Diffusion XL |
| `black-forest-labs/flux-schnell` | Image | Fast Flux variant |
| `runway/gen3-alpha` | Video | Runway Gen-3 |
| `openai/whisper` | Audio STT | Speech transcription |

---

## Pricing

Replicate pricing is per-run and varies significantly. Must be fetched per-model:

```typescript
async function getModelPricing(modelId: string): Promise<Pricing> {
  // GET /v1/models/{owner}/{name}
  // Look for pricing in response
}
```

---

## Implementation Stub

```typescript
import type { CatalogSource, ModelEntry } from "../types.js";

export class ReplicateCatalog implements CatalogSource {
  readonly sourceId = "replicate";

  async fetch(): Promise<ModelEntry[]> {
    // TODO: Implement in Phase 3
    throw new Error("ReplicateCatalog not yet implemented");
  }
}
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-02-23 | Initial spec for Phase 3 |
