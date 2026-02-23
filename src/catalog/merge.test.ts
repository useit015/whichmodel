import { describe, expect, it } from "vitest";
import type { ModelEntry } from "../types.js";
import { mergeCatalogModels } from "./merge.js";

const baseTextModel: ModelEntry = {
  id: "openrouter::deepseek/deepseek-v3.2",
  source: "openrouter",
  name: "DeepSeek V3.2",
  modality: "text",
  inputModalities: ["text"],
  outputModalities: ["text"],
  pricing: { type: "text", promptPer1mTokens: 0.25, completionPer1mTokens: 0.38 },
  provider: "deepseek",
  family: "deepseek",
};

describe("mergeCatalogModels", () => {
  it("deduplicates identical IDs", () => {
    const merged = mergeCatalogModels([[baseTextModel], [{ ...baseTextModel }]]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe(baseTextModel.id);
  });

  it("prefers richer metadata when duplicate IDs exist", () => {
    const sparse: ModelEntry = { ...baseTextModel };
    const rich: ModelEntry = {
      ...baseTextModel,
      contextLength: 200000,
      supportsStreaming: true,
    };

    const merged = mergeCatalogModels([[sparse], [rich]]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.contextLength).toBe(200000);
    expect(merged[0]?.supportsStreaming).toBe(true);
  });

  it("prefers lower price when completeness is equal", () => {
    const expensive: ModelEntry = {
      ...baseTextModel,
      pricing: { type: "text", promptPer1mTokens: 1, completionPer1mTokens: 2 },
      contextLength: 1000,
    };
    const cheaper: ModelEntry = {
      ...baseTextModel,
      pricing: { type: "text", promptPer1mTokens: 0.1, completionPer1mTokens: 0.2 },
      contextLength: 1000,
    };

    const merged = mergeCatalogModels([[expensive], [cheaper]]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.pricing).toMatchObject({
      type: "text",
      promptPer1mTokens: 0.1,
      completionPer1mTokens: 0.2,
    });
  });

  it("keeps same provider/model from different sources", () => {
    const openrouter: ModelEntry = {
      ...baseTextModel,
      id: "openrouter::openai/gpt-4o",
      source: "openrouter",
      provider: "openai",
      family: "gpt",
      name: "GPT-4o",
    };
    const fal: ModelEntry = {
      ...baseTextModel,
      id: "fal::openai/gpt-4o",
      source: "fal",
      provider: "openai",
      family: "gpt",
      name: "GPT-4o",
    };

    const merged = mergeCatalogModels([[openrouter], [fal]]);
    expect(merged).toHaveLength(2);
    expect(merged.map((model) => model.id)).toEqual([
      "openrouter::openai/gpt-4o",
      "fal::openai/gpt-4o",
    ]);
  });
});
