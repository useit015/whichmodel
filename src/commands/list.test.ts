import { describe, expect, it } from "vitest";
import type { ModelEntry, TextPricing, ImagePricing } from "../types.js";
import { filterAndSortModels, formatListTerminal } from "./list.js";

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

describe("filterAndSortModels", () => {
  it("filters by modality", () => {
    const models: ModelEntry[] = [
      createTextModel(),
      createImageModel(),
    ];

    const result = filterAndSortModels(models, {
      modality: "image",
      sort: "price",
      limit: 50,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.modality).toBe("image");
  });

  it("filters by source", () => {
    const models: ModelEntry[] = [
      createTextModel(),
      createImageModel(),
    ];

    const result = filterAndSortModels(models, {
      source: "openrouter",
      sort: "price",
      limit: 50,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.source).toBe("openrouter");
  });

  it("sorts by price ascending", () => {
    const models: ModelEntry[] = [
      createTextModel({
        id: "openrouter::expensive",
        pricing: { type: "text", promptPer1mTokens: 10.0, completionPer1mTokens: 20.0 },
      }),
      createTextModel({
        id: "openrouter::cheap",
        pricing: { type: "text", promptPer1mTokens: 0.1, completionPer1mTokens: 0.2 },
      }),
    ];

    const result = filterAndSortModels(models, {
      sort: "price",
      limit: 50,
    });

    expect(result[0]?.id).toBe("openrouter::cheap");
    expect(result[1]?.id).toBe("openrouter::expensive");
  });

  it("sorts by name alphabetically", () => {
    const models: ModelEntry[] = [
      createTextModel({ id: "openrouter::zebra", name: "Zebra Model" }),
      createTextModel({ id: "openrouter::alpha", name: "Alpha Model" }),
    ];

    const result = filterAndSortModels(models, {
      sort: "name",
      limit: 50,
    });

    expect(result[0]?.name).toBe("Alpha Model");
    expect(result[1]?.name).toBe("Zebra Model");
  });

  it("sorts by context descending", () => {
    const models: ModelEntry[] = [
      createTextModel({ id: "openrouter::small", contextLength: 4096 }),
      createTextModel({ id: "openrouter::large", contextLength: 128000 }),
    ];

    const result = filterAndSortModels(models, {
      sort: "context",
      limit: 50,
    });

    expect(result[0]?.id).toBe("openrouter::large");
    expect(result[1]?.id).toBe("openrouter::small");
  });

  it("limits results", () => {
    const models: ModelEntry[] = [
      createTextModel({ id: "openrouter::model1" }),
      createTextModel({ id: "openrouter::model2" }),
      createTextModel({ id: "openrouter::model3" }),
    ];

    const result = filterAndSortModels(models, {
      sort: "price",
      limit: 2,
    });

    expect(result).toHaveLength(2);
  });

  it("excludes models with unusable pricing from ranked output", () => {
    const models: ModelEntry[] = [
      createTextModel({
        id: "openrouter::bad-pricing",
        pricing: { type: "text", promptPer1mTokens: -1, completionPer1mTokens: -1 },
      }),
      createTextModel({
        id: "openrouter::valid",
        pricing: { type: "text", promptPer1mTokens: 0.2, completionPer1mTokens: 0.3 },
      }),
    ];

    const result = filterAndSortModels(models, {
      sort: "price",
      limit: 50,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("openrouter::valid");
  });

  it("combines filters", () => {
    const models: ModelEntry[] = [
      createTextModel({ id: "openrouter::text1" }),
      createTextModel({ id: "fal::text2", source: "fal" }),
      createImageModel(),
    ];

    const result = filterAndSortModels(models, {
      modality: "text",
      source: "openrouter",
      sort: "price",
      limit: 50,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("openrouter::text1");
  });
});

describe("formatListTerminal", () => {
  it("formats models as a table", () => {
    const items = [
      {
        id: "openrouter::test/model",
        name: "Test Model",
        pricing: "$1.00 / $2.00",
        context: 4096,
        modality: "text",
        source: "openrouter",
      },
    ];

    const output = formatListTerminal(items, 1, { sort: "price", limit: 50 });

    expect(output).toContain("Test Model");
    expect(output).toContain("openrouter");
    expect(output).toContain("╭");
  });

  it("shows no models message when empty", () => {
    const output = formatListTerminal([], 0, { sort: "price", limit: 50 });

    expect(output).toContain("No models found");
    expect(output).toContain("╭");
  });

  it("shows limit hint when results are limited", () => {
    const items = [
      {
        id: "openrouter::test/model",
        name: "Test Model",
        pricing: "$1.00 / $2.00",
        modality: "text",
        source: "openrouter",
      },
    ];

    const output = formatListTerminal(items, 100, { sort: "price", limit: 1 });

    expect(output).toContain("showing top 1");
  });

  it("truncates long cells to keep table layout stable", () => {
    const items = [
      {
        id: "fal::fal-ai/chrono-edit-lora-gallery/paintbrush/with/very/long/identifier",
        name: "A Very Long Model Name That Should Be Truncated In Narrow Terminals",
        pricing: "$0.000123 / image with additional details",
        context: 4096,
        modality: "image",
        source: "fal",
      },
    ];

    const output = formatListTerminal(items, 1, { sort: "price", limit: 5 }, true);

    expect(output).toContain("...");
    expect(output).toContain("┌");
    expect(output).toContain("└");
  });
});
