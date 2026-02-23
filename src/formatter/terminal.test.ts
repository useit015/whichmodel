import { describe, expect, it } from "vitest";
import { formatTerminal } from "./terminal.js";
import type { Recommendation } from "../types.js";

const recommendation: Recommendation = {
  taskAnalysis: {
    summary: "Legal summary task",
    detectedModality: "text",
    modalityReasoning: "Requires text output",
    keyRequirements: ["reasoning", "long context"],
    costFactors: "token heavy",
  },
  recommendations: {
    cheapest: {
      id: "openrouter::deepseek/deepseek-v3.2",
      reason: "Low price",
      pricingSummary: "$0.25 / $0.38 per 1M tokens (in/out)",
      estimatedCost: "~$8/mo",
    },
    balanced: {
      id: "openrouter::google/gemini-2.5-flash",
      reason: "Best value",
      pricingSummary: "$0.30 / $2.50 per 1M tokens (in/out)",
      estimatedCost: "~$18/mo",
    },
    best: {
      id: "openrouter::anthropic/claude-sonnet-4",
      reason: "Best quality",
      pricingSummary: "$3.00 / $15.00 per 1M tokens (in/out)",
      estimatedCost: "~$420/mo",
    },
  },
  alternativesInOtherModalities: null,
};

describe("formatTerminal", () => {
  it("renders all recommendation tiers and meta", () => {
    const output = formatTerminal(recommendation, {
      recommenderModel: "deepseek/deepseek-v3.2",
      cost: 0.003,
      noColor: true,
    });

    expect(output).toContain("Task Analysis");
    expect(output).toContain("Cheapest");
    expect(output).toContain("Balanced");
    expect(output).toContain("Best");
    expect(output).toContain("This recommendation cost $0.0030");
  });
});
