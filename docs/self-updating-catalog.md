# Self-Updating Catalog

> **Version:** 1.1
> **Last Updated:** 2026-02-24

## Purpose

Keep catalog data current by fetching provider APIs at runtime with local cache.

## Runtime Behavior

- `whichmodel` fetches source catalogs live (OpenRouter/fal/Replicate).
- Results are normalized and cached locally.
- `--no-cache` forces a live fetch.

## Manual Catalog Fetch Script

```bash
npm run catalog:fetch -- --sources openrouter
npm run catalog:fetch -- --sources openrouter,fal
npm run catalog:fetch -- --sources openrouter,replicate
```

The script:
- validates source values
- fetches sources in parallel
- merges successful source results
- reports per-source failures without hiding full multi-source success

## Recommended Operational Flow

1. Keep cache TTL at default (`3600`) unless you need fresher catalogs.
2. Use `--no-cache` during release verification or incident triage.
3. Run `whichmodel cache --stats` to inspect source freshness.

## Notes

- OpenRouter sentinel pricing entries (negative values) are filtered out during normalization.
- Empty catalog payloads are not persisted to cache.
