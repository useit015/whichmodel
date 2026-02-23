# fal.ai API Integration

> **Version:** 1.0
> **Last Updated:** 2025-02-23
> **Status:** Phase 2 (Not yet implemented)

---

## Overview

fal.ai provides image, video, and audio generation models via API. This integration enables `whichmodel` to recommend models beyond text generation.

---

## API Endpoint

### List Models

```
GET https://fal.run/api/models
```

**Authentication:** Required (API Key)

**Rate Limit:** Varies by plan

**Timeout Recommendation:** 10 seconds

---

## Authentication

### Required Headers

```http
Authorization: Key fal_...
Content-Type: application/json
```

### Getting an API Key

1. Visit https://fal.ai/dashboard
2. Create an account
3. Generate an API key
4. Set environment variable:

```bash
export FAL_API_KEY=fal_...
```

---

## Response Schema

```typescript
interface FalModel {
  id: string;                    // e.g., "black-forest-labs/flux-1.1-pro"
  name: string;                  // e.g., "Flux 1.1 Pro"
  description?: string;
  category: string;              // e.g., "image-generation", "video-generation"
  pricing: {
    type: "per_image" | "per_second" | "per_generation";
    amount: number;              // Price in USD
  };
  inputs: {
    [key: string]: {
      type: string;
      description?: string;
      default?: any;
    };
  };
  outputs: {
    [key: string]: {
      type: string;
    };
  };
}
```

---

## Field Mapping: fal.ai → ModelEntry

| fal.ai Field | ModelEntry Field | Transformation |
|--------------|------------------|----------------|
| `id` | `id` | Prefix with `fal::` |
| - | `source` | Always `"fal"` |
| `name` | `name` | Direct copy |
| `category` | `modality` | Map to Modality enum |
| `pricing` | `pricing` | Normalize to modality-specific format |

### Modality Mapping

| fal.ai Category | ModelEntry Modality |
|-----------------|---------------------|
| `image-generation` | `image` |
| `image-to-video` | `video` |
| `text-to-video` | `video` |
| `text-to-speech` | `audio_tts` |
| `audio-generation` | `audio_generation` |

---

## Popular Models

| Model ID | Modality | Pricing |
|----------|----------|---------|
| `black-forest-labs/flux-1.1-pro` | Image | $0.04/image |
| `stabilityai/stable-diffusion-xl` | Image | $0.003/image |
| `ideogram/ideogram-v3` | Image | $0.08/image |
| `kling-ai/kling-v2` | Video | $0.60/generation |
| `minimax/video-01` | Video | $0.35/generation |

---

## Implementation Stub

```typescript
import type { CatalogSource, ModelEntry } from "../types.js";

export class FalCatalog implements CatalogSource {
  readonly sourceId = "fal";

  async fetch(): Promise<ModelEntry[]> {
    // TODO: Implement in Phase 2
    throw new Error("FalCatalog not yet implemented");
  }
}
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-02-23 | Initial spec for Phase 2 |
