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
  it("normalizes image/video models and filters unsupported categories", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      mockResponse(200, [
        {
          id: "black-forest-labs/flux-1.1-pro",
          name: "Flux 1.1 Pro",
          category: "image-generation",
          pricing: { type: "per_image", amount: 0.04 },
        },
        {
          id: "kling-ai/kling-v2",
          name: "Kling v2",
          category: "text-to-video",
          pricing: { type: "per_generation", amount: 0.6 },
        },
        {
          id: "audio/stt-model",
          name: "Unsupported STT",
          category: "speech-to-text",
          pricing: { type: "per_minute", amount: 0.01 },
        },
      ])
    );

    const catalog = new FalCatalog({
      apiKey: "fal_test",
      fetchImpl,
      retryDelaysMs: [0],
      sleep: async () => {},
    });

    const models = await catalog.fetch();

    expect(models).toHaveLength(2);
    expect(models[0]?.id).toBe("fal::black-forest-labs/flux-1.1-pro");
    expect(models[0]?.modality).toBe("image");
    expect(models[1]?.id).toBe("fal::kling-ai/kling-v2");
    expect(models[1]?.modality).toBe("video");
  });

  it("accepts object responses with models field", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      mockResponse(200, {
        models: [
          {
            id: "stabilityai/stable-diffusion-xl",
            name: "Stable Diffusion XL",
            category: "image-generation",
            pricing: { type: "per_image", amount: 0.003 },
          },
        ],
      })
    );

    const catalog = new FalCatalog({ apiKey: "fal_test", fetchImpl, retryDelaysMs: [0] });
    const models = await catalog.fetch();

    expect(models).toHaveLength(1);
    expect(models[0]?.id).toBe("fal::stabilityai/stable-diffusion-xl");
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
    });

    await expect(catalog.fetch()).rejects.toMatchObject({
      exitCode: ExitCode.NETWORK_ERROR,
      message: "Timeout fetching model catalog from fal.ai.",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
