import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  getCacheDir,
  readCache,
  writeCache,
  invalidateCache,
  getCacheStats,
  formatCacheStats,
} from "./cache.js";
import type { ModelEntry, TextPricing } from "../types.js";

// Helper to create a temporary cache directory for testing
async function withTempCacheDir<T>(fn: (tempDir: string) => Promise<T>): Promise<T> {
  const tempDir = path.join(os.tmpdir(), `whichmodel-cache-test-${Date.now()}`);

  // Save original env
  const originalXdgCache = process.env.XDG_CACHE_HOME;
  const originalLocalAppData = process.env.LOCALAPPDATA;

  try {
    // Set temp directory as cache location
    if (process.platform === "win32") {
      process.env.LOCALAPPDATA = tempDir;
    } else {
      process.env.XDG_CACHE_HOME = tempDir;
    }

    return await fn(tempDir);
  } finally {
    // Restore original env
    if (originalXdgCache === undefined) {
      delete process.env.XDG_CACHE_HOME;
    } else {
      process.env.XDG_CACHE_HOME = originalXdgCache;
    }
    if (originalLocalAppData === undefined) {
      delete process.env.LOCALAPPDATA;
    } else {
      process.env.LOCALAPPDATA = originalLocalAppData;
    }

    // Cleanup temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}

// Sample model for testing
function createTestModel(overrides: Partial<ModelEntry> = {}): ModelEntry {
  const pricing: TextPricing = {
    type: "text",
    promptPer1mTokens: 1.0,
    completionPer1mTokens: 2.0,
  };

  return {
    id: "test::model/test-model",
    source: "test",
    name: "Test Model",
    modality: "text",
    inputModalities: ["text"],
    outputModalities: ["text"],
    pricing,
    provider: "test",
    family: "test",
    contextLength: 4096,
    ...overrides,
  };
}

describe("getCacheDir", () => {
  it("returns correct path on Unix systems", async () => {
    await withTempCacheDir(async (tempDir) => {
      const cacheDir = getCacheDir();
      expect(cacheDir).toBe(path.join(tempDir, "whichmodel"));
    });
  });

  it("uses XDG_CACHE_HOME when set", async () => {
    const customPath = path.join(os.tmpdir(), `custom-cache-${Date.now()}`);
    const originalXdgCache = process.env.XDG_CACHE_HOME;

    try {
      process.env.XDG_CACHE_HOME = customPath;
      const cacheDir = getCacheDir();
      expect(cacheDir).toBe(path.join(customPath, "whichmodel"));
    } finally {
      if (originalXdgCache === undefined) {
        delete process.env.XDG_CACHE_HOME;
      } else {
        process.env.XDG_CACHE_HOME = originalXdgCache;
      }
      try {
        await fs.rm(customPath, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it("returns fallback path when XDG_CACHE_HOME is not set", () => {
    const originalXdgCache = process.env.XDG_CACHE_HOME;

    try {
      delete process.env.XDG_CACHE_HOME;
      const cacheDir = getCacheDir();
      expect(cacheDir).toBe(path.join(os.homedir(), ".cache", "whichmodel"));
    } finally {
      if (originalXdgCache !== undefined) {
        process.env.XDG_CACHE_HOME = originalXdgCache;
      }
    }
  });
});

describe("readCache", () => {
  it("returns null when cache file does not exist", async () => {
    await withTempCacheDir(async () => {
      const result = await readCache("nonexistent");
      expect(result).toBeNull();
    });
  });

  it("returns cached data when valid", async () => {
    await withTempCacheDir(async () => {
      const models = [createTestModel(), createTestModel({ id: "test::model/test-model-2" })];
      await writeCache("test", models, 3600);

      const result = await readCache("test");
      expect(result).not.toBeNull();
      expect(result).toHaveLength(2);
      expect(result?.[0]?.id).toBe("test::model/test-model");
    });
  });

  it("returns null for expired cache", async () => {
    await withTempCacheDir(async () => {
      const models = [createTestModel()];
      // Write cache with 0 TTL (already expired)
      await writeCache("test", models, 0);

      // Wait a moment for time to pass
      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = await readCache("test");
      expect(result).toBeNull();
    });
  });

  it("returns null for corrupted cache JSON", async () => {
    await withTempCacheDir(async (tempDir) => {
      const cachePath = path.join(tempDir, "whichmodel", "test-catalog.json");
      await fs.mkdir(path.dirname(cachePath), { recursive: true });
      await fs.writeFile(cachePath, "not valid json {{{");

      const result = await readCache("test");
      expect(result).toBeNull();
    });
  });

  it("returns null for cache with missing required fields", async () => {
    await withTempCacheDir(async (tempDir) => {
      const cachePath = path.join(tempDir, "whichmodel", "test-catalog.json");
      await fs.mkdir(path.dirname(cachePath), { recursive: true });
      // Missing 'data' field
      await fs.writeFile(cachePath, JSON.stringify({ timestamp: Date.now(), ttl: 3600 }));

      const result = await readCache("test");
      expect(result).toBeNull();
    });
  });

  it("returns null for empty cached model arrays", async () => {
    await withTempCacheDir(async (tempDir) => {
      const cachePath = path.join(tempDir, "whichmodel", "test-catalog.json");
      await fs.mkdir(path.dirname(cachePath), { recursive: true });
      await fs.writeFile(
        cachePath,
        JSON.stringify({
          data: [],
          timestamp: Math.floor(Date.now() / 1000),
          ttl: 3600,
          source: "test",
        })
      );

      const result = await readCache("test");
      expect(result).toBeNull();
    });
  });
});

describe("writeCache", () => {
  it("writes cache with correct structure", async () => {
    await withTempCacheDir(async () => {
      const models = [createTestModel()];
      await writeCache("test", models, 3600);

      const result = await readCache("test");
      expect(result).not.toBeNull();
      expect(result).toHaveLength(1);
    });
  });

  it("creates cache directory if it does not exist", async () => {
    await withTempCacheDir(async (tempDir) => {
      // Cache dir shouldn't exist yet
      const cacheDir = path.join(tempDir, "whichmodel");
      try {
        await fs.access(cacheDir);
        // If we get here, directory exists (unexpected but ok)
      } catch {
        // Directory doesn't exist, as expected
      }

      const models = [createTestModel()];
      await writeCache("test", models, 3600);

      // Now directory should exist
      await fs.access(cacheDir);
    });
  });

  it("includes timestamp and TTL in cache entry", async () => {
    await withTempCacheDir(async (tempDir) => {
      const models = [createTestModel()];
      const ttl = 7200;
      await writeCache("test", models, ttl);

      const cachePath = path.join(tempDir, "whichmodel", "test-catalog.json");
      const content = await fs.readFile(cachePath, "utf-8");
      const cache = JSON.parse(content);

      expect(cache.timestamp).toBeGreaterThan(0);
      expect(cache.ttl).toBe(ttl);
      expect(cache.source).toBe("test");
    });
  });
});

describe("invalidateCache", () => {
  it("deletes cache for specific source", async () => {
    await withTempCacheDir(async () => {
      const models = [createTestModel()];
      await writeCache("source1", models, 3600);
      await writeCache("source2", models, 3600);

      await invalidateCache("source1");

      expect(await readCache("source1")).toBeNull();
      expect(await readCache("source2")).not.toBeNull();
    });
  });

  it("deletes all caches when no source specified", async () => {
    await withTempCacheDir(async () => {
      const models = [createTestModel()];
      await writeCache("source1", models, 3600);
      await writeCache("source2", models, 3600);

      await invalidateCache();

      expect(await readCache("source1")).toBeNull();
      expect(await readCache("source2")).toBeNull();
    });
  });

  it("does not throw when cache does not exist", async () => {
    await withTempCacheDir(async () => {
      // Should not throw
      await expect(invalidateCache("nonexistent")).resolves.not.toThrow();
    });
  });
});

describe("getCacheStats", () => {
  it("returns empty stats when no cache exists", async () => {
    await withTempCacheDir(async () => {
      const stats = await getCacheStats();
      expect(stats.sources).toHaveLength(0);
    });
  });

  it("returns stats for cached sources", async () => {
    await withTempCacheDir(async () => {
      const models = [createTestModel(), createTestModel({ id: "test::model/test-model-2" })];
      await writeCache("openrouter", models, 3600);

      const stats = await getCacheStats();

      expect(stats.sources.length).toBeGreaterThanOrEqual(1);
      const openrouterStats = stats.sources.find((s) => s.name === "openrouter");
      expect(openrouterStats).toBeDefined();
      expect(openrouterStats?.modelCount).toBe(2);
      expect(openrouterStats?.isStale).toBe(false);
    });
  });

  it("marks stale caches correctly", async () => {
    await withTempCacheDir(async () => {
      const models = [createTestModel()];
      await writeCache("test", models, 1); // 1 second TTL

      // Wait for cache to become stale (2+ seconds to be safe)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const stats = await getCacheStats();

      const testStats = stats.sources.find((s) => s.name === "test");
      expect(testStats).toBeDefined();
      expect(testStats?.isStale).toBe(true);
    });
  });

  it("includes cache directory location", async () => {
    await withTempCacheDir(async (tempDir) => {
      const stats = await getCacheStats();
      expect(stats.location).toContain("whichmodel");
    });
  });
});

describe("formatCacheStats", () => {
  it("formats empty stats correctly", () => {
    const stats = {
      location: "/tmp/cache/whichmodel",
      sources: [],
    };

    const output = formatCacheStats(stats);
    expect(output).toContain("Cache Statistics:");
    expect(output).toContain("No cached data");
  });

  it("formats stats with sources correctly", () => {
    const stats = {
      location: "/tmp/cache/whichmodel",
      sources: [
        {
          name: "openrouter",
          timestamp: Math.floor(Date.now() / 1000) - 300, // 5 minutes ago
          ttl: 3600,
          modelCount: 312,
          age: "5m ago",
          isStale: false,
        },
        {
          name: "fal",
          timestamp: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
          ttl: 3600,
          modelCount: 47,
          age: "2h ago",
          isStale: true,
        },
      ],
    };

    const output = formatCacheStats(stats);
    expect(output).toContain("openrouter");
    expect(output).toContain("fal");
    expect(output).toContain("312");
    expect(output).toContain("47");
    expect(output).toContain("stale");
  });
});
