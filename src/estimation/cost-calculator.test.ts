import { describe, expect, it } from "vitest";
import {
  parseWorkloadDescription,
  estimateCost,
  formatCostEstimate,
} from "./cost-calculator.js";
import type { ModelEntry, TextPricing, ImagePricing, VideoPricing } from "../types.js";

function createTextModel(overrides: Partial<ModelEntry> = {}): ModelEntry {
  const pricing: TextPricing = {
    type: "text",
    promptPer1mTokens: 1.0,
    completionPer1mTokens: 2.0,
  };
  return {
    id: "openrouter::test/model",
    source: "openrouter",
    name: "Test Model",
    modality: "text",
    inputModalities: ["text"],
    outputModalities: ["text"],
    pricing,
    provider: "test",
    family: "test",
    contextLength: 4096,
    ...overrides,
  };
}

function createImageModel(overrides: Partial<ModelEntry> = {}): ModelEntry {
  const pricing: ImagePricing = {
    type: "image",
    perImage: 0.02,
  };
  return {
    id: "fal::test/image-model",
    source: "fal",
    name: "Test Image Model",
    modality: "image",
    inputModalities: ["text"],
    outputModalities: ["image"],
    pricing,
    provider: "test",
    family: "test",
    ...overrides,
  };
}

describe("parseWorkloadDescription", () => {
  it("parses '500 images/month'", () => {
    const result = parseWorkloadDescription("500 images/month");

    expect(result.quantity).toBe(500);
    expect(result.unit).toBe("images");
    expect(result.period).toBe("month");
  });

  it("parses '1000 requests per day'", () => {
    const result = parseWorkloadDescription("1000 requests per day");

    expect(result.quantity).toBe(1000);
    expect(result.unit).toBe("requests");
    expect(result.period).toBe("day");
  });

  it("parses '10000 tokens/week'", () => {
    const result = parseWorkloadDescription("10000 tokens/week");

    expect(result.quantity).toBe(10000);
    expect(result.unit).toBe("tokens");
    expect(result.period).toBe("week");
  });

  it("parses resolution from '500 images/month at 1024x1024'", () => {
    const result = parseWorkloadDescription("500 images/month at 1024x1024");

    expect(result.quantity).toBe(500);
    expect(result.unit).toBe("images");
    expect(result.parameters?.resolution).toBe("1024x1024");
  });

  it("handles 'k' suffix", () => {
    const result = parseWorkloadDescription("10k requests/month");

    expect(result.quantity).toBe(10000);
  });

  it("defaults to monthly period", () => {
    const result = parseWorkloadDescription("500 images");

    expect(result.period).toBe("month");
  });
});

describe("estimateCost", () => {
  it("calculates cost for text models", () => {
    const model = createTextModel({
      pricing: { type: "text", promptPer1mTokens: 1.0, completionPer1mTokens: 2.0 },
    });

    const workload = parseWorkloadDescription("1000 requests/month");
    const estimate = estimateCost(model, workload);

    // 1000 requests * 2000 tokens * $1/1M tokens = $2/month
    expect(estimate.monthlyCost).toBeCloseTo(2.0, 2);
    expect(estimate.yearlyCost).toBeCloseTo(24.0, 2);
  });

  it("calculates cost for image models", () => {
    const model = createImageModel({
      pricing: { type: "image", perImage: 0.02 },
    });

    const workload = parseWorkloadDescription("500 images/month");
    const estimate = estimateCost(model, workload);

    // 500 images * $0.02/image = $10/month
    expect(estimate.monthlyCost).toBeCloseTo(10.0, 2);
  });

  it("calculates cost with per-megapixel pricing", () => {
    const model = createImageModel({
      pricing: { type: "image", perMegapixel: 0.01 },
    });

    const workload = parseWorkloadDescription("100 images/month at 1024x1024");
    const estimate = estimateCost(model, workload);

    // 100 images * ~1.05MP * $0.01/MP ≈ $1.05/month
    expect(estimate.monthlyCost).toBeCloseTo(1.05, 2);
  });

  it("handles daily period", () => {
    const model = createImageModel({
      pricing: { type: "image", perImage: 0.02 },
    });

    const workload = parseWorkloadDescription("10 images/day");
    const estimate = estimateCost(model, workload);

    // 10 images/day * 30 days * $0.02 = $6/month
    expect(estimate.monthlyCost).toBeCloseTo(6.0, 2);
  });
});

describe("formatCostEstimate", () => {
  it("formats small costs", () => {
    const estimate = {
      monthlyUnits: 100,
      costPerUnit: 0.001,
      monthlyCost: 0.1,
      yearlyCost: 1.2,
      breakdown: "test",
    };

    const result = formatCostEstimate(estimate);

    expect(result).toContain("$0.10");
    expect(result).toContain("/mo");
  });

  it("formats larger costs", () => {
    const estimate = {
      monthlyUnits: 1000,
      costPerUnit: 0.1,
      monthlyCost: 100,
      yearlyCost: 1200,
      breakdown: "test",
    };

    const result = formatCostEstimate(estimate);

    expect(result).toContain("$100.00");
    expect(result).toContain("$1200");
  });
});
