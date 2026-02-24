# Replicate API Integration

> **Version:** 1.1
> **Last Updated:** 2026-02-24
> **Status:** Implemented

## Overview

The Replicate adapter ingests public model catalog pages, normalizes metadata/pricing, and provides models for merge/recommendation.

Implementation file:
- `src/catalog/replicate.ts`

## Endpoint Used

- `GET https://api.replicate.com/v1/models`

## Auth

Header format:

```http
Authorization: Bearer <REPLICATE_API_TOKEN>
Accept: application/json
```

Environment variable:

```bash
export REPLICATE_API_TOKEN=<token>
```

## Adapter Behavior

- Fetches paginated model list (bounded by max pages/candidates).
- Excludes private models.
- Infers modality from OpenAPI schemas and metadata fallbacks.
- Normalizes pricing into canonical pricing types.
- Retries transient network/status failures with jitter/backoff.
- Uses file cache unless `--no-cache` is set.
- Does not write empty normalized results to cache.

## Error Mapping

- Missing token -> exit code `3`
- `401/403` -> unauthorized token error
- `429/5xx/timeout/network` -> network error with recovery hint
