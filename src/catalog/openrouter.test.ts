import { describe, expect, it, vi } from "vitest";
import fixture from "../../fixtures/openrouter-catalog.json";
import { OpenRouterCatalog } from "./openrouter.js";
import { ExitCode, type OpenRouterResponse } from "../types.js";

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

describe("OpenRouterCatalog", () => {
  it("normalizes fixture data into model entries", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(mockResponse(200, fixture as OpenRouterResponse));

    const catalog = new OpenRouterCatalog({
      fetchImpl,
      retryDelaysMs: [0],
      sleep: async () => {},
      noCache: true,
    });

    const models = await catalog.fetch();

    expect(models.length).toBeGreaterThan(0);
    expect(models.every((model) => model.id.startsWith("openrouter::"))).toBe(true);
    expect(models.every((model) => model.modality !== undefined)).toBe(true);
  });

  it("filters out zero-priced models", async () => {
    const payload: OpenRouterResponse = {
      data: [
        {
          id: "free/model",
          name: "Free Model",
          context_length: 2048,
          pricing: { prompt: "0", completion: "0" },
        },
        {
          id: "openai/gpt-4o-mini",
          name: "GPT-4o Mini",
          context_length: 128000,
          pricing: { prompt: "0.00000015", completion: "0.0000006" },
        },
      ],
    };

    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(mockResponse(200, payload));
    const catalog = new OpenRouterCatalog({
      fetchImpl,
      retryDelaysMs: [0],
      sleep: async () => {},
      noCache: true,
    });

    const models = await catalog.fetch();

    expect(models).toHaveLength(1);
    expect(models[0]?.id).toBe("openrouter::openai/gpt-4o-mini");
  });

  it("defaults missing architecture to text modalities", async () => {
    const payload: OpenRouterResponse = {
      data: [
        {
          id: "provider/model",
          name: "Model",
          context_length: 4096,
          pricing: { prompt: "0.000001", completion: "0.000002" },
        },
      ],
    };

    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(mockResponse(200, payload));
    const catalog = new OpenRouterCatalog({
      fetchImpl,
      retryDelaysMs: [0],
      sleep: async () => {},
      noCache: true,
    });

    const models = await catalog.fetch();
    expect(models).toHaveLength(1);
    expect(models[0]?.inputModalities).toEqual(["text"]);
    expect(models[0]?.outputModalities).toEqual(["text"]);
    expect(models[0]?.modality).toBe("text");
  });

  it("does not classify broad multimodal text models as audio_stt", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(mockResponse(200, fixture as OpenRouterResponse));

    const catalog = new OpenRouterCatalog({
      fetchImpl,
      retryDelaysMs: [0],
      sleep: async () => {},
      noCache: true,
    });

    const models = await catalog.fetch();
    const geminiFlash = models.find(
      (model) => model.id === "openrouter::google/gemini-2.5-flash"
    );
    const geminiPro = models.find(
      (model) => model.id === "openrouter::google/gemini-2.5-pro"
    );

    expect(geminiFlash?.modality).toBe("vision");
    expect(geminiPro?.modality).toBe("vision");
  });

  it("retries abort failures and returns typed network error", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(abortError("timed out"));
    const catalog = new OpenRouterCatalog({
      fetchImpl,
      retryDelaysMs: [0, 0],
      sleep: async () => {},
      noCache: true,
    });

    await expect(catalog.fetch()).rejects.toMatchObject({
      exitCode: ExitCode.NETWORK_ERROR,
      message: "Timeout fetching model catalog from OpenRouter.",
    });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("retries 5xx responses and fails with network error", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(mockResponse(503, { error: "down" }));
    const catalog = new OpenRouterCatalog({
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
});
