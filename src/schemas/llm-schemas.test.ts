import { describe, expect, it } from "vitest";
import {
  parseCompareResultPayload,
  parseOpenRouterChatResponse,
  parseRecommendationPayload,
} from "./llm-schemas.js";

describe("llm-schemas", () => {
  it("parses recommendation payload", () => {
    const result = parseRecommendationPayload({
      taskAnalysis: {
        summary: "summary",
        detectedModality: "text",
        modalityReasoning: "reason",
        keyRequirements: ["a"],
        costFactors: "tokens",
      },
      recommendations: {
        cheapest: { id: "a", reason: "r", pricingSummary: "p", estimatedCost: "e" },
        balanced: { id: "b", reason: "r", pricingSummary: "p", estimatedCost: "e" },
        best: { id: "c", reason: "r", pricingSummary: "p", estimatedCost: "e" },
      },
      alternativesInOtherModalities: null,
    });

    expect(result.isOk()).toBe(true);
  });

  it("accepts recommendation payload without alternativesInOtherModalities", () => {
    const result = parseRecommendationPayload({
      taskAnalysis: {
        summary: "summary",
        detectedModality: "text",
        modalityReasoning: "reason",
        keyRequirements: ["a"],
        costFactors: "tokens",
      },
      recommendations: {
        cheapest: { id: "a", reason: "r", pricingSummary: "p", estimatedCost: "e" },
        balanced: { id: "b", reason: "r", pricingSummary: "p", estimatedCost: "e" },
        best: { id: "c", reason: "r", pricingSummary: "p", estimatedCost: "e" },
      },
    });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.alternativesInOtherModalities).toBeNull();
    }
  });

  it("rejects malformed recommendation payload", () => {
    const result = parseRecommendationPayload({ hello: "world" });
    expect(result.isErr()).toBe(true);
  });

  it("parses compare payload", () => {
    const result = parseCompareResultPayload({
      winner: "A",
      reasoning: "because",
      modelA: {
        strengths: ["a"],
        weaknesses: ["b"],
        estimatedCost: "$1",
        suitedFor: ["task"],
      },
      modelB: {
        strengths: ["a"],
        weaknesses: ["b"],
        estimatedCost: "$1",
        suitedFor: ["task"],
      },
    });

    expect(result.isOk()).toBe(true);
  });

  it("parses openrouter chat payload", () => {
    const result = parseOpenRouterChatResponse({
      model: "deepseek/deepseek-v3.2",
      choices: [{ index: 0, message: { role: "assistant", content: "{}" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
    });

    expect(result.isOk()).toBe(true);
  });

  it("accepts openrouter chat payload without finish_reason", () => {
    const result = parseOpenRouterChatResponse({
      model: "deepseek/deepseek-v3.2",
      choices: [{ index: 0, message: { role: "assistant", content: "{}" } }],
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
    });

    expect(result.isOk()).toBe(true);
  });
});
