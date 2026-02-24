import { describe, expect, it } from "vitest";
import type { ModelEntry, TextPricing, ImagePricing } from "../types.js";
import {
  findModelById,
  formatCompareTerminal,
  formatCompareJSON,
  type CompareResult,
  type CompareOptions,
} from "./compare.js";

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

function createCompareResult(overrides: Partial<CompareResult> = {}): CompareResult {
  return {
    winner: "A",
    reasoning: "Model A is better for this task.",
    modelA: {
      strengths: ["Fast", "Cheap"],
      weaknesses: ["Lower quality"],
      estimatedCost: "$0.001 per 1K tokens",
      suitedFor: ["Quick tasks", "High volume"],
    },
    modelB: {
      strengths: ["High quality"],
      weaknesses: ["Expensive", "Slow"],
      estimatedCost: "$0.01 per 1K tokens",
      suitedFor: ["Complex tasks"],
    },
    ...overrides,
  };
}

function createCompareOptions(overrides: Partial<CompareOptions> = {}): CompareOptions {
  return {
    modelA: "openrouter::test/model-a",
    modelB: "openrouter::test/model-b",
    task: "Summarize documents",
    apiKey: "test-api-key",
    recommenderModel: "test/recommender",
    ...overrides,
  };
}

describe("findModelById", () => {
  it("finds model by exact ID match", () => {
    const models: ModelEntry[] = [
      createTextModel({ id: "openrouter::anthropic/claude-3" }),
      createTextModel({ id: "openrouter::openai/gpt-4" }),
    ];

    const result = findModelById(models, "openrouter::anthropic/claude-3");

    expect(result).toBeDefined();
    expect(result?.id).toBe("openrouter::anthropic/claude-3");
  });

  it("finds model by partial ID match (without source prefix)", () => {
    const models: ModelEntry[] = [
      createTextModel({ id: "openrouter::anthropic/claude-3" }),
      createTextModel({ id: "openrouter::openai/gpt-4" }),
    ];

    const result = findModelById(models, "anthropic/claude-3");

    expect(result).toBeDefined();
    expect(result?.id).toBe("openrouter::anthropic/claude-3");
  });

  it("finds model by partial ID match (case-insensitive)", () => {
    const models: ModelEntry[] = [
      createTextModel({ id: "openrouter::anthropic/claude-3-opus" }),
      createTextModel({ id: "openrouter::openai/gpt-4" }),
    ];

    const result = findModelById(models, "CLAUDE-3");

    expect(result).toBeDefined();
    expect(result?.id).toBe("openrouter::anthropic/claude-3-opus");
  });

  it("finds model by name match (case-insensitive)", () => {
    const models: ModelEntry[] = [
      createTextModel({ id: "openrouter::model-1", name: "Claude 3 Opus" }),
      createTextModel({ id: "openrouter::model-2", name: "GPT-4 Turbo" }),
    ];

    const result = findModelById(models, "claude 3");

    expect(result).toBeDefined();
    expect(result?.name).toBe("Claude 3 Opus");
  });

  it("returns null when model is not found", () => {
    const models: ModelEntry[] = [
      createTextModel({ id: "openrouter::anthropic/claude-3" }),
    ];

    const result = findModelById(models, "nonexistent-model");

    expect(result).toBeNull();
  });

  it("prioritizes exact match over partial match", () => {
    const models: ModelEntry[] = [
      createTextModel({ id: "openrouter::claude" }),
      createTextModel({ id: "openrouter::anthropic/claude-3" }),
    ];

    const result = findModelById(models, "claude");

    expect(result).toBeDefined();
    expect(result?.id).toBe("openrouter::claude");
  });

  it("handles replicate-style IDs with slashes", () => {
    const models: ModelEntry[] = [
      createTextModel({ id: "replicate::meta/llama-3-70b", source: "replicate" }),
    ];

    // Should match with replicate prefix stripped
    const result = findModelById(models, "meta/llama-3-70b");

    expect(result).toBeDefined();
    expect(result?.id).toBe("replicate::meta/llama-3-70b");
  });
});

