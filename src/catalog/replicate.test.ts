import { describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ExitCode } from "../types.js";
import { ReplicateCatalog } from "./replicate.js";

function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: new Headers(),
  } as Response;
}

function mockHtmlResponse(status: number, html: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => html,
    headers: new Headers({
      "content-length": String(Buffer.byteLength(html, "utf8")),
    }),
  } as Response;
}

function abortError(message: string): Error {
  const error = new Error(message);
  (error as Error & { name: string }).name = "AbortError";
  return error;
}

async function withTempCacheDir<T>(fn: () => Promise<T>): Promise<T> {
  const tempDir = path.join(os.tmpdir(), `whichmodel-replicate-test-${Date.now()}`);
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

describe("ReplicateCatalog", () => {
  it("fetches paginated models and normalizes media modalities", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("page=2")) {
        return mockResponse(200, {
          next: null,
          results: [
            {
              owner: "runway",
              name: "gen3-alpha",
              description: "Generate short product videos",
              run_count: 5000,
              visibility: "public",
              pricing: { per_generation: 0.6 },
              latest_version: {
                openapi_schema: {
                  components: {
                    schemas: {
                      Input: {
                        type: "object",
                        properties: {
                          prompt: { type: "string" },
                        },
                      },
                      Output: {
                        type: "string",
                        format: "uri",
                        description: "Generated video URL",
                      },
                    },
                  },
                },
              },
            },
          ],
        });
      }

      return mockResponse(200, {
        next: "https://api.replicate.com/v1/models?page=2",
        results: [
          {
            owner: "black-forest-labs",
            name: "flux-schnell",
            description: "Fast image generation model",
            run_count: 1000,
            visibility: "public",
            pricing: { per_image: 0.02 },
            latest_version: {
              openapi_schema: {
                components: {
                  schemas: {
                    Input: {
                      type: "object",
                      properties: {
                        prompt: { type: "string" },
                      },
                    },
                    Output: {
                      type: "string",
                      format: "uri",
                      description: "Generated image URL",
                    },
                  },
                },
              },
            },
          },
          {
            owner: "private",
            name: "hidden-model",
            visibility: "private",
          },
        ],
      });
    });

    const catalog = new ReplicateCatalog({
      apiToken: "r8_test",
      fetchImpl,
      retryDelaysMs: [0],
      sleep: async () => {},
      noCache: true,
    });

    const models = await catalog.fetch();
    expect(models).toHaveLength(2);
    expect(models.map((model) => model.id)).toEqual([
      "replicate::runway/gen3-alpha",
      "replicate::black-forest-labs/flux-schnell",
    ]);
    expect(models[0]?.modality).toBe("video");
    expect(models[1]?.modality).toBe("image");
  });

  it("throws NO_API_KEY when REPLICATE token is missing", async () => {
    const catalog = new ReplicateCatalog({ retryDelaysMs: [0] });
    await expect(catalog.fetch()).rejects.toMatchObject({
      exitCode: ExitCode.NO_API_KEY,
      message: "REPLICATE_API_TOKEN is not set.",
    });
  });

  it("maps 401 to NO_API_KEY", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(mockResponse(401, {}));
    const catalog = new ReplicateCatalog({
      apiToken: "r8_bad",
      fetchImpl,
      retryDelaysMs: [0],
      sleep: async () => {},
      noCache: true,
    });

    await expect(catalog.fetch()).rejects.toMatchObject({
      exitCode: ExitCode.NO_API_KEY,
      message: "Invalid or unauthorized Replicate API token.",
    });
  });

  it("retries abort failures and returns timeout error", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(abortError("timed out"));
    const catalog = new ReplicateCatalog({
      apiToken: "r8_test",
      fetchImpl,
      retryDelaysMs: [0, 0],
      sleep: async () => {},
      noCache: true,
    });

    await expect(catalog.fetch()).rejects.toMatchObject({
      exitCode: ExitCode.NETWORK_ERROR,
      message: "Timeout fetching model catalog from Replicate.",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("retries 5xx responses and fails with network error", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(mockResponse(503, {}));
    const catalog = new ReplicateCatalog({
      apiToken: "r8_test",
      fetchImpl,
      retryDelaysMs: [0, 0],
      sleep: async () => {},
      noCache: true,
    });

    await expect(catalog.fetch()).rejects.toMatchObject({
      exitCode: ExitCode.NETWORK_ERROR,
      message: expect.stringContaining("503"),
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("enriches missing Replicate API pricing from model page when flag is enabled", async () => {
    await withTempCacheDir(async () => {
      const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (input) => {
        const url = String(input);
        if (url.startsWith("https://replicate.com/")) {
          const html = `
            <script type="application/json">
              {
                "billingConfig": {
                  "current_tiers": [
                    {
                      "prices": [
                        { "metric": "token_input_count", "metric_display": "input token", "title": "per million input tokens", "price": "$0.40" },
                        { "metric": "token_output_count", "metric_display": "output token", "title": "per million output tokens", "price": "$1.60" }
                      ]
                    }
                  ]
                }
              }
            </script>
          `;
          return mockHtmlResponse(200, html);
        }

        return mockResponse(200, {
          next: null,
          results: [
            {
              owner: "openai",
              name: "gpt-4.1-mini",
              description: "Text model",
              run_count: 10_000,
              visibility: "public",
              latest_version: {
                openapi_schema: {
                  components: {
                    schemas: {
                      Input: { type: "object", properties: { prompt: { type: "string" } } },
                      Output: { type: "string" },
                    },
                  },
                },
              },
            },
          ],
        });
      });

      const catalog = new ReplicateCatalog({
        apiToken: "r8_test",
        fetchImpl,
        retryDelaysMs: [0],
        sleep: async () => {},
        noCache: true,
        replicatePagePricing: true,
      });

      const models = await catalog.fetch();
      expect(models).toHaveLength(1);
      expect(models[0]?.pricing).toMatchObject({
        type: "text",
        promptPer1mTokens: 0.4,
        completionPer1mTokens: 1.6,
      });
      expect(fetchImpl).toHaveBeenCalledWith(
        "https://replicate.com/openai/gpt-4.1-mini",
        expect.anything()
      );
    });
  });

  it("does not fetch model pages when pricing enrichment flag is disabled", async () => {
    const pageFetches: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("https://replicate.com/")) {
        pageFetches.push(url);
      }

      return mockResponse(200, {
        next: null,
        results: [
          {
            owner: "black-forest-labs",
            name: "flux-unpriced",
            description: "Image generation model",
            run_count: 100,
            visibility: "public",
          },
        ],
      });
    });

    const catalog = new ReplicateCatalog({
      apiToken: "r8_test",
      fetchImpl,
      retryDelaysMs: [0],
      sleep: async () => {},
      noCache: true,
      replicatePagePricing: false,
    });

    await catalog.fetch();
    expect(pageFetches).toEqual([]);
  });

  it("keeps source successful with unpriced entries when page enrichment fails", async () => {
    await withTempCacheDir(async () => {
      const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (input) => {
        const url = String(input);
        if (url.startsWith("https://replicate.com/")) {
          return mockHtmlResponse(500, "");
        }

        return mockResponse(200, {
          next: null,
          results: [
            {
              owner: "black-forest-labs",
              name: "flux-unpriced",
              description: "Image generation model",
              run_count: 100,
              visibility: "public",
            },
          ],
        });
      });

      const catalog = new ReplicateCatalog({
        apiToken: "r8_test",
        fetchImpl,
        retryDelaysMs: [0],
        sleep: async () => {},
        noCache: true,
        replicatePagePricing: true,
      });

      const models = await catalog.fetch();
      expect(models).toHaveLength(1);
      expect(models[0]?.pricing).toEqual({ type: "image" });
    });
  });

  it("respects per-run enrichment fetch budget", async () => {
    await withTempCacheDir(async () => {
      const pageCalls: string[] = [];
      const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (input) => {
        const url = String(input);
        if (url.startsWith("https://replicate.com/")) {
          pageCalls.push(url);
          const html = `
            <script type="application/json">
              {
                "billingConfig": {
                  "current_tiers": [
                    {
                      "prices": [
                        { "metric": "image_output_count", "metric_display": "output image", "title": "per output image", "price": "$0.02" }
                      ]
                    }
                  ]
                }
              }
            </script>
          `;
          return mockHtmlResponse(200, html);
        }

        return mockResponse(200, {
          next: null,
          results: [
            { owner: "a", name: "one", description: "Image model", run_count: 1000, visibility: "public" },
            { owner: "b", name: "two", description: "Image model", run_count: 900, visibility: "public" },
            { owner: "c", name: "three", description: "Image model", run_count: 800, visibility: "public" },
          ],
        });
      });

      const catalog = new ReplicateCatalog({
        apiToken: "r8_test",
        fetchImpl,
        retryDelaysMs: [0],
        sleep: async () => {},
        noCache: true,
        replicatePagePricing: true,
        replicatePriceFetchBudget: 2,
        replicatePriceConcurrency: 1,
      });

      const models = await catalog.fetch();
      expect(models).toHaveLength(3);
      expect(pageCalls).toHaveLength(2);
    });
  });
});
