import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ModelEntry, TextPricing } from "../types.js";
import {
  selectBestRecommender,
  DEFAULT_RECOMMENDER_CRITERIA,
  updateConfigFile,
  updateRecommenderModel,
} from "./update-recommender.js";

function createTextModel(overrides: Partial<ModelEntry> = {}): ModelEntry {
  const pricing: TextPricing = {
    type: "text",
    promptPer1mTokens: 0.50,
    completionPer1mTokens: 1.00,
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
    contextLength: 32768,
    ...overrides,
  };
}

describe("selectBestRecommender", () => {
  it("selects cheapest model meeting criteria", () => {
    const models: ModelEntry[] = [
      createTextModel({
        id: "openrouter::expensive/model",
        name: "Expensive Model",
        family: "claude",
        pricing: { type: "text", promptPer1mTokens: 5.0, completionPer1mTokens: 15.0 },
      }),
      createTextModel({
        id: "openrouter::cheap/model",
        name: "Cheap Model",
        family: "deepseek",
        pricing: { type: "text", promptPer1mTokens: 0.25, completionPer1mTokens: 0.50 },
      }),
    ];

    const result = selectBestRecommender(models, DEFAULT_RECOMMENDER_CRITERIA);

    expect(result).not.toBeNull();
    expect(result?.id).toBe("openrouter::cheap/model");
  });

  it("filters out models exceeding max price", () => {
    const models: ModelEntry[] = [
      createTextModel({
        id: "openrouter::expensive/model",
        name: "Expensive Model",
        family: "claude",
        pricing: { type: "text", promptPer1mTokens: 10.0, completionPer1mTokens: 30.0 },
      }),
    ];

    const result = selectBestRecommender(models, DEFAULT_RECOMMENDER_CRITERIA);

    expect(result).toBeNull();
  });

  it("filters out models with insufficient context", () => {
    const models: ModelEntry[] = [
      createTextModel({
        id: "openrouter::small/model",
        name: "Small Context Model",
        family: "deepseek",
        contextLength: 4096, // Below minimum of 32000
        pricing: { type: "text", promptPer1mTokens: 0.10, completionPer1mTokens: 0.20 },
      }),
    ];

    const result = selectBestRecommender(models, DEFAULT_RECOMMENDER_CRITERIA);

    expect(result).toBeNull();
  });

  it("filters out non-text models", () => {
    const models: ModelEntry[] = [
      createTextModel({
        id: "fal::image/model",
        name: "Image Model",
        modality: "image",
        family: "flux",
      }),
    ];

    const result = selectBestRecommender(models, DEFAULT_RECOMMENDER_CRITERIA);

    expect(result).toBeNull();
  });

  it("returns null when no models meet criteria", () => {
    const models: ModelEntry[] = [];

    const result = selectBestRecommender(models, DEFAULT_RECOMMENDER_CRITERIA);

    expect(result).toBeNull();
  });

  it("prefers models from reasoning families", () => {
    const models: ModelEntry[] = [
      createTextModel({
        id: "openrouter::unknown/model",
        name: "Unknown Model",
        family: "unknown",
        pricing: { type: "text", promptPer1mTokens: 0.10, completionPer1mTokens: 0.20 },
      }),
      createTextModel({
        id: "openrouter::deepseek/model",
        name: "DeepSeek Model",
        family: "deepseek",
        pricing: { type: "text", promptPer1mTokens: 0.25, completionPer1mTokens: 0.50 },
      }),
    ];

    const result = selectBestRecommender(models, DEFAULT_RECOMMENDER_CRITERIA);

    // The unknown family model should be filtered out as not supporting reasoning
    expect(result).not.toBeNull();
    expect(result?.family).toBe("deepseek");
  });

  it("only selects from openrouter source", () => {
    const models: ModelEntry[] = [
      createTextModel({
        id: "replicate::deepseek/free",
        source: "replicate",
        name: "Replicate DeepSeek",
        family: "deepseek",
        pricing: { type: "text", promptPer1mTokens: 0.01, completionPer1mTokens: 0.01 },
      }),
      createTextModel({
        id: "openrouter::deepseek/deepseek-v3.2",
        source: "openrouter",
        name: "OpenRouter DeepSeek",
        family: "deepseek",
        pricing: { type: "text", promptPer1mTokens: 0.25, completionPer1mTokens: 0.38 },
      }),
    ];

    const result = selectBestRecommender(models, DEFAULT_RECOMMENDER_CRITERIA);

    expect(result).not.toBeNull();
    expect(result?.source).toBe("openrouter");
  });
});

describe("updateRecommenderModel", () => {
  it("treats prefixed and unprefixed current model IDs as the same model", async () => {
    const models: ModelEntry[] = [
      createTextModel({
        id: "openrouter::deepseek/deepseek-v3.2",
        name: "DeepSeek V3.2",
        family: "deepseek",
        pricing: { type: "text", promptPer1mTokens: 0.25, completionPer1mTokens: 0.38 },
      }),
    ];

    const result = await updateRecommenderModel(models, "deepseek/deepseek-v3.2");

    expect(result.changed).toBe(false);
    expect(result.newModel).toBe("deepseek/deepseek-v3.2");
    expect(result.savings).not.toBeNull();
    expect(result.savings?.promptPer1m).toBe(0);
    expect(result.savings?.completionPer1m).toBe(0);
  });
});

describe("updateConfigFile", () => {
  it("writes to WHICHMODEL_CONFIG when provided", async () => {
    const original = process.env.WHICHMODEL_CONFIG;
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "whichmodel-config-test-"));
    const configPath = path.join(tempDir, "custom-config.json");
    process.env.WHICHMODEL_CONFIG = configPath;

    try {
      await updateConfigFile({ recommenderModel: "deepseek/deepseek-v3.2" });
      const content = await fs.readFile(configPath, "utf8");
      const parsed = JSON.parse(content) as { recommenderModel?: string };
      expect(parsed.recommenderModel).toBe("deepseek/deepseek-v3.2");
    } finally {
      if (original === undefined) {
        delete process.env.WHICHMODEL_CONFIG;
      } else {
        process.env.WHICHMODEL_CONFIG = original;
      }
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
