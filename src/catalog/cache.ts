/**
 * File-based cache for catalog data
 *
 * Caches normalized model catalogs to disk to reduce API calls.
 * Follows XDG Base Directory specification on Unix systems.
 *
 * @module catalog/cache
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { CacheEntry, CacheStats, CacheSourceStats, ModelEntry } from "../types.js";

/**
 * Get the cache directory path
 *
 * - Unix: ~/.cache/whichmodel/
 * - Windows: %LOCALAPPDATA%\whichmodel\cache\
 */
export function getCacheDir(): string {
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA ?? path.join(os.homedir(), "AppData", "Local");
    return path.join(localAppData, "whichmodel", "cache");
  }

  // Follow XDG Base Directory specification on Unix
  const xdgCacheHome = process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), ".cache");
  return path.join(xdgCacheHome, "whichmodel");
}

/**
 * Get the cache file path for a specific source
 */
function getCachePath(source: string): string {
  return path.join(getCacheDir(), `${source}-catalog.json`);
}

/**
 * Get the metadata file path
 */
function getMetadataPath(): string {
  return path.join(getCacheDir(), "metadata.json");
}

/**
 * Format a timestamp as a human-readable age string
 */
function formatAge(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diffSeconds = now - timestamp;

  if (diffSeconds < 60) {
    return "just now";
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

/**
 * Check if a cache entry is still valid based on TTL
 */
function isCacheValid(timestamp: number, ttl: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  return now - timestamp <= ttl;
}

/**
 * Read cached catalog data for a source
 *
 * @param source - The catalog source ID (e.g., "openrouter", "fal")
 * @returns The cached models, or null if not cached or expired
 */
export async function readCache(source: string): Promise<ModelEntry[] | null> {
  const cachePath = getCachePath(source);

  try {
    const content = await fs.readFile(cachePath, "utf-8");
    const cache: CacheEntry<ModelEntry[]> = JSON.parse(content);

    // Validate cache structure
    if (!cache.data || !cache.timestamp || !cache.ttl) {
      return null;
    }

    // Check if expired
    if (!isCacheValid(cache.timestamp, cache.ttl)) {
      return null;
    }

    return cache.data;
  } catch {
    // Cache doesn't exist, is malformed, or can't be read
    return null;
  }
}

/**
 * Write catalog data to cache
 *
 * @param source - The catalog source ID
 * @param data - The normalized model entries to cache
 * @param ttl - Time-to-live in seconds
 */
export async function writeCache(
  source: string,
  data: ModelEntry[],
  ttl: number
): Promise<void> {
  const cacheDir = getCacheDir();
  const cachePath = getCachePath(source);

  const cache: CacheEntry<ModelEntry[]> = {
    data,
    timestamp: Math.floor(Date.now() / 1000),
    ttl,
    source,
  };

  // Ensure cache directory exists with secure permissions
  await fs.mkdir(cacheDir, { recursive: true, mode: 0o700 });

  // Atomic write: write to temp file, then rename
  // Use mode 0o600 to ensure only owner can read cache files
  const tempPath = `${cachePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(cache, null, 2), { mode: 0o600 });
  await fs.rename(tempPath, cachePath);
}

/**
 * Invalidate (delete) cache for a specific source or all sources
 *
 * @param source - Optional source ID. If not provided, clears all caches.
 */
export async function invalidateCache(source?: string): Promise<void> {
  if (source) {
    const cachePath = getCachePath(source);
    try {
      await fs.unlink(cachePath);
    } catch {
      // File doesn't exist, ignore
    }
    return;
  }

  // Clear all caches
  const cacheDir = getCacheDir();
  try {
    const files = await fs.readdir(cacheDir);
    await Promise.all(
      files
        .filter((file) => file.endsWith("-catalog.json"))
        .map((file) => fs.unlink(path.join(cacheDir, file)).catch(() => {}))
    );
    // Also remove metadata file
    await fs.unlink(getMetadataPath()).catch(() => {});
  } catch {
    // Directory doesn't exist or can't be read, ignore
  }
}

/**
 * Get statistics about cached data
 *
 * @param configuredTtl - The configured TTL to use for staleness calculation
 * @returns Cache statistics including location and per-source info
 */
export async function getCacheStats(configuredTtl: number = 3600): Promise<CacheStats> {
  const cacheDir = getCacheDir();
  const sources: CacheSourceStats[] = [];

  try {
    const files = await fs.readdir(cacheDir);
    const cacheFiles = files.filter((file) => file.endsWith("-catalog.json"));

    for (const file of cacheFiles) {
      const source = file.replace("-catalog.json", "");
      const cachePath = path.join(cacheDir, file);

      try {
        const content = await fs.readFile(cachePath, "utf-8");
        const cache: CacheEntry<ModelEntry[]> = JSON.parse(content);

        const ttl = cache.ttl ?? configuredTtl;
        const isStale = !isCacheValid(cache.timestamp, ttl);

        sources.push({
          name: source,
          timestamp: cache.timestamp,
          ttl,
          modelCount: Array.isArray(cache.data) ? cache.data.length : 0,
          age: formatAge(cache.timestamp),
          isStale,
        });
      } catch {
        // Skip malformed cache files
      }
    }
  } catch {
    // Directory doesn't exist or can't be read
  }

  // Sort by name for consistent output
  sources.sort((a, b) => a.name.localeCompare(b.name));

  return {
    location: cacheDir,
    sources,
  };
}

/**
 * Format cache statistics for terminal output
 */
export function formatCacheStats(stats: CacheStats): string {
  const lines: string[] = [];

  lines.push("Cache Statistics:");
  lines.push(`  Location: ${stats.location}`);
  lines.push("");

  if (stats.sources.length === 0) {
    lines.push("  No cached data.");
    return lines.join("\n");
  }

  lines.push("  Source         Age        TTL    Models");
  lines.push("  ───────────────────────────────────────");

  for (const source of stats.sources) {
    const ttlStr = source.isStale ? `${source.ttl}s (stale)` : `${source.ttl}s`;
    const staleStr = source.isStale ? " (stale)" : "";
    lines.push(
      `  ${source.name.padEnd(14)} ${source.age.padEnd(10)} ${ttlStr.padEnd(6)} ${source.modelCount}${staleStr}`
    );
  }

  return lines.join("\n");
}
