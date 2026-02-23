import { describe, expect, it } from "vitest";
import { findClosestModelId, validateRecommendation } from "./validator.js";
import type { Recommendation } from "../types.js";

const validIds = new Set([
  "openrouter::anthropic/claude-sonnet-4",
  "openrouter::openai/gpt-4o",
  "openrouter::google/gemini-2.5-pro",
]);

const baseRecommendation: Recommendation = {
  taskAnalysis: {
    summary: "test",
    detectedModality: "text",
    modalityReasoning: "test",
    keyRequirements: ["reasoning"],
    costFactors: "tokens",
  },
  recommendations: {
    cheapest: {
      id: "openrouter::anthropic/claude-sonnet-4",
      reason: "r",
      pricingSummary: "p",
      estimatedCost: "e",
    },
    balanced: {
      id: "openrouter::openai/gpt-4o",
      reason: "r",
      pricingSummary: "p",
      estimatedCost: "e",
    },
    best: {
      id: "openrouter::google/gemini-2.5-pro",
      reason: "r",
      pricingSummary: "p",
      estimatedCost: "e",
    },
  },
  alternativesInOtherModalities: null,
};

describe("validateRecommendation", () => {
  it("returns valid when all IDs exist", () => {
    expect(validateRecommendation(baseRecommendation, validIds)).toEqual({
      valid: true,
      invalidIds: [],
    });
  });

  it("returns invalid IDs when missing", () => {
    const rec: Recommendation = {
      ...baseRecommendation,
      recommendations: {
        ...baseRecommendation.recommendations,
        cheapest: {
          ...baseRecommendation.recommendations.cheapest,
          id: "fake::model/does-not-exist",
        },
      },
    };

    const result = validateRecommendation(rec, validIds);
    expect(result.valid).toBe(false);
    expect(result.invalidIds).toContain("fake::model/does-not-exist");
  });
});

describe("findClosestModelId", () => {
  it("returns closest candidate when similarity is high enough", () => {
    expect(findClosestModelId("openrouter::google/gemini-pro", validIds)).toBe(
      "openrouter::google/gemini-2.5-pro"
    );
  });

  it("returns null for unrelated IDs", () => {
    expect(findClosestModelId("totally-different", validIds)).toBeNull();
  });
});
