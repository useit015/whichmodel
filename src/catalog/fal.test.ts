import { describe, expect, it, vi } from "vitest";
import { ExitCode } from "../types.js";
import { FalCatalog } from "./fal.js";

function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function abortError(message: string): Error {
  const error = new Error(message);
  (error as Error & { name: string }).name = "AbortError";
  return error;
}

describe("FalCatalog", () => {
  it("normalizes platform models and pricing into image/video entries", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = String(input);
      if (url.startsWith("https://api.fal.ai/v1/models?")) {
        return mockResponse(200, {
          models: [
            {
              endpoint_id: "black-forest-labs/flux-1.1-pro",
              metadata: { display_name: "Flux 1.1 Pro", category: "text-to-image" },
            },
            {
              endpoint_id: "kling-ai/kling-v2",
              metadata: { display_name: "Kling v2", category: "text-to-video" },
            },
            {
              endpoint_id: "fal-ai/whisper-v3",
              metadata: { display_name: "Whisper v3", category: "audio-to-text" },
            },
            {
              endpoint_id: "fal-ai/training/sdxl",
              metadata: { display_name: "SDXL Training", category: "training" },
            },
          ],
          has_more: false,
          next_cursor: null,
        });
      }

      if (url.startsWith("https://api.fal.ai/v1/models/pricing?")) {
        return mockResponse(200, {
          prices: [
            {
              endpoint_id: "black-forest-labs/flux-1.1-pro",
              unit_price: 0.04,
              unit: "images",
              currency: "USD",
            },
            {
              endpoint_id: "kling-ai/kling-v2",
              unit_price: 0.6,
              unit: "seconds",
              currency: "USD",
            },
            {
              endpoint_id: "fal-ai/whisper-v3",
              unit_price: 0.006,
              unit: "minutes",
              currency: "USD",
            },
          ],
          has_more: false,
          next_cursor: null,
        });
      }

      return mockResponse(404, {});
    });

    const catalog = new FalCatalog({
      apiKey: "fal_test",
      fetchImpl,
      retryDelaysMs: [0],
      sleep: async () => {},
      noCache: true,
    });

    const models = await catalog.fetch();

    expect(models).toHaveLength(3);
    const flux = models.find((model) => model.id === "fal::black-forest-labs/flux-1.1-pro");
    const kling = models.find((model) => model.id === "fal::kling-ai/kling-v2");
    const whisper = models.find((model) => model.id === "fal::fal-ai/whisper-v3");

    expect(flux?.modality).toBe("image");
    expect(kling?.modality).toBe("video");
    expect(kling?.pricing).toMatchObject({ type: "video", perSecond: 0.6 });
    expect(whisper?.modality).toBe("audio_stt");
    expect(whisper?.pricing).toMatchObject({ type: "audio", perMinute: 0.006 });
  });

  it("follows model pagination using cursor", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/v1/models?") && url.includes("cursor=abc")) {
        return mockResponse(200, {
          models: [
            {
              endpoint_id: "stabilityai/stable-diffusion-xl",
              metadata: { display_name: "Stable Diffusion XL", category: "image-to-image" },
            },
          ],
          has_more: false,
          next_cursor: null,
        });
      }

      if (url.includes("/v1/models?")) {
        return mockResponse(200, {
          models: [
            {
              endpoint_id: "fal-ai/veo3",
              metadata: { display_name: "Veo 3", category: "text-to-video" },
            },
          ],
          has_more: true,
          next_cursor: "abc",
        });
      }

      if (url.includes("/v1/models/pricing?")) {
        return mockResponse(200, {
          prices: [
            {
              endpoint_id: "fal-ai/veo3",
              unit_price: 0.4,
              unit: "seconds",
              currency: "USD",
            },
            {
              endpoint_id: "stabilityai/stable-diffusion-xl",
              unit_price: 0.003,
              unit: "images",
              currency: "USD",
            },
          ],
          has_more: false,
          next_cursor: null,
        });
      }

      return mockResponse(404, {});
    });

    const catalog = new FalCatalog({
      apiKey: "fal_test",
      fetchImpl,
      retryDelaysMs: [0],
      noCache: true,
    });
    const models = await catalog.fetch();

    expect(models).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("splits pricing requests when batch endpoint lookup returns 404", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/v1/models?")) {
        return mockResponse(200, {
          models: [
            {
              endpoint_id: "fal-ai/model-a",
              metadata: { display_name: "Model A", category: "text-to-image" },
            },
            {
              endpoint_id: "fal-ai/model-b",
              metadata: { display_name: "Model B", category: "text-to-video" },
            },
          ],
          has_more: false,
          next_cursor: null,
        });
      }

      if (url.includes("/v1/models/pricing?")) {
        const endpointCount = (url.match(/endpoint_id=/g) ?? []).length;
        if (endpointCount > 1) {
          return mockResponse(404, {
            error: { type: "not_found", message: "Endpoint ids not found" },
          });
        }

        if (url.includes("model-a")) {
          return mockResponse(200, {
            prices: [
              {
                endpoint_id: "fal-ai/model-a",
                unit_price: 0.02,
                unit: "images",
                currency: "USD",
              },
            ],
          });
        }

        return mockResponse(200, {
          prices: [
            {
              endpoint_id: "fal-ai/model-b",
              unit_price: 0.5,
              unit: "seconds",
              currency: "USD",
            },
          ],
        });
      }

      return mockResponse(404, {});
    });

    const catalog = new FalCatalog({
      apiKey: "fal_test",
      fetchImpl,
      retryDelaysMs: [0],
      noCache: true,
    });
    const models = await catalog.fetch();

    expect(models).toHaveLength(2);
    expect(models[0]?.id).toBe("fal::fal-ai/model-a");
    expect(models[1]?.id).toBe("fal::fal-ai/model-b");
  });

  it("throws NO_API_KEY when FAL key is missing", async () => {
    const catalog = new FalCatalog({ retryDelaysMs: [0] });
    await expect(catalog.fetch()).rejects.toMatchObject({
      exitCode: ExitCode.NO_API_KEY,
      message: "FAL_API_KEY is not set.",
    });
  });

  it("maps 401 to NO_API_KEY", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(mockResponse(401, {}));
    const catalog = new FalCatalog({
      apiKey: "fal_bad",
      fetchImpl,
      retryDelaysMs: [0],
      sleep: async () => {},
      noCache: true,
    });

    await expect(catalog.fetch()).rejects.toMatchObject({
      exitCode: ExitCode.NO_API_KEY,
    });
  });

  it("retries on 5xx and fails with network error", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(mockResponse(503, {}));
    const catalog = new FalCatalog({
      apiKey: "fal_test",
      fetchImpl,
      retryDelaysMs: [0, 0],
      sleep: async () => {},
      noCache: true,
    });

    await expect(catalog.fetch()).rejects.toMatchObject({
      exitCode: ExitCode.NETWORK_ERROR,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("retries abort failures and returns timeout error", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(abortError("timed out"));
    const catalog = new FalCatalog({
      apiKey: "fal_test",
      fetchImpl,
      retryDelaysMs: [0, 0],
      sleep: async () => {},
      noCache: true,
    });

    await expect(catalog.fetch()).rejects.toMatchObject({
      exitCode: ExitCode.NETWORK_ERROR,
      message: "Timeout fetching model catalog from fal.ai.",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("skips rate-limited pricing chunks instead of failing the whole fetch", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/v1/models?")) {
        return mockResponse(200, {
          models: [
            {
              endpoint_id: "fal-ai/model-a",
              metadata: { display_name: "Model A", category: "text-to-image" },
            },
          ],
          has_more: false,
          next_cursor: null,
        });
      }

      if (url.includes("/v1/models/pricing?")) {
        return mockResponse(429, {});
      }

      return mockResponse(404, {});
    });

    const catalog = new FalCatalog({
      apiKey: "fal_test",
      fetchImpl,
      retryDelaysMs: [0, 0],
      sleep: async () => {},
      noCache: true,
    });

    const models = await catalog.fetch();
    expect(models).toEqual([]);
  });
});
