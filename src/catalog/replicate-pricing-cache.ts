import fs from "node:fs/promises";
import path from "node:path";
import { getCacheDir } from "./cache.js";
import type {
  ReplicatePricingCacheFile,
  ReplicatePricingEntry,
  ReplicatePricingSource,
} from "../types.js";

export const REPLICATE_PRICING_CACHE_FILENAME = "replicate-pricing.json";
export const DEFAULT_REPLICATE_PRICING_CACHE_MAX_ENTRIES = 2_000;

interface ReplicatePricingUpdate {
  modelKey: string;
  pricing: Record<string, number>;
  source: ReplicatePricingSource;
}

export interface ReplicatePricingLookup {
  state: "fresh" | "stale" | "expired" | "missing";
  entry?: ReplicatePricingEntry;
}

export function getReplicatePricingCachePath(): string {
  return path.join(getCacheDir(), REPLICATE_PRICING_CACHE_FILENAME);
}

export async function readReplicatePricingCache(): Promise<ReplicatePricingCacheFile> {
  const cachePath = getReplicatePricingCachePath();

  try {
    const raw = await fs.readFile(cachePath, "utf8");
    const parsed = JSON.parse(raw) as Partial<ReplicatePricingCacheFile>;
    if (!parsed || typeof parsed !== "object" || !parsed.entries) {
      return emptyReplicatePricingCache();
    }

    const entries = sanitizeEntries(parsed.entries);
    return {
      version: 1,
      updatedAt:
        typeof parsed.updatedAt === "number" && Number.isFinite(parsed.updatedAt)
          ? Math.trunc(parsed.updatedAt)
          : 0,
      entries,
    };
  } catch {
    return emptyReplicatePricingCache();
  }
}

export async function writeReplicatePricingCache(
  cache: ReplicatePricingCacheFile,
  maxEntries = DEFAULT_REPLICATE_PRICING_CACHE_MAX_ENTRIES
): Promise<void> {
  const pruned = pruneOldestEntries(cache, maxEntries);
  const cacheDir = getCacheDir();
  const cachePath = getReplicatePricingCachePath();

  await fs.mkdir(cacheDir, { recursive: true, mode: 0o700 });
  const tempPath = `${cachePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(pruned, null, 2), { mode: 0o600 });
  await fs.rename(tempPath, cachePath);
}

export function resolveReplicatePricingEntry(
  cache: ReplicatePricingCacheFile,
  modelKey: string,
  nowEpochSeconds: number,
  maxStaleSeconds: number
): ReplicatePricingLookup {
  const entry = cache.entries[modelKey];
  if (!entry) {
    return { state: "missing" };
  }

  if (entry.expiresAt > nowEpochSeconds) {
    return { state: "fresh", entry };
  }

  if (entry.fetchedAt + maxStaleSeconds >= nowEpochSeconds) {
    return { state: "stale", entry };
  }

  return { state: "expired" };
}

export function applyReplicatePricingUpdates(
  cache: ReplicatePricingCacheFile,
  updates: ReplicatePricingUpdate[],
  ttlSeconds: number,
  nowEpochSeconds: number
): ReplicatePricingCacheFile {
  if (updates.length === 0) {
    return cache;
  }

  const entries: Record<string, ReplicatePricingEntry> = { ...cache.entries };
  for (const update of updates) {
    if (!update.modelKey) {
      continue;
    }

    entries[update.modelKey] = {
      pricing: sanitizePricing(update.pricing),
      source: update.source,
      fetchedAt: nowEpochSeconds,
      expiresAt: nowEpochSeconds + ttlSeconds,
    };
  }

  return {
    version: 1,
    updatedAt: nowEpochSeconds,
    entries,
  };
}

function pruneOldestEntries(
  cache: ReplicatePricingCacheFile,
  maxEntries: number
): ReplicatePricingCacheFile {
  if (maxEntries <= 0) {
    return {
      version: 1,
      updatedAt: cache.updatedAt,
      entries: {},
    };
  }

  const entries = Object.entries(cache.entries);
  if (entries.length <= maxEntries) {
    return cache;
  }

  entries.sort((a, b) => {
    const aFetched = a[1].fetchedAt;
    const bFetched = b[1].fetchedAt;
    if (aFetched !== bFetched) {
      return bFetched - aFetched;
    }
    return a[0].localeCompare(b[0]);
  });

  const kept = entries.slice(0, maxEntries);
  return {
    version: 1,
    updatedAt: cache.updatedAt,
    entries: Object.fromEntries(kept),
  };
}

function sanitizeEntries(
  entries: Record<string, unknown>
): Record<string, ReplicatePricingEntry> {
  const result: Record<string, ReplicatePricingEntry> = {};
  for (const [key, value] of Object.entries(entries)) {
    if (!isRecord(value)) {
      continue;
    }

    const source =
      value.source === "billingConfig" || value.source === "price-string"
        ? value.source
        : null;
    const fetchedAt =
      typeof value.fetchedAt === "number" && Number.isFinite(value.fetchedAt)
        ? Math.trunc(value.fetchedAt)
        : null;
    const expiresAt =
      typeof value.expiresAt === "number" && Number.isFinite(value.expiresAt)
        ? Math.trunc(value.expiresAt)
        : null;
    if (!source || fetchedAt === null || expiresAt === null) {
      continue;
    }

    result[key] = {
      pricing: sanitizePricing(value.pricing),
      source,
      fetchedAt,
      expiresAt,
    };
  }

  return result;
}

function sanitizePricing(value: unknown): Record<string, number> {
  if (!isRecord(value)) {
    return {};
  }

  const result: Record<string, number> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (typeof nested !== "number" || !Number.isFinite(nested) || nested <= 0) {
      continue;
    }
    result[key] = nested;
  }

  return result;
}

function emptyReplicatePricingCache(): ReplicatePricingCacheFile {
  return {
    version: 1,
    updatedAt: 0,
    entries: {},
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
