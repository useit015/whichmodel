import { describe, expect, it, vi } from "vitest";
import { ExitCode } from "../types.js";
import { ReplicateCatalog } from "./replicate.js";

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
    });

    await expect(catalog.fetch()).rejects.toMatchObject({
      exitCode: ExitCode.NETWORK_ERROR,
      message: expect.stringContaining("503"),
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
