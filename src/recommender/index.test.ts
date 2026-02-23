import { describe, expect, it, vi } from "vitest";
import { ExitCode, WhichModelError, type ModelEntry } from "../types.js";

const models: ModelEntry[] = [
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

describe("recommend", () => {
  it("uses llm response when valid", async () => {
    vi.doMock("./llm-client.js", () => ({
      requestRecommendationCompletion: vi.fn().mockResolvedValue({
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
      }),
    }));

    const { recommend } = await import("./index.js");
    const result = await recommend({
      task: "summarize legal docs",
      models,
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
    vi.resetModules();
    vi.doMock("./llm-client.js", () => ({
      requestRecommendationCompletion: vi
        .fn()
        .mockRejectedValue(
          new WhichModelError("LLM failed", ExitCode.LLM_FAILED, "retry")
        ),
    }));

    const { recommend } = await import("./index.js");
    const result = await recommend({
      task: "summarize legal docs",
      models,
      apiKey: "sk-or-test",
      recommenderModel: "deepseek/deepseek-v3.2",
      catalogSources: ["openrouter"],
    });

    expect(result.recommendation.taskAnalysis.detectedModality).toBe("text");
    expect(result.recommendation.recommendations.cheapest.id).toBe(
      "openrouter::deepseek/deepseek-v3.2"
    );
  });
});
