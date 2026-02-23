import { describe, expect, it } from "vitest";
import { toJsonOutput } from "./json.js";
import type { Recommendation, RecommendationMeta } from "../types.js";

const recommendation: Recommendation = {
  taskAnalysis: {
    summary: "summary",
    detectedModality: "text",
    modalityReasoning: "reason",
    keyRequirements: ["k1"],
    costFactors: "tokens",
  },
  recommendations: {
    cheapest: { id: "a", reason: "r", pricingSummary: "p", estimatedCost: "e" },
    balanced: { id: "b", reason: "r", pricingSummary: "p", estimatedCost: "e" },
    best: { id: "c", reason: "r", pricingSummary: "p", estimatedCost: "e" },
  },
  alternativesInOtherModalities: null,
};

const meta: RecommendationMeta = {
  recommenderModel: "deepseek/deepseek-v3.2",
  recommendationCostUsd: 0.001,
  catalogSources: ["openrouter"],
  catalogTotalModels: 100,
  catalogModelsInModality: 80,
  timestamp: new Date().toISOString(),
  version: "0.1.0",
};

describe("toJsonOutput", () => {
  it("builds a full JSON output payload", () => {
    const output = toJsonOutput("task", recommendation, meta);
    expect(output.task).toBe("task");
    expect(output.recommendations.best.id).toBe("c");
    expect(output.meta.recommenderModel).toBe("deepseek/deepseek-v3.2");
  });
});
