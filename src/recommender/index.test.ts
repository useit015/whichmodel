import { describe, expect, it, vi } from "vitest";
import { ExitCode, WhichModelError, type ModelEntry } from "../types.js";

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
  },
  {
    id: "fal::fal-ai/kling-v2",
    source: "fal",
    name: "Kling v2",
    modality: "video",
    inputModalities: ["text"],
    outputModalities: ["video"],
    pricing: { type: "video", perGeneration: 0.6 },
    provider: "fal-ai",
    family: "kling",
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
  {
    id: "fal::fal-ai/whisper-lite",
    source: "fal",
    name: "Whisper Lite",
    modality: "audio_stt",
    inputModalities: ["audio"],
    outputModalities: ["text"],
    pricing: { type: "audio", perMinute: 0.003 },
    provider: "fal-ai",
    family: "whisper",
  },
];

describe("recommend", () => {
  const modalityById = new Map(mixedModels.map((model) => [model.id, model.modality]));

  function expectAllTiersInModality(result: Awaited<ReturnType<(typeof import("./index.js"))["recommend"]>>, modality: string) {
    const tiers = [
      result.recommendation.recommendations.cheapest.id,
      result.recommendation.recommendations.balanced.id,
      result.recommendation.recommendations.best.id,
    ];

    for (const id of tiers) {
      expect(modalityById.get(id)).toBe(modality);
    }
  }

  async function loadRecommendWithMock(completionOrError: unknown) {
    vi.resetModules();
    vi.doMock("./llm-client.js", () => {
      if (completionOrError instanceof Error) {
        return {
          requestRecommendationCompletion: vi.fn().mockRejectedValue(completionOrError),
        };
      }
      return {
        requestRecommendationCompletion: vi.fn().mockResolvedValue(completionOrError),
      };
    });
    return import("./index.js");
  }

  it("uses llm response when valid", async () => {
    const { recommend } = await loadRecommendWithMock({
        content: JSON.stringify({
          taskAnalysis: {
            summary: "summary",
            detectedModality: "text",
            modalityReasoning: "reason",
            keyRequirements: ["k1"],
            costFactors: "tokens",
          },
          recommendations: {
            cheapest: {
              id: "openrouter::deepseek/deepseek-v3.2",
              reason: "r",
              pricingSummary: "p",
              estimatedCost: "e",
            },
            balanced: {
              id: "openrouter::google/gemini-2.5-flash",
              reason: "r",
              pricingSummary: "p",
              estimatedCost: "e",
            },
            best: {
              id: "openrouter::anthropic/claude-sonnet-4",
              reason: "r",
              pricingSummary: "p",
              estimatedCost: "e",
            },
          },
          alternativesInOtherModalities: null,
        }),
        model: "deepseek/deepseek-v3.2",
        usage: { promptTokens: 1000, completionTokens: 200 },
      });
    const result = await recommend({
      task: "summarize legal docs",
      models: textModels,
      apiKey: "sk-or-test",
      recommenderModel: "deepseek/deepseek-v3.2",
      catalogSources: ["openrouter"],
    });

    expect(result.recommendation.recommendations.cheapest.id).toBe(
      "openrouter::deepseek/deepseek-v3.2"
    );
    expect(result.meta.promptTokens).toBe(1000);
  });

  it("falls back when llm fails", async () => {
    const { recommend } = await loadRecommendWithMock(
      new WhichModelError("LLM failed", ExitCode.LLM_FAILED, "retry")
    );
    const result = await recommend({
      task: "summarize legal docs",
      models: textModels,
      apiKey: "sk-or-test",
      recommenderModel: "deepseek/deepseek-v3.2",
      catalogSources: ["openrouter"],
    });

    expect(result.recommendation.taskAnalysis.detectedModality).toBe("text");
    expect(result.recommendation.recommendations.cheapest.id).toBe(
      "openrouter::deepseek/deepseek-v3.2"
    );
  });

  it("returns image model picks for image tasks in fallback path", async () => {
    const { recommend } = await loadRecommendWithMock(
      new WhichModelError("LLM failed", ExitCode.LLM_FAILED, "retry")
    );

    const result = await recommend({
      task: "generate product photos for ecommerce",
      models: mixedModels,
      apiKey: "sk-or-test",
      recommenderModel: "deepseek/deepseek-v3.2",
      catalogSources: ["openrouter", "fal"],
    });

    expect(result.recommendation.taskAnalysis.detectedModality).toBe("image");
    expect(result.recommendation.recommendations.cheapest.id).toBe("fal::fal-ai/flux-2");
    expectAllTiersInModality(result, "image");
    expect(result.meta.catalogModelsInModality).toBeGreaterThan(0);
  });

  it("returns video model picks for video tasks in fallback path", async () => {
    const { recommend } = await loadRecommendWithMock(
      new WhichModelError("LLM failed", ExitCode.LLM_FAILED, "retry")
    );

    const result = await recommend({
      task: "create 15-second product demo videos",
      models: mixedModels,
      apiKey: "sk-or-test",
      recommenderModel: "deepseek/deepseek-v3.2",
      catalogSources: ["openrouter", "fal"],
    });

    expect(result.recommendation.taskAnalysis.detectedModality).toBe("video");
    expect(result.recommendation.recommendations.cheapest.id).toBe("fal::fal-ai/veo3");
    expectAllTiersInModality(result, "video");
    expect(result.meta.catalogModelsInModality).toBeGreaterThan(0);
  });

  it("returns audio stt model picks for transcription tasks in fallback path", async () => {
    const { recommend } = await loadRecommendWithMock(
      new WhichModelError("LLM failed", ExitCode.LLM_FAILED, "retry")
    );

    const result = await recommend({
      task: "transcribe my podcast episodes",
      models: mixedModels,
      apiKey: "sk-or-test",
      recommenderModel: "deepseek/deepseek-v3.2",
      catalogSources: ["openrouter", "fal"],
    });

    expect(result.recommendation.taskAnalysis.detectedModality).toBe("audio_stt");
    expect(result.recommendation.recommendations.cheapest.id).toBe("fal::fal-ai/whisper-lite");
    expectAllTiersInModality(result, "audio_stt");
    expect(result.meta.catalogModelsInModality).toBeGreaterThan(0);
  });

  it("adds guidance when no models exist for detected modality", async () => {
    const { recommend } = await loadRecommendWithMock(
      new WhichModelError("LLM failed", ExitCode.LLM_FAILED, "retry")
    );

    const result = await recommend({
      task: "create 15-second product demo videos",
      models: textModels,
      apiKey: "sk-or-test",
      recommenderModel: "deepseek/deepseek-v3.2",
      catalogSources: ["openrouter"],
    });

    expect(result.meta.catalogModelsInModality).toBe(0);
    expect(result.recommendation.alternativesInOtherModalities).toContain(
      "No 'video' models are available in configured sources (openrouter)."
    );
    expect(result.recommendation.alternativesInOtherModalities).toContain(
      "set FAL_API_KEY"
    );
    expect(result.recommendation.alternativesInOtherModalities).toContain(
      "set REPLICATE_API_TOKEN"
    );
  });
});
