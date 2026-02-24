import { describe, expect, it } from "vitest";
import {
  parseFalModelsListResponse,
  parseFalPricingResponse,
  parseOpenRouterResponse,
  parseReplicateModelsResponse,
} from "./provider-schemas.js";
import { ExitCode } from "../types.js";

describe("provider-schemas", () => {
  it("parses valid openrouter payload", () => {
    const result = parseOpenRouterResponse({
      data: [
        {
          id: "openai/gpt-4o-mini",
          name: "GPT-4o Mini",
          context_length: 128000,
          pricing: {
            prompt: "0.00000015",
            completion: "0.00000060",
          },
        },
      ],
    });

    expect(result.isOk()).toBe(true);
  });

  it("parses openrouter payload when per_request_limits is null", () => {
    const result = parseOpenRouterResponse({
      data: [
        {
          id: "google/gemini-3.1-pro-preview",
          name: "Google: Gemini 3.1 Pro Preview",
          context_length: 1_048_576,
          pricing: {
            prompt: "0.000002",
            completion: "0.000012",
          },
          architecture: {
            modality: "text+image->text",
            instruct_type: null,
          },
          top_provider: {
            context_length: 1_048_576,
            max_completion_tokens: null,
          },
          per_request_limits: null,
        },
      ],
    });

    expect(result.isOk()).toBe(true);
  });

  it("rejects malformed openrouter payload", () => {
    const result = parseOpenRouterResponse({ data: [{ id: "x" }] });

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.exitCode).toBe(ExitCode.NETWORK_ERROR);
    }
  });

  it("parses fal models and pricing payloads", () => {
    const modelsResult = parseFalModelsListResponse({
      models: [{ endpoint_id: "fal-ai/flux-1", metadata: { category: "image" } }],
    });
    const pricingResult = parseFalPricingResponse({
      prices: [{ endpoint_id: "fal-ai/flux-1", unit_price: 0.01, unit: "image" }],
    });

    expect(modelsResult.isOk()).toBe(true);
    expect(pricingResult.isOk()).toBe(true);
  });

  it("parses replicate payload", () => {
    const result = parseReplicateModelsResponse({
      next: null,
      previous: null,
      results: [
        {
          owner: "meta",
          name: "llama-3",
          visibility: "public",
        },
      ],
    });

    expect(result.isOk()).toBe(true);
  });
});
