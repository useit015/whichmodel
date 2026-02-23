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

const mixedModels: ModelEntry[] = [
  ...textModels,
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
    maxResolution: "1024x1024",
  },
  {
    id: "fal::fal-ai/flux-2-pro",
    source: "fal",
    name: "FLUX.2 Pro",
    modality: "image",
    inputModalities: ["text"],
    outputModalities: ["image"],
    pricing: { type: "image", perImage: 0.03 },
    provider: "fal-ai",
    family: "flux",
    maxResolution: "1024x1024",
  },
  {
    id: "fal::fal-ai/veo3",
    source: "fal",
    name: "Veo 3",
    modality: "video",
    inputModalities: ["text"],
    outputModalities: ["video"],
    pricing: { type: "video", perSecond: 0.4 },
    provider: "fal-ai",
    family: "other",
    maxDuration: 8,
  },
  {
    id: "fal::fal-ai/whisper-v3",
    source: "fal",
    name: "Whisper v3",
    modality: "audio_stt",
    inputModalities: ["audio"],
    outputModalities: ["text"],
    pricing: { type: "audio", perMinute: 0.006 },
    provider: "fal-ai",
    family: "whisper",
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

  it("ignores invalid non-positive pricing when picking cheapest", () => {
    const baseline = textModels[0];
    if (!baseline) {
      throw new Error("Missing baseline model fixture");
    }

    const rec = generateFallbackRecommendation("summarize legal contracts", [
      {
        ...baseline,
        id: "openrouter::bad/negative-pricing",
        pricing: { type: "text", promptPer1mTokens: -100, completionPer1mTokens: -100 },
      },
      ...textModels,
    ]);

    expect(rec.recommendations.cheapest.id).toBe("openrouter::deepseek/deepseek-v3.2");
  });

  it("prefers image models for image tasks", () => {
    const rec = generateFallbackRecommendation(
      "generate product photos for ecommerce",
      mixedModels
    );

    expect(rec.taskAnalysis.detectedModality).toBe("image");
    expect(rec.recommendations.cheapest.id).toBe("fal::fal-ai/flux-2");
    expect(rec.recommendations.cheapest.id.startsWith("fal::")).toBe(true);
  });

  it("prefers video models for video tasks", () => {
    const rec = generateFallbackRecommendation(
      "create 15-second product demo videos",
      mixedModels
    );

    expect(rec.taskAnalysis.detectedModality).toBe("video");
    expect(rec.recommendations.cheapest.id).toBe("fal::fal-ai/veo3");
  });

  it("prefers audio stt models for transcription tasks", () => {
    const rec = generateFallbackRecommendation("transcribe my podcast episodes", mixedModels);

    expect(rec.taskAnalysis.detectedModality).toBe("audio_stt");
    expect(rec.recommendations.cheapest.id).toBe("fal::fal-ai/whisper-v3");
  });
});
