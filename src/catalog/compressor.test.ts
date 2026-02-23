import { describe, expect, it } from "vitest";
import { compressForLLM, groupByModality } from "./compressor.js";
import type { ModelEntry } from "../types.js";

const models: ModelEntry[] = [
  {
    id: "openrouter::deepseek/deepseek-v3.2",
    source: "openrouter",
    name: "DeepSeek V3.2",
    modality: "text",
    inputModalities: ["text"],
    outputModalities: ["text"],
    pricing: {
      type: "text",
      promptPer1mTokens: 0.25,
      completionPer1mTokens: 0.38,
    },
    contextLength: 163840,
    provider: "deepseek",
    family: "deepseek",
  },
  {
    id: "openrouter::google/gemini-2.5-flash",
    source: "openrouter",
    name: "Gemini 2.5 Flash",
    modality: "vision",
    inputModalities: ["text", "image"],
    outputModalities: ["text"],
    pricing: {
      type: "text",
      promptPer1mTokens: 0.3,
      completionPer1mTokens: 2.5,
    },
    contextLength: 1_048_576,
    provider: "google",
    family: "gemini",
  },
];

describe("compressForLLM", () => {
  it("keeps essential fields while flattening pricing", () => {
    const compressed = compressForLLM(models);

    expect(compressed).toHaveLength(2);
    expect(compressed[0]).toMatchObject({
      id: "openrouter::deepseek/deepseek-v3.2",
      modality: "text",
      pricing: {
        promptPer1mTokens: 0.25,
        completionPer1mTokens: 0.38,
      },
      contextLength: 163840,
    });
  });
});

describe("groupByModality", () => {
  it("groups compressed models by modality", () => {
    const grouped = groupByModality(compressForLLM(models));

    expect(grouped.text).toHaveLength(1);
    expect(grouped.vision).toHaveLength(1);
    expect(grouped.text?.[0]?.id).toBe("openrouter::deepseek/deepseek-v3.2");
  });
});
