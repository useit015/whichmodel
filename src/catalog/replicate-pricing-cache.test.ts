import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyReplicatePricingUpdates,
  getReplicatePricingCachePath,
  readReplicatePricingCache,
  resolveReplicatePricingEntry,
  writeReplicatePricingCache,
} from "./replicate-pricing-cache.js";

async function withTempCacheDir<T>(fn: () => Promise<T>): Promise<T> {
  const tempDir = path.join(os.tmpdir(), `whichmodel-replicate-price-cache-${Date.now()}`);
  const originalXdgCache = process.env.XDG_CACHE_HOME;
  const originalLocalAppData = process.env.LOCALAPPDATA;

  try {
    if (process.platform === "win32") {
      process.env.LOCALAPPDATA = tempDir;
    } else {
      process.env.XDG_CACHE_HOME = tempDir;
    }
    return await fn();
  } finally {
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

    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

describe("replicate pricing cache", () => {
  it("returns fresh cache entries immediately", async () => {
    await withTempCacheDir(async () => {
      const now = 1_700_000_000;
      let cache = await readReplicatePricingCache();
      cache = applyReplicatePricingUpdates(
        cache,
        [
          {
            modelKey: "owner/model",
            pricing: { per_image: 0.02 },
            source: "billingConfig",
          },
        ],
        3600,
        now
      );
      await writeReplicatePricingCache(cache);

      const loaded = await readReplicatePricingCache();
      const lookup = resolveReplicatePricingEntry(loaded, "owner/model", now + 120, 604800);
      expect(lookup.state).toBe("fresh");
      expect(lookup.entry?.pricing.per_image).toBe(0.02);
    });
  });

  it("marks entries stale within max-stale window", async () => {
    await withTempCacheDir(async () => {
      const now = 1_700_000_000;
      let cache = await readReplicatePricingCache();
      cache = applyReplicatePricingUpdates(
        cache,
        [
          {
            modelKey: "owner/model",
            pricing: { per_second: 0.01 },
            source: "price-string",
          },
        ],
        10,
        now
      );
      await writeReplicatePricingCache(cache);

      const loaded = await readReplicatePricingCache();
      const lookup = resolveReplicatePricingEntry(loaded, "owner/model", now + 300, 604800);
      expect(lookup.state).toBe("stale");
      expect(lookup.entry?.pricing.per_second).toBe(0.01);
    });
  });

  it("ignores entries beyond max-stale window", async () => {
    await withTempCacheDir(async () => {
      const now = 1_700_000_000;
      let cache = await readReplicatePricingCache();
      cache = applyReplicatePricingUpdates(
        cache,
        [
          {
            modelKey: "owner/model",
            pricing: { input_per_1m: 0.2, output_per_1m: 0.8 },
            source: "billingConfig",
          },
        ],
        10,
        now
      );
      await writeReplicatePricingCache(cache);

      const loaded = await readReplicatePricingCache();
      const lookup = resolveReplicatePricingEntry(loaded, "owner/model", now + 900_000, 604800);
      expect(lookup.state).toBe("expired");
      expect(lookup.entry).toBeUndefined();
    });
  });

  it("evicts oldest entries when cache exceeds capacity", async () => {
    await withTempCacheDir(async () => {
      let cache = await readReplicatePricingCache();
      cache = applyReplicatePricingUpdates(
        cache,
        [
          { modelKey: "a/one", pricing: { per_image: 0.01 }, source: "billingConfig" },
          { modelKey: "b/two", pricing: { per_image: 0.02 }, source: "billingConfig" },
          { modelKey: "c/three", pricing: { per_image: 0.03 }, source: "billingConfig" },
        ],
        3600,
        100
      );

      await writeReplicatePricingCache(cache, 2);
      const loaded = await readReplicatePricingCache();
      expect(Object.keys(loaded.entries)).toHaveLength(2);
    });
  });

  it("recovers from corrupt cache files", async () => {
    await withTempCacheDir(async () => {
      const cachePath = getReplicatePricingCachePath();
      await fs.mkdir(path.dirname(cachePath), { recursive: true });
      await fs.writeFile(cachePath, "{bad json");

      const cache = await readReplicatePricingCache();
      expect(cache.entries).toEqual({});
      expect(cache.version).toBe(1);
    });
  });
});
