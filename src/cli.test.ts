import { describe, expect, it } from "vitest";
import {
  fetchCatalogModelsFromFetchers,
  getDefaultCatalogSources,
  parseConstraints,
  parseSources,
  shouldBypassCache,
  validateSupportedSources,
  validateTask,
} from "./cli.js";
import { ExitCode } from "./types.js";

describe("validateTask", () => {
  it("throws INVALID_ARGUMENTS when task is missing", () => {
    expect(() => validateTask("")).toThrowError(
      expect.objectContaining({
        exitCode: ExitCode.INVALID_ARGUMENTS,
        message: "Task description required.",
      })
    );
  });

  it("throws INVALID_ARGUMENTS when task is too long", () => {
    const veryLongTask = "a".repeat(2001);
    expect(() => validateTask(veryLongTask)).toThrowError(
      expect.objectContaining({
        exitCode: ExitCode.INVALID_ARGUMENTS,
        message: "Task description too long (2001 characters).",
      })
    );
  });
});

describe("parseConstraints", () => {
  it("parses valid constraints", () => {
    expect(
      parseConstraints({
        modality: "text",
        maxPrice: "0.05",
        minContext: "100000",
        minResolution: "1024x1024",
        exclude: "foo,bar",
      })
    ).toEqual({
      modality: "text",
      maxPrice: 0.05,
      minContext: 100000,
      minResolution: "1024x1024",
      exclude: ["foo", "bar"],
    });
  });

  it("rejects invalid modality values", () => {
    expect(() => parseConstraints({ modality: "unknown" })).toThrowError(
      expect.objectContaining({
        exitCode: ExitCode.INVALID_ARGUMENTS,
      })
    );
  });

  it("rejects negative max price", () => {
    expect(() => parseConstraints({ maxPrice: "-1" })).toThrowError(
      expect.objectContaining({
        exitCode: ExitCode.INVALID_ARGUMENTS,
      })
    );
  });

  it("rejects non-integer min context", () => {
    expect(() => parseConstraints({ minContext: "10.5" })).toThrowError(
      expect.objectContaining({
        exitCode: ExitCode.INVALID_ARGUMENTS,
      })
    );
  });

  it("rejects invalid min resolution format", () => {
    expect(() => parseConstraints({ minResolution: "1024" })).toThrowError(
      expect.objectContaining({
        exitCode: ExitCode.INVALID_ARGUMENTS,
      })
    );
  });
});

describe("shouldBypassCache", () => {
  it("returns true when Commander negated option sets cache=false", () => {
    expect(shouldBypassCache({ cache: false })).toBe(true);
  });

  it("returns false when cache option is true or undefined", () => {
    expect(shouldBypassCache({ cache: true })).toBe(false);
    expect(shouldBypassCache({})).toBe(false);
  });
});

describe("parseSources", () => {
  it("returns openrouter by default", () => {
    expect(parseSources()).toEqual(["openrouter"]);
  });

  it("normalizes comma-separated sources", () => {
    expect(parseSources(" OpenRouter , FAL ")).toEqual(["openrouter", "fal"]);
  });

  it("rejects invalid source values", () => {
    expect(() => parseSources("openrouter,badsource")).toThrowError(
      expect.objectContaining({
        exitCode: ExitCode.INVALID_ARGUMENTS,
      })
    );
  });
});

describe("getDefaultCatalogSources", () => {
  it("returns openrouter only when optional source keys are missing", () => {
    expect(
      getDefaultCatalogSources({
        apiKey: "sk-or-test",
        recommenderModel: "deepseek/deepseek-v3.2",
        cacheTtl: 3600,
      })
    ).toEqual(["openrouter"]);
  });

  it("includes fal and replicate when those keys are configured", () => {
    expect(
      getDefaultCatalogSources({
        apiKey: "sk-or-test",
        recommenderModel: "deepseek/deepseek-v3.2",
        cacheTtl: 3600,
        falApiKey: "fal_test",
        replicateApiToken: "r8_test",
      })
    ).toEqual(["openrouter", "fal", "replicate"]);
  });
});

describe("validateSupportedSources", () => {
  it("accepts supported phase 2 sources", () => {
    expect(() => validateSupportedSources(["openrouter"])).not.toThrow();
    expect(() => validateSupportedSources(["openrouter", "fal"])).not.toThrow();
    expect(() => validateSupportedSources(["openrouter", "replicate"])).not.toThrow();
  });

  it("rejects unsupported sources", () => {
    expect(() => validateSupportedSources(["openrouter", "together"])).toThrowError(
      expect.objectContaining({
        exitCode: ExitCode.INVALID_ARGUMENTS,
      })
    );
  });
});

describe("fetchCatalogModelsFromFetchers", () => {
  it("merges successful source results", async () => {
    const warnMessages: string[] = [];
    const models = await fetchCatalogModelsFromFetchers(
      [
        {
          source: "openrouter",
          fetch: async () => [
            {
              id: "openrouter::deepseek/deepseek-v3.2",
              source: "openrouter",
              name: "DeepSeek V3.2",
              modality: "text",
              inputModalities: ["text"],
              outputModalities: ["text"],
              pricing: { type: "text", promptPer1mTokens: 0.25, completionPer1mTokens: 0.38 },
              provider: "deepseek",
              family: "deepseek",
            },
          ],
        },
        {
          source: "fal",
          fetch: async () => [
            {
              id: "fal::fal-ai/flux-2",
              source: "fal",
              name: "FLUX.2",
              modality: "image",
              inputModalities: ["text"],
              outputModalities: ["image"],
              pricing: { type: "image", perImage: 0.012 },
              provider: "fal-ai",
              family: "flux",
            },
          ],
        },
      ],
      ["openrouter", "fal"],
      (message) => warnMessages.push(message)
    );

    expect(models).toHaveLength(2);
    expect(warnMessages).toHaveLength(0);
  });

  it("continues when one source fails and warns", async () => {
    const warnMessages: string[] = [];
    const models = await fetchCatalogModelsFromFetchers(
      [
        {
          source: "openrouter",
          fetch: async () => [
            {
              id: "openrouter::deepseek/deepseek-v3.2",
              source: "openrouter",
              name: "DeepSeek V3.2",
              modality: "text",
              inputModalities: ["text"],
              outputModalities: ["text"],
              pricing: { type: "text", promptPer1mTokens: 0.25, completionPer1mTokens: 0.38 },
              provider: "deepseek",
              family: "deepseek",
            },
          ],
        },
        {
          source: "fal",
          fetch: async () => {
            throw new Error("rate limit");
          },
        },
      ],
      ["openrouter", "fal"],
      (message) => warnMessages.push(message)
    );

    expect(models).toHaveLength(1);
    expect(warnMessages).toHaveLength(1);
    expect(warnMessages[0]).toContain("fal: rate limit");
  });

  it("throws NO_MODELS_FOUND when all sources fail", async () => {
    await expect(
      fetchCatalogModelsFromFetchers(
        [
          {
            source: "openrouter",
            fetch: async () => {
              throw new Error("503 Service Unavailable");
            },
          },
          {
            source: "fal",
            fetch: async () => {
              throw new Error("Connection timeout");
            },
          },
        ],
        ["openrouter", "fal"],
        () => {}
      )
    ).rejects.toMatchObject({
      exitCode: ExitCode.NO_MODELS_FOUND,
      message: "All catalog sources failed to respond.",
    });
  });
});
