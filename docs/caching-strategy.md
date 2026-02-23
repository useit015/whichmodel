# Caching Strategy

> **Version:** 1.0
> **Last Updated:** 2025-02-23
> **Status:** Phase 3 (Not yet implemented)

---

## Overview

`whichmodel` caches catalog data to reduce API calls and improve response time. This document defines the caching strategy.

---

## Cache Location

| OS | Location |
|----|----------|
| macOS/Linux | `~/.cache/whichmodel/` |
| Windows | `%LOCALAPPDATA%\whichmodel\cache\` |

---

## Cache Files

```
~/.cache/whichmodel/
├── openrouter-catalog.json    # OpenRouter models
├── fal-catalog.json           # fal.ai models
├── replicate-catalog.json     # Replicate models
└── metadata.json              # Cache metadata
```

---

## Cache Structure

### Catalog Cache

```typescript
interface CatalogCache {
  source: string;               // "openrouter" | "fal" | "replicate"
  timestamp: number;            // Unix epoch seconds
  ttl: number;                  // TTL in seconds
  data: ModelEntry[];           // Normalized model entries
}
```

### Metadata File

```typescript
interface CacheMetadata {
  version: string;              // Cache format version
  sources: {
    [sourceId: string]: {
      timestamp: number;
      ttl: number;
      modelCount: number;
    };
  };
}
```

---

## Cache TTL

| Source | Default TTL | Reason |
|--------|-------------|--------|
| OpenRouter | 1 hour (3600s) | Models change infrequently |
| fal.ai | 1 hour (3600s) | Models change infrequently |
| Replicate | 1 hour (3600s) | Models change infrequently |

**Configurable via:** `WHICHMODEL_CACHE_TTL` environment variable

---

## Cache Operations

### Read Cache

```typescript
async function readCache(source: string): Promise<ModelEntry[] | null> {
  const cachePath = getCachePath(source);

  try {
    const content = await fs.readFile(cachePath, "utf-8");
    const cache: CatalogCache = JSON.parse(content);

    // Check if expired
    const now = Math.floor(Date.now() / 1000);
    if (now - cache.timestamp > cache.ttl) {
      return null; // Cache expired
    }

    return cache.data;
  } catch {
    return null; // Cache doesn't exist or is invalid
  }
}
```

### Write Cache

```typescript
async function writeCache(
  source: string,
  data: ModelEntry[],
  ttl: number
): Promise<void> {
  const cachePath = getCachePath(source);

  const cache: CatalogCache = {
    source,
    timestamp: Math.floor(Date.now() / 1000),
    ttl,
    data,
  };

  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(cachePath, JSON.stringify(cache, null, 2));
}
```

### Invalidate Cache

```typescript
async function invalidateCache(source?: string): Promise<void> {
  if (source) {
    const cachePath = getCachePath(source);
    await fs.unlink(cachePath).catch(() => {});
  } else {
    // Clear all caches
    const cacheDir = getCacheDir();
    await fs.rm(cacheDir, { recursive: true }).catch(() => {});
  }
}
```

---

## Cache Bypass

User can bypass cache with:

```bash
# Force fresh fetch
whichmodel "task" --no-cache

# Or clear cache first
whichmodel cache --clear
```

---

## Cache Statistics

```bash
whichmodel cache --stats
```

```
Cache Statistics:
  Location: ~/.cache/whichmodel/

  Source         Age        TTL    Models
  ───────────────────────────────────────
  openrouter     45m ago    1h     312
  fal            2h ago     1h     47 (stale)
  replicate      -          -      (not cached)
```

---

## Implementation Stub

```typescript
// src/catalog/cache.ts

export async function readCache(source: string): Promise<ModelEntry[] | null> {
  // TODO: Implement in Phase 3
  return null;
}

export async function writeCache(
  source: string,
  data: ModelEntry[],
  ttl: number
): Promise<void> {
  // TODO: Implement in Phase 3
}

export async function invalidateCache(source?: string): Promise<void> {
  // TODO: Implement in Phase 3
}
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-02-23 | Initial caching strategy |
