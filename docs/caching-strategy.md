# Caching Strategy

> **Version:** 1.1
> **Last Updated:** 2026-02-24
> **Status:** Implemented (v1.0.0)

## Overview

Catalog responses are cached on disk per source to reduce API calls and speed up repeated runs.

## Locations

- macOS/Linux: `~/.cache/whichmodel/` (or `$XDG_CACHE_HOME/whichmodel/`)
- Windows: `%LOCALAPPDATA%\whichmodel\cache\`

## Files

- `openrouter-catalog.json`
- `fal-catalog.json`
- `replicate-catalog.json`

## Cache Entry Schema

```json
{
  "data": ["ModelEntry", "..."],
  "timestamp": 1771906657,
  "ttl": 3600,
  "source": "openrouter"
}
```

## Rules

- Cache read succeeds only when:
  - file is valid JSON
  - required fields are present
  - entry is not expired
  - cached `data` array is non-empty
- Empty cache payloads are ignored.
- Source adapters do not persist empty normalized model lists.

## TTL

Default TTL: `3600` seconds.
Override with:

```bash
export WHICHMODEL_CACHE_TTL=1800
```

## CLI Controls

- Bypass cache once: `--no-cache`
- View cache stats: `whichmodel cache --stats`
- Clear cache: `whichmodel cache --clear`

## Operational Notes

- `--no-cache` is global and applies to subcommands.
- Cache writes are atomic (`.tmp` file then rename) and use restrictive permissions (`0600` for files, `0700` for directories).
