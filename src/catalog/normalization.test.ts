import { describe, expect, it } from "vitest";
import type { OpenRouterModel } from "../types.js";
import {
  classifyModality,
  extractFamily,
  extractProvider,
  normalizeOpenRouterModel,
} from "./normalization.js";

describe("classifyModality", () => {
  it.each([
    { input: ["text"], output: ["text"], expected: "text" },
    { input: ["text"], output: ["image"], expected: "image" },
    { input: ["text"], output: ["video"], expected: "video" },
    { input: ["audio"], output: ["text"], expected: "audio_stt" },
    { input: ["text"], output: ["audio"], expected: "audio_tts" },
    { input: ["text"], output: ["music"], expected: "audio_generation" },
    { input: ["text"], output: ["embedding"], expected: "embedding" },
    { input: ["audio", "text", "image"], output: ["text"], expected: "vision" },
    { input: ["text", "image"], output: ["text"], expected: "vision" },
    { input: ["text", "image"], output: ["text", "image"], expected: "multimodal" },
  ])("classifies $expected modality", ({ input, output, expected }) => {
    expect(classifyModality(input, output)).toBe(expected);
  });
});

describe("extractProvider", () => {
  it("extracts provider from unprefixed id", () => {
    expect(extractProvider("anthropic/claude-sonnet-4")).toBe("anthropic");
  });

  it("extracts provider from source-prefixed id", () => {
    expect(extractProvider("openrouter::openai/gpt-4o")).toBe("openai");
  });
});

describe("extractFamily", () => {
  it("extracts known families", () => {
    expect(extractFamily("anthropic/claude-sonnet-4")).toBe("claude");
    expect(extractFamily("openai/gpt-4o")).toBe("gpt");
  });

  it("falls back to other", () => {
    expect(extractFamily("example/unknown-model-name")).toBe("other");
  });
});

describe("normalizeOpenRouterModel", () => {
  it("returns null for zero-priced models", () => {
    const raw: OpenRouterModel = {
      id: "free/model",
      name: "Free Model",
      context_length: 4096,
      pricing: {
        prompt: "0",
        completion: "0",
      },
    };

    expect(normalizeOpenRouterModel(raw)).toBeNull();
  });

  it("normalizes pricing and invalid context length", () => {
    const raw: OpenRouterModel = {
      id: "deepseek/deepseek-v3.2",
      name: "DeepSeek V3.2",
      context_length: 0,
      pricing: {
        prompt: "0.00000025",
        completion: "0.00000038",
      },
      architecture: {
        input_modalities: ["text"],
        output_modalities: ["text"],
      },
    };

    const normalized = normalizeOpenRouterModel(raw);
    expect(normalized).not.toBeNull();
    expect(normalized?.id).toBe("openrouter::deepseek/deepseek-v3.2");
    expect(normalized?.pricing).toMatchObject({
      type: "text",
      promptPer1mTokens: 0.25,
      completionPer1mTokens: 0.38,
    });
    expect(normalized?.contextLength).toBeUndefined();
  });

  it("defaults missing modalities to text", () => {
    const raw: OpenRouterModel = {
      id: "example/default-model",
      name: "Default Model",
      context_length: 8192,
      pricing: {
        prompt: "0.000001",
        completion: "0.000002",
      },
    };

    const normalized = normalizeOpenRouterModel(raw);
    expect(normalized?.inputModalities).toEqual(["text"]);
    expect(normalized?.outputModalities).toEqual(["text"]);
    expect(normalized?.modality).toBe("text");
  });
});
