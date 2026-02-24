import { describe, expect, it } from "vitest";
import type { FalModel, OpenRouterModel, ReplicateModel } from "../types.js";
import {
  classifyFalCategory,
  classifyModality,
  extractFamily,
  extractProvider,
  normalizeFalModel,
  normalizeOpenRouterModel,
  normalizeReplicateModel,
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

describe("normalizeFalModel", () => {
  it("normalizes image-generation category", () => {
    const raw: FalModel = {
      id: "black-forest-labs/flux-1.1-pro",
      name: "Flux 1.1 Pro",
      category: "image-generation",
      pricing: {
        type: "per_image",
        amount: 0.04,
      },
    };

    const normalized = normalizeFalModel(raw);
    expect(normalized).not.toBeNull();
    expect(normalized?.id).toBe("fal::black-forest-labs/flux-1.1-pro");
    expect(normalized?.modality).toBe("image");
    expect(normalized?.pricing).toMatchObject({ type: "image", perImage: 0.04 });
    expect(normalized?.inputModalities).toEqual(["text"]);
    expect(normalized?.outputModalities).toEqual(["image"]);
  });

  it("normalizes image-to-video category", () => {
    const raw: FalModel = {
      id: "kling-ai/kling-v2",
      name: "Kling v2",
      category: "image-to-video",
      pricing: {
        type: "per_generation",
        amount: 0.6,
      },
    };

    const normalized = normalizeFalModel(raw);
    expect(normalized).not.toBeNull();
    expect(normalized?.modality).toBe("video");
    expect(normalized?.pricing).toMatchObject({ type: "video", perGeneration: 0.6 });
    expect(normalized?.inputModalities).toEqual(["image"]);
    expect(normalized?.outputModalities).toEqual(["video"]);
  });

  it("returns null for unsupported categories", () => {
    const raw: FalModel = {
      id: "some/stt-model",
      name: "STT Model",
      category: "training",
      pricing: {
        type: "per_minute",
        amount: 0.002,
      },
    };

    expect(normalizeFalModel(raw)).toBeNull();
  });

  it("returns null when price is not a positive number", () => {
    const raw: FalModel = {
      id: "stabilityai/sdxl",
      name: "SDXL",
      category: "image-generation",
      pricing: {
        type: "per_image",
        amount: 0,
      },
    };

    expect(normalizeFalModel(raw)).toBeNull();
  });

  it("normalizes audio stt categories", () => {
    const raw: FalModel = {
      id: "fal-ai/whisper-v3",
      name: "Whisper v3",
      category: "audio-to-text",
      pricing: {
        type: "per_minute",
        amount: 0.006,
      },
    };

    const normalized = normalizeFalModel(raw);
    expect(normalized).not.toBeNull();
    expect(normalized?.modality).toBe("audio_stt");
    expect(normalized?.pricing).toMatchObject({ type: "audio", perMinute: 0.006 });
    expect(normalized?.inputModalities).toEqual(["audio"]);
    expect(normalized?.outputModalities).toEqual(["text"]);
  });

  it("normalizes audio tts categories", () => {
    const raw: FalModel = {
      id: "fal-ai/kokoro",
      name: "Kokoro TTS",
      category: "text-to-speech",
      pricing: {
        type: "per_second",
        amount: 0.01,
      },
    };

    const normalized = normalizeFalModel(raw);
    expect(normalized).not.toBeNull();
    expect(normalized?.modality).toBe("audio_tts");
    expect(normalized?.pricing).toMatchObject({ type: "audio", perSecond: 0.01 });
    expect(normalized?.inputModalities).toEqual(["text"]);
    expect(normalized?.outputModalities).toEqual(["audio"]);
  });

  it("normalizes audio tts with per_character pricing", () => {
    const raw: FalModel = {
      id: "fal-ai/tts-char",
      name: "TTS Character",
      category: "text-to-speech",
      pricing: {
        type: "per_character",
        amount: 0.0001,
      },
    };

    const normalized = normalizeFalModel(raw);
    expect(normalized).not.toBeNull();
    expect(normalized?.pricing).toMatchObject({ type: "audio", perCharacter: 0.0001 });
  });

  it("normalizes video-to-video category", () => {
    const raw: FalModel = {
      id: "fal-ai/video-edit",
      name: "Video Editor",
      category: "video-to-video",
      pricing: {
        type: "per_generation",
        amount: 0.5,
      },
    };

    const normalized = normalizeFalModel(raw);
    expect(normalized).not.toBeNull();
    expect(normalized?.modality).toBe("video");
    expect(normalized?.inputModalities).toEqual(["video"]);
    expect(normalized?.outputModalities).toEqual(["video"]);
  });

  it("normalizes image-to-* category with image input", () => {
    const raw: FalModel = {
      id: "fal-ai/image-transform",
      name: "Image Transformer",
      category: "image-to-image",
      pricing: {
        type: "per_image",
        amount: 0.03,
      },
    };

    const normalized = normalizeFalModel(raw);
    expect(normalized).not.toBeNull();
    expect(normalized?.inputModalities).toEqual(["image"]);
  });

  it("normalizes speech-to-* category with audio input", () => {
    const raw: FalModel = {
      id: "fal-ai/speech-transform",
      name: "Speech Transformer",
      category: "speech-to-speech",
      pricing: {
        type: "per_second",
        amount: 0.02,
      },
    };

    const normalized = normalizeFalModel(raw);
    expect(normalized).not.toBeNull();
    expect(normalized?.modality).toBe("audio_generation");
    expect(normalized?.inputModalities).toEqual(["audio"]);
    expect(normalized?.outputModalities).toEqual(["audio"]);
  });

  it("normalizes video with per_second pricing", () => {
    const raw: FalModel = {
      id: "fal-ai/video-gen",
      name: "Video Generator",
      category: "text-to-video",
      pricing: {
        type: "per_second",
        amount: 0.1,
      },
    };

    const normalized = normalizeFalModel(raw);
    expect(normalized).not.toBeNull();
    expect(normalized?.pricing).toMatchObject({ type: "video", perSecond: 0.1 });
  });
});

describe("normalizeReplicateModel", () => {
  it("normalizes schema-based image models with per-image pricing", () => {
    const raw: ReplicateModel = {
      owner: "black-forest-labs",
      name: "flux-schnell",
      description: "Fast image generation model",
      pricing: {
        per_image: 0.02,
      },
      latest_version: {
        openapi_schema: {
          components: {
            schemas: {
              Input: {
                type: "object",
                properties: {
                  prompt: { type: "string", description: "Generation prompt" },
                },
              },
              Output: {
                type: "string",
                format: "uri",
                description: "Generated image URL",
              },
            },
          },
        },
      },
    };

    const normalized = normalizeReplicateModel(raw);
    expect(normalized).not.toBeNull();
    expect(normalized?.id).toBe("replicate::black-forest-labs/flux-schnell");
    expect(normalized?.modality).toBe("image");
    expect(normalized?.pricing).toMatchObject({ type: "image", perImage: 0.02 });
  });

  it("infers audio stt modality from metadata when schema is missing", () => {
    const raw: ReplicateModel = {
      owner: "openai",
      name: "whisper",
      description: "Speech-to-text transcription model",
      pricing: {
        per_minute: 0.006,
      },
    };

    const normalized = normalizeReplicateModel(raw);
    expect(normalized).not.toBeNull();
    expect(normalized?.modality).toBe("audio_stt");
    expect(normalized?.inputModalities).toEqual(["audio"]);
    expect(normalized?.outputModalities).toEqual(["text"]);
    expect(normalized?.pricing).toMatchObject({ type: "audio", perMinute: 0.006 });
  });

  it("normalizes text token pricing to per-1m rates", () => {
    const raw: ReplicateModel = {
      owner: "meta",
      name: "llama-3.3",
      description: "General-purpose text generation model",
      pricing: {
        input_per_token: 0.000001,
        output_per_token: 0.000002,
      },
      latest_version: {
        openapi_schema: {
          components: {
            schemas: {
              Input: {
                type: "object",
                properties: {
                  prompt: { type: "string" },
                },
              },
              Output: {
                type: "string",
              },
            },
          },
        },
      },
    };

    const normalized = normalizeReplicateModel(raw);
    expect(normalized).not.toBeNull();
    expect(normalized?.modality).toBe("text");
    expect(normalized?.pricing).toMatchObject({
      type: "text",
      promptPer1mTokens: 1,
      completionPer1mTokens: 2,
    });
  });

  it("returns null for text models when pricing cannot be inferred", () => {
    const raw: ReplicateModel = {
      owner: "meta",
      name: "llama-unpriced",
      description: "Text model",
      latest_version: {
        openapi_schema: {
          components: {
            schemas: {
              Input: {
                type: "object",
                properties: {
                  prompt: { type: "string" },
                },
              },
              Output: {
                type: "string",
              },
            },
          },
        },
      },
    };

    expect(normalizeReplicateModel(raw)).toBeNull();
  });

  it("returns null when schema is missing", () => {
    const raw: ReplicateModel = {
      owner: "meta",
      name: "no-schema-model",
      description: "Model without schema",
      pricing: {
        per_image: 0.02,
      },
    };

    // Models without schema and no recognizable metadata keywords return null
    expect(normalizeReplicateModel(raw)).toBeNull();
  });

  it("infers video modality from description keywords", () => {
    const raw: ReplicateModel = {
      owner: "runway",
      name: "gen3-video",
      description: "Generate video from text prompts",
      pricing: {
        per_generation: 0.5,
      },
    };

    const normalized = normalizeReplicateModel(raw);
    expect(normalized).not.toBeNull();
    expect(normalized?.modality).toBe("video");
  });

  it("infers image modality from per_megapixel pricing", () => {
    const raw: ReplicateModel = {
      owner: "stability",
      name: "sdxl",
      description: "Image generation",
      pricing: {
        per_megapixel: 0.01,
      },
    };

    const normalized = normalizeReplicateModel(raw);
    expect(normalized).not.toBeNull();
    expect(normalized?.modality).toBe("image");
    expect(normalized?.pricing.type).toBe("image");
  });

  it("infers video modality from per_second pricing", () => {
    const raw: ReplicateModel = {
      owner: "runway",
      name: "video-gen",
      description: "Video generation model",
      pricing: {
        per_second: 0.1,
      },
    };

    const normalized = normalizeReplicateModel(raw);
    expect(normalized).not.toBeNull();
    expect(normalized?.modality).toBe("video");
    expect(normalized?.pricing).toMatchObject({ type: "video", perSecond: 0.1 });
  });

  it("infers audio modality from per_minute pricing", () => {
    const raw: ReplicateModel = {
      owner: "openai",
      name: "whisper",
      description: "Audio transcription model",
      pricing: {
        per_minute: 0.006,
      },
    };

    const normalized = normalizeReplicateModel(raw);
    expect(normalized).not.toBeNull();
    expect(normalized?.modality).toBe("audio_stt");
    expect(normalized?.pricing).toMatchObject({ type: "audio", perMinute: 0.006 });
  });
});

describe("classifyFalCategory", () => {
  it.each([
    { category: "text-to-image", expected: "image" },
    { category: "video-to-video", expected: "video" },
    { category: "audio-to-text", expected: "audio_stt" },
    { category: "text-to-speech", expected: "audio_tts" },
    { category: "speech-to-speech", expected: "audio_generation" },
    { category: "training", expected: null },
  ])("maps '$category' to $expected", ({ category, expected }) => {
    expect(classifyFalCategory(category)).toBe(expected);
  });
});

describe("classifyModality edge cases", () => {
  it("classifies sound output as audio_generation", () => {
    expect(classifyModality(["text"], ["sound"])).toBe("audio_generation");
  });

  it("classifies vector output as embedding", () => {
    expect(classifyModality(["text"], ["vector"])).toBe("embedding");
  });

  it("classifies pure audio->text as audio_stt", () => {
    expect(classifyModality(["audio"], ["text"])).toBe("audio_stt");
  });

  it("classifies multimodal when more than 2 unique modalities", () => {
    expect(classifyModality(["text", "audio", "video"], ["text", "image"])).toBe("multimodal");
  });

  it("classifies image->text as vision", () => {
    expect(classifyModality(["image"], ["text"])).toBe("vision");
  });

  it("defaults to text when no other modality matches", () => {
    expect(classifyModality([], [])).toBe("text");
  });
});
