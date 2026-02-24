import { describe, expect, it } from "vitest";
import { parseReplicatePagePricingFromHtml } from "./replicate-page-pricing.js";

function wrapScript(jsonPayload: string): string {
  return `<html><body><script type="application/json">${jsonPayload}</script></body></html>`;
}

describe("parseReplicatePagePricingFromHtml", () => {
  it("extracts billingConfig token pricing and normalizes to per-1M", () => {
    const html = wrapScript(
      JSON.stringify({
        billingConfig: {
          current_tiers: [
            {
              prices: [
                {
                  metric: "token_input_count",
                  metric_display: "input token",
                  title: "per thousand input tokens",
                  price: "$0.01",
                },
                {
                  metric: "token_output_count",
                  metric_display: "output token",
                  title: "per million output tokens",
                  price: "$1.60",
                },
              ],
            },
          ],
        },
      })
    );

    const result = parseReplicatePagePricingFromHtml(html);

    expect(result).toEqual({
      source: "billingConfig",
      pricing: {
        input_per_1m: 10,
        output_per_1m: 1.6,
      },
    });
  });

  it("extracts billingConfig image pricing and converts thousand-images to per-image", () => {
    const html = wrapScript(
      JSON.stringify({
        billingConfig: {
          current_tiers: [
            {
              prices: [
                {
                  metric: "image_output_count",
                  metric_display: "output image",
                  title: "per thousand output images",
                  price: "$12.50",
                },
              ],
            },
          ],
        },
      })
    );

    const result = parseReplicatePagePricingFromHtml(html);

    expect(result).toEqual({
      source: "billingConfig",
      pricing: {
        per_image: 0.0125,
      },
    });
  });

  it("extracts image megapixel pricing from billingConfig", () => {
    const html = wrapScript(
      JSON.stringify({
        billingConfig: {
          current_tiers: [
            {
              prices: [
                {
                  metric: "image_input_megapixels",
                  metric_display: "input image megapixel",
                  title: "per thousand input image megapixels",
                  price: "$2.00",
                },
                {
                  metric: "image_output_megapixels",
                  metric_display: "output image megapixel",
                  title: "per output image megapixel",
                  price: "$0.015",
                },
              ],
            },
          ],
        },
      })
    );

    const result = parseReplicatePagePricingFromHtml(html);

    expect(result).toEqual({
      source: "billingConfig",
      pricing: {
        input_per_megapixel: 0.002,
        output_per_megapixel: 0.015,
      },
    });
  });

  it("extracts character-based pricing and normalizes thousand-characters to per-character", () => {
    const html = wrapScript(
      JSON.stringify({
        billingConfig: {
          current_tiers: [
            {
              prices: [
                {
                  metric: "character_input_count",
                  metric_display: "input character",
                  title: "per thousand input characters",
                  price: "$0.02",
                },
              ],
            },
          ],
        },
      })
    );

    const result = parseReplicatePagePricingFromHtml(html);

    expect(result).toEqual({
      source: "billingConfig",
      pricing: {
        per_character: 0.00002,
      },
    });
  });

  it("uses top-level price string fallback when billingConfig is unavailable", () => {
    const html = wrapScript(
      JSON.stringify({
        name: "owner/model",
        price: "$0.001525 per second",
      })
    );

    const result = parseReplicatePagePricingFromHtml(html);

    expect(result).toEqual({
      source: "price-string",
      pricing: {
        per_second: 0.001525,
      },
    });
  });

  it("returns null for ambiguous token price text", () => {
    const html = wrapScript(
      JSON.stringify({
        price: "$0.02 per million tokens",
      })
    );

    const result = parseReplicatePagePricingFromHtml(html);

    expect(result).toBeNull();
  });

  it("does not fallback to top-level price string when billingConfig is present but unsupported", () => {
    const html = wrapScript(
      JSON.stringify({
        price: "$0.0001 per second",
        billingConfig: {
          current_tiers: [
            {
              prices: [
                {
                  metric: "unspecified_billing_metric",
                  metric_display: "unit",
                  title: "per unit",
                  price: "$0.08",
                },
              ],
            },
          ],
        },
      })
    );

    const result = parseReplicatePagePricingFromHtml(html);
    expect(result).toBeNull();
  });

  it("returns null instead of throwing for malformed JSON scripts", () => {
    const html = `<script type="application/json">{bad json}</script>`;
    expect(() => parseReplicatePagePricingFromHtml(html)).not.toThrow();
    expect(parseReplicatePagePricingFromHtml(html)).toBeNull();
  });
});
