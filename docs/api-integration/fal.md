# fal.ai API Integration

> **Version:** 1.1
> **Last Updated:** 2026-02-24
> **Status:** Implemented

## Overview

The fal source adapter fetches model metadata and pricing, normalizes to `ModelEntry`, and feeds merge/recommendation flows.

Implementation file:
- `src/catalog/fal.ts`

## Endpoints Used

- `GET https://api.fal.ai/v1/models`
- `GET https://api.fal.ai/v1/models/pricing`

## Auth

Header format:

```http
Authorization: Key <FAL_API_KEY>
Content-Type: application/json
```

Environment variable:

```bash
export FAL_API_KEY=<key>
```

## Adapter Behavior

- Pulls paginated model list.
- Filters to categories mapped to supported modalities.
- Fetches pricing in endpoint chunks.
- Normalizes entries into canonical `ModelEntry` format.
- Retries transient network/status failures with backoff.
- Uses file cache unless `--no-cache` is set.
- Does not write empty normalized results to cache.

## Modality Mapping

Categories are mapped into:
- `image`
- `video`
- `audio_tts`
- `audio_stt`
- `audio_generation`

## Error Mapping

- Missing key -> exit code `3`
- Transient/HTTP/network errors -> typed `WhichModelError` with retry hints
