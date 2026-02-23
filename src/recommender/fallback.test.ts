import { describe, expect, it } from "vitest";
import {
  detectTaskModality,
  generateFallbackRecommendation,
} from "./fallback.js";
import type { ModelEntry } from "../types.js";

const textModels: ModelEntry[] = [
  {
    id: "openrouter::deepseek/deepseek-v3.2",
    source: "openrouter",
    name: "DeepSeek V3.2",
    modality: "text",
    inputModalities: ["text"],
    outputModalities: ["text"],
    pricing: { type: "text", promptPer1mTokens: 0.25, completionPer1mTokens: 0.38 },
    contextLength: 163840,
    provider: "deepseek",
    family: "deepseek",
  },
  {
    id: "openrouter::google/gemini-2.5-flash",
    source: "openrouter",
    name: "Gemini 2.5 Flash",
    modality: "text",
    inputModalities: ["text"],
    outputModalities: ["text"],
    pricing: { type: "text", promptPer1mTokens: 0.3, completionPer1mTokens: 2.5 },
    contextLength: 1_048_576,
    provider: "google",
    family: "gemini",
  },
  {
    id: "openrouter::anthropic/claude-sonnet-4",
    source: "openrouter",
    name: "Claude Sonnet 4",
    modality: "text",
    inputModalities: ["text"],
    outputModalities: ["text"],
    pricing: { type: "text", promptPer1mTokens: 3, completionPer1mTokens: 15 },
    contextLength: 200000,
    provider: "anthropic",
    family: "claude",
  },
];

describe("detectTaskModality", () => {
  it("detects key modalities", () => {
    expect(detectTaskModality("transcribe my podcast")).toBe("audio_stt");
    expect(detectTaskModality("generate product photos")).toBe("image");
    expect(detectTaskModality("build semantic search")).toBe("embedding");
  });
});

describe("generateFallbackRecommendation", () => {
  it("returns cheapest, balanced, and best picks", () => {
    const rec = generateFallbackRecommendation("summarize legal contracts", textModels);

    expect(rec.recommendations.cheapest.id).toBe("openrouter::deepseek/deepseek-v3.2");
    expect(rec.recommendations.balanced.id).toBeDefined();
    expect(rec.recommendations.best.id).toBeDefined();
    expect(rec.taskAnalysis.detectedModality).toBe("text");
  });
});