describe("formatCompareTerminal", () => {
  it("formats comparison with Model A as winner", () => {
    const modelA = createTextModel({ name: "Claude 3" });
    const modelB = createTextModel({ id: "openrouter::gpt-4", name: "GPT-4" });
    const result = createCompareResult({ winner: "A" });
    const options = createCompareOptions();

    const output = formatCompareTerminal(result, modelA, modelB, options);

    expect(output).toContain("Model Comparison");
    expect(output).toContain("Winner: Claude 3");
    expect(output).toContain("Model A: Claude 3");
    expect(output).toContain("Model B: GPT-4");
    expect(output).toContain("Strengths:");
    expect(output).toContain("Weaknesses:");
    expect(output).toContain("Fast");
    expect(output).toContain("High quality");
  });

  it("formats comparison with Model B as winner", () => {
    const modelA = createTextModel({ name: "Claude 3" });
    const modelB = createTextModel({ id: "openrouter::gpt-4", name: "GPT-4" });
    const result = createCompareResult({ winner: "B", reasoning: "GPT-4 is better for code." });
    const options = createCompareOptions();

    const output = formatCompareTerminal(result, modelA, modelB, options);

    expect(output).toContain("Winner: GPT-4");
    expect(output).toContain("GPT-4 is better for code.");
  });

  it("formats comparison with tie result", () => {
    const modelA = createTextModel({ name: "Claude 3" });
    const modelB = createTextModel({ id: "openrouter::gpt-4", name: "GPT-4" });
    const result = createCompareResult({ winner: "tie", reasoning: "Both models are equally capable." });
    const options = createCompareOptions();

    const output = formatCompareTerminal(result, modelA, modelB, options);

    expect(output).toContain("It's a tie!");
    expect(output).toContain("Both models are equally capable.");
  });

  it("includes task description", () => {
    const modelA = createTextModel();
    const modelB = createTextModel({ id: "openrouter::model-b" });
    const result = createCompareResult();
    const options = createCompareOptions({ task: "Write Python code for data analysis" });

    const output = formatCompareTerminal(result, modelA, modelB, options);

    expect(output).toContain("Write Python code for data analysis");
  });

  it("includes model pricing information", () => {
    const modelA = createTextModel({
      pricing: { type: "text", promptPer1mTokens: 0.25, completionPer1mTokens: 1.25 },
    });
    const modelB = createTextModel({
      id: "openrouter::model-b",
      pricing: { type: "text", promptPer1mTokens: 10.0, completionPer1mTokens: 30.0 },
    });
    const result = createCompareResult();
    const options = createCompareOptions();

    const output = formatCompareTerminal(result, modelA, modelB, options);

    expect(output).toContain("$0.25");
    expect(output).toContain("$10.00");
  });

  it("handles image model pricing", () => {
    const modelA = createImageModel({
      pricing: { type: "image", perImage: 0.05 },
    });
    const modelB = createImageModel({
      id: "fal::model-b",
      pricing: { type: "image", perMegapixel: 0.02 },
    });
    const result = createCompareResult();
    const options = createCompareOptions();

    const output = formatCompareTerminal(result, modelA, modelB, options);

    expect(output).toContain("$0.0500 per image");
    expect(output).toContain("$0.0200 per MP");
  });

  it("handles models with empty strengths/weaknesses", () => {
    const modelA = createTextModel();
    const modelB = createTextModel({ id: "openrouter::model-b" });
    const result = createCompareResult({
      modelA: {
        strengths: [],
        weaknesses: [],
        estimatedCost: "$0.001",
        suitedFor: [],
      },
      modelB: {
        strengths: [],
        weaknesses: [],
        estimatedCost: "$0.002",
        suitedFor: [],
      },
    });
    const options = createCompareOptions();

    const output = formatCompareTerminal(result, modelA, modelB, options);

    expect(output).toContain("Model A:");
    expect(output).toContain("Model B:");
  });

  it("disables colors when noColor is true", () => {
    const modelA = createTextModel();
    const modelB = createTextModel({ id: "openrouter::model-b" });
    const result = createCompareResult();
    const options = createCompareOptions();

    const output = formatCompareTerminal(result, modelA, modelB, options, true);

    // Output should not contain ANSI color codes
    expect(output).not.toMatch(/\x1b\[\d+m/);
    expect(output).toContain("Model Comparison");
  });
});

describe("formatCompareJSON", () => {
  it("formats comparison as JSON object", () => {
    const modelA = createTextModel({ id: "openrouter::claude-3", name: "Claude 3" });
    const modelB = createTextModel({ id: "openrouter::gpt-4", name: "GPT-4" });
    const result = createCompareResult({ winner: "A" });

    const json = formatCompareJSON(result, modelA, modelB);

    expect(json).toEqual({
      winner: "A",
      reasoning: "Model A is better for this task.",
      modelA: {
        id: "openrouter::claude-3",
        name: "Claude 3",
        strengths: ["Fast", "Cheap"],
        weaknesses: ["Lower quality"],
        estimatedCost: "$0.001 per 1K tokens",
        suitedFor: ["Quick tasks", "High volume"],
      },
      modelB: {
        id: "openrouter::gpt-4",
        name: "GPT-4",
        strengths: ["High quality"],
        weaknesses: ["Expensive", "Slow"],
        estimatedCost: "$0.01 per 1K tokens",
        suitedFor: ["Complex tasks"],
      },
    });
  });

  it("includes all CompareResult fields", () => {
    const modelA = createTextModel();
    const modelB = createTextModel({ id: "openrouter::model-b" });
    const result = createCompareResult({
      winner: "tie",
      reasoning: "Both are good",
      modelA: {
        strengths: ["A1"],
        weaknesses: ["AW1"],
        estimatedCost: "$1",
        suitedFor: ["Task A"],
      },
      modelB: {
        strengths: ["B1"],
        weaknesses: ["BW1"],
        estimatedCost: "$2",
        suitedFor: ["Task B"],
      },
    });

    const json = formatCompareJSON(result, modelA, modelB);

    expect(json.winner).toBe("tie");
    expect(json.reasoning).toBe("Both are good");
    expect(json.modelA.strengths).toEqual(["A1"]);
    expect(json.modelB.strengths).toEqual(["B1"]);
  });

  it("preserves model IDs and names from ModelEntry", () => {
    const modelA = createTextModel({ id: "openrouter::specific/model-a", name: "Specific Model A" });
    const modelB = createTextModel({ id: "fal::specific/model-b", name: "Specific Model B" });
    const result = createCompareResult();

    const json = formatCompareJSON(result, modelA, modelB);

    expect(json.modelA.id).toBe("openrouter::specific/model-a");
    expect(json.modelA.name).toBe("Specific Model A");
    expect(json.modelB.id).toBe("fal::specific/model-b");
    expect(json.modelB.name).toBe("Specific Model B");
  });
});
