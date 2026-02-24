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

  it("handles image pricing with perImage", () => {
    const expensive: ModelEntry = {
      ...baseTextModel,
      id: "test::image-model",
      modality: "image",
      pricing: { type: "image", perImage: 0.10 },
    };
    const cheaper: ModelEntry = {
      ...baseTextModel,
      id: "test::image-model",
      modality: "image",
      pricing: { type: "image", perImage: 0.05 },
    };

    const merged = mergeCatalogModels([[expensive], [cheaper]]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.pricing).toMatchObject({ type: "image", perImage: 0.05 });
  });

  it("handles image pricing with perMegapixel fallback", () => {
    const model: ModelEntry = {
      ...baseTextModel,
      id: "test::image-model",
      modality: "image",
      pricing: { type: "image", perMegapixel: 0.02 },
    };

    const merged = mergeCatalogModels([[model], [{ ...model }]]);
    expect(merged).toHaveLength(1);
  });

  it("handles image pricing with perStep fallback", () => {
    const model: ModelEntry = {
      ...baseTextModel,
      id: "test::image-model",
      modality: "image",
      pricing: { type: "image", perStep: 0.001 },
    };

    const merged = mergeCatalogModels([[model]]);
    expect(merged).toHaveLength(1);
  });

  it("handles video pricing with perSecond", () => {
    const expensive: ModelEntry = {
      ...baseTextModel,
      id: "test::video-model",
      modality: "video",
      pricing: { type: "video", perSecond: 0.10 },
    };
    const cheaper: ModelEntry = {
      ...baseTextModel,
      id: "test::video-model",
      modality: "video",
      pricing: { type: "video", perSecond: 0.05 },
    };

    const merged = mergeCatalogModels([[expensive], [cheaper]]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.pricing).toMatchObject({ type: "video", perSecond: 0.05 });
  });

  it("handles video pricing with perGeneration fallback", () => {
    const model: ModelEntry = {
      ...baseTextModel,
      id: "test::video-model",
      modality: "video",
      pricing: { type: "video", perGeneration: 1.0 },
    };

    const merged = mergeCatalogModels([[model]]);
    expect(merged).toHaveLength(1);
  });

  it("handles audio pricing with perMinute", () => {
    const expensive: ModelEntry = {
      ...baseTextModel,
      id: "test::audio-model",
      modality: "audio_tts",
      pricing: { type: "audio", perMinute: 0.20 },
    };
    const cheaper: ModelEntry = {
      ...baseTextModel,
      id: "test::audio-model",
      modality: "audio_tts",
      pricing: { type: "audio", perMinute: 0.10 },
    };

    const merged = mergeCatalogModels([[expensive], [cheaper]]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.pricing).toMatchObject({ type: "audio", perMinute: 0.10 });
  });

  it("handles audio pricing with perCharacter fallback", () => {
    const model: ModelEntry = {
      ...baseTextModel,
      id: "test::audio-model",
      modality: "audio_tts",
      pricing: { type: "audio", perCharacter: 0.0001 },
    };

    const merged = mergeCatalogModels([[model]]);
    expect(merged).toHaveLength(1);
  });

  it("handles audio pricing with perSecond fallback", () => {
    const model: ModelEntry = {
      ...baseTextModel,
      id: "test::audio-model",
      modality: "audio_tts",
      pricing: { type: "audio", perSecond: 0.01 },
    };

    const merged = mergeCatalogModels([[model]]);
    expect(merged).toHaveLength(1);
  });

  it("handles embedding pricing", () => {
    const expensive: ModelEntry = {
      ...baseTextModel,
      id: "test::embedding-model",
      modality: "embedding",
      pricing: { type: "embedding", per1mTokens: 0.10 },
    };
    const cheaper: ModelEntry = {
      ...baseTextModel,
      id: "test::embedding-model",
      modality: "embedding",
      pricing: { type: "embedding", per1mTokens: 0.02 },
    };

    const merged = mergeCatalogModels([[expensive], [cheaper]]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.pricing).toMatchObject({ type: "embedding", per1mTokens: 0.02 });
  });

  it("keeps first model when completeness and price are equal", () => {
    const first: ModelEntry = {
      ...baseTextModel,
      name: "First Model",
      contextLength: 1000,
    };
    const second: ModelEntry = {
      ...baseTextModel,
      name: "Second Model",
      contextLength: 1000,
    };

    const merged = mergeCatalogModels([[first], [second]]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.name).toBe("First Model");
  });

  it("handles empty input arrays", () => {
    const merged = mergeCatalogModels([]);
    expect(merged).toHaveLength(0);
  });

  it("handles empty source arrays", () => {
    const merged = mergeCatalogModels([[], [baseTextModel]]);
    expect(merged).toHaveLength(1);
  });

  it("considers maxDuration in completeness score", () => {
    const withoutDuration: ModelEntry = { ...baseTextModel, contextLength: 1000 };
    const withDuration: ModelEntry = {
      ...baseTextModel,
      contextLength: 1000,
      maxDuration: 60,
    };

    const merged = mergeCatalogModels([[withoutDuration], [withDuration]]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.maxDuration).toBe(60);
  });

  it("considers maxResolution in completeness score", () => {
    const withoutRes: ModelEntry = { ...baseTextModel, contextLength: 1000 };
    const withRes: ModelEntry = {
      ...baseTextModel,
      contextLength: 1000,
      maxResolution: "1024x1024",
    };

    const merged = mergeCatalogModels([[withoutRes], [withRes]]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.maxResolution).toBe("1024x1024");
  });

  it("considers inputModalities in completeness score", () => {
    const withoutModalities: ModelEntry = {
      ...baseTextModel,
      contextLength: 1000,
      inputModalities: [],
      outputModalities: [],
    };
    const withModalities: ModelEntry = {
      ...baseTextModel,
      contextLength: 1000,
      inputModalities: ["text", "image"],
      outputModalities: ["text"],
    };

    const merged = mergeCatalogModels([[withoutModalities], [withModalities]]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.inputModalities).toEqual(["text", "image"]);
  });

  it("prefers model with perStep price when perImage and perMegapixel are missing", () => {
    const withoutPerStep: ModelEntry = {
      ...baseTextModel,
      id: "test::image-model",
      modality: "image",
      pricing: { type: "image", perStep: undefined as unknown as number },
    };
    const withPerStep: ModelEntry = {
      ...baseTextModel,
      id: "test::image-model",
      modality: "image",
      pricing: { type: "image", perStep: 0.01 },
    };

    const merged = mergeCatalogModels([[withoutPerStep], [withPerStep]]);
    expect(merged).toHaveLength(1);
  });

  it("prefers model with perGeneration price when perSecond is missing for video", () => {
    const withoutPerGen: ModelEntry = {
      ...baseTextModel,
      id: "test::video-model",
      modality: "video",
      pricing: { type: "video", perGeneration: undefined as unknown as number },
    };
    const withPerGen: ModelEntry = {
      ...baseTextModel,
      id: "test::video-model",
      modality: "video",
      pricing: { type: "video", perGeneration: 1.0 },
    };

    const merged = mergeCatalogModels([[withoutPerGen], [withPerGen]]);
    expect(merged).toHaveLength(1);
  });

  it("prefers model with perCharacter price when perMinute is missing for audio", () => {
    const withoutPerChar: ModelEntry = {
      ...baseTextModel,
      id: "test::audio-model",
      modality: "audio_tts",
      pricing: { type: "audio", perCharacter: undefined as unknown as number },
    };
    const withPerChar: ModelEntry = {
      ...baseTextModel,
      id: "test::audio-model",
      modality: "audio_tts",
      pricing: { type: "audio", perCharacter: 0.0001 },
    };

    const merged = mergeCatalogModels([[withoutPerChar], [withPerChar]]);
    expect(merged).toHaveLength(1);
  });

  it("prefers model with perSecond price when perMinute and perCharacter are missing for audio", () => {
    const withoutPerSec: ModelEntry = {
      ...baseTextModel,
      id: "test::audio-model",
      modality: "audio_tts",
      pricing: { type: "audio", perSecond: undefined as unknown as number },
    };
    const withPerSec: ModelEntry = {
      ...baseTextModel,
      id: "test::audio-model",
      modality: "audio_tts",
      pricing: { type: "audio", perSecond: 0.01 },
    };

    const merged = mergeCatalogModels([[withoutPerSec], [withPerSec]]);
    expect(merged).toHaveLength(1);
  });
});
