import { describe, expect, it } from "vitest";
import type { ModelEntry, TextPricing, ImagePricing } from "../types.js";
import { computeStats, formatStatsTerminal } from "./stats.js";

function createTextModel(overrides: Partial<ModelEntry> = {}): ModelEntry {
  const pricing: TextPricing = {
    type: "text",
    promptPer1mTokens: 1.0,
    completionPer1mTokens: 2.0,
  };
  return {
    id: "openrouter::test/model",
    source: "openrouter",
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

function createImageModel(overrides: Partial<ModelEntry> = {}): ModelEntry {
  const pricing: ImagePricing = {
    type: "image",
    perImage: 0.02,
  };
  return {
    id: "fal::test/image-model",
    source: "fal",
    name: "Test Image Model",
    modality: "image",
    inputModalities: ["text"],
    outputModalities: ["image"],
    pricing,
    provider: "test",
    family: "test",
    ...overrides,
  };
}

describe("computeStats", () => {
  it("computes stats for empty model list", () => {
    const config = {
      apiKey: "sk-or-test",
      recommenderModel: "test/model",
      cacheTtl: 3600,
    };

    const stats = computeStats([], config);

    expect(stats.totalModels).toBe(0);
    expect(stats.sources).toEqual([]);
    expect(stats.configuredSources).toContain("openrouter");
    expect(stats.missingSources.length).toBeGreaterThan(0);
  });

  it("counts models by modality", () => {
    const config = {
      apiKey: "sk-or-test",
      recommenderModel: "test/model",
      cacheTtl: 3600,
    };

    const models: ModelEntry[] = [
      createTextModel(),
      createTextModel({ id: "openrouter::test/model2" }),
      createImageModel(),
    ];

    const stats = computeStats(models, config);

    expect(stats.totalModels).toBe(3);
    expect(stats.byModality["text"]?.count).toBe(2);
    expect(stats.byModality["image"]?.count).toBe(1);
  });

  it("shows count for unpriced modalities while leaving price range empty", () => {
    const config = {
      apiKey: "sk-or-test",
      recommenderModel: "test/model",
      cacheTtl: 3600,
    };

    const models: ModelEntry[] = [
      createImageModel({
        id: "replicate::owner/unpriced-image",
        source: "replicate",
        pricing: { type: "image" },
      }),
    ];

    const stats = computeStats(models, config);
    expect(stats.totalModels).toBe(1);
    expect(stats.byModality.image?.count).toBe(1);
    expect(stats.byModality.image?.pricedCount).toBe(0);
    expect(stats.byModality.image?.priceRange.min).toBe(Number.POSITIVE_INFINITY);
  });

  it("calculates price ranges", () => {
    const config = {
      apiKey: "sk-or-test",
      recommenderModel: "test/model",
      cacheTtl: 3600,
    };

    const models: ModelEntry[] = [
      createTextModel({
        pricing: { type: "text", promptPer1mTokens: 0.5, completionPer1mTokens: 1.0 },
      }),
      createTextModel({
        id: "openrouter::test/expensive",
        pricing: { type: "text", promptPer1mTokens: 5.0, completionPer1mTokens: 10.0 },
      }),
    ];

    const stats = computeStats(models, config);

    expect(stats.byModality["text"]?.priceRange.min).toBe(0.5);
    expect(stats.byModality["text"]?.priceRange.max).toBe(5.0);
  });

  it("identifies configured sources", () => {
    const config = {
      apiKey: "sk-or-test",
      falApiKey: "fal-test",
      recommenderModel: "test/model",
      cacheTtl: 3600,
    };

    const stats = computeStats([], config);

    expect(stats.configuredSources).toContain("openrouter");
    expect(stats.configuredSources).toContain("fal");
    expect(stats.configuredSources).not.toContain("replicate");
  });

  it("identifies missing sources", () => {
    const config = {
      apiKey: "sk-or-test",
      recommenderModel: "test/model",
      cacheTtl: 3600,
    };

    const stats = computeStats([], config);

    const missingFal = stats.missingSources.find((s) => s.name === "fal");
    expect(missingFal).toBeDefined();
    expect(missingFal?.envVar).toBe("FAL_API_KEY");
  });

  it("always treats openrouter as configured (public catalog)", () => {
    const config = {
      apiKey: "",
      recommenderModel: "test/model",
      cacheTtl: 3600,
    };

    const stats = computeStats([], config);
    expect(stats.configuredSources).toContain("openrouter");
    expect(stats.missingSources.some((s) => s.name === "openrouter")).toBe(false);
  });

  it("preserves queried sources when provided", () => {
    const config = {
      apiKey: "sk-or-test",
      recommenderModel: "test/model",
      cacheTtl: 3600,
    };

    const stats = computeStats([createTextModel()], config, ["openrouter", "fal", "replicate"]);
    expect(stats.queriedSources).toEqual(["openrouter", "fal", "replicate"]);
  });

  it("counts all entries but computes price ranges from priced subset only", () => {
    const config = {
      apiKey: "sk-or-test",
      recommenderModel: "test/model",
      cacheTtl: 3600,
    };

    const models: ModelEntry[] = [
      createTextModel({
        id: "openrouter::bad",
        pricing: { type: "text", promptPer1mTokens: -1, completionPer1mTokens: -1 },
      }),
      createTextModel({
        id: "openrouter::good",
        pricing: { type: "text", promptPer1mTokens: 1.25, completionPer1mTokens: 2.5 },
      }),
    ];

    const stats = computeStats(models, config);

    expect(stats.totalModels).toBe(2);
    expect(stats.byModality.text?.count).toBe(2);
    expect(stats.byModality.text?.pricedCount).toBe(1);
    expect(stats.byModality.text?.priceRange.min).toBe(1.25);
  });
});

describe("formatStatsTerminal", () => {
  it("formats stats for terminal output", () => {
    const stats = {
      totalModels: 100,
      sources: ["openrouter"],
      byModality: {
        text: { count: 90, pricedCount: 90, priceRange: { min: 0.01, max: 10.0 } },
        image: { count: 10, pricedCount: 10, priceRange: { min: 0.02, max: 0.5 } },
      },
      configuredSources: ["openrouter"],
      missingSources: [{ name: "fal", envVar: "FAL_API_KEY", getUrl: "https://fal.ai" }],
    };

    const output = formatStatsTerminal(stats, true);

    expect(output).toContain("100 models");
    expect(output).toContain("openrouter");
    expect(output).toContain("Text");
    expect(output).toContain("Image");
    expect(output).toContain("90");
    expect(output).toContain("10");
    expect(output).toContain("╭");
  });

  it("handles empty catalog", () => {
    const stats = {
      totalModels: 0,
      sources: [],
      byModality: {},
      configuredSources: [],
      missingSources: [],
    };

    const output = formatStatsTerminal(stats, true);

    expect(output).toContain("0 models");
    expect(output).toContain("╭");
  });

  it("shows queried source count when it differs from priced source count", () => {
    const stats = {
      totalModels: 10,
      queriedSources: ["openrouter", "fal", "replicate"],
      sources: ["openrouter", "fal"],
      byModality: {
        text: { count: 10, pricedCount: 10, priceRange: { min: 0.01, max: 1.0 } },
      },
      configuredSources: ["openrouter", "fal", "replicate"],
      missingSources: [],
    };

    const output = formatStatsTerminal(stats, true);
    expect(output).toContain("3 queried sources (2 with priced models)");
  });
});
