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
