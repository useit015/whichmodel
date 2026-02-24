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

  it("returns null instead of throwing for malformed JSON scripts", () => {
    const html = `<script type="application/json">{bad json}</script>`;
    expect(() => parseReplicatePagePricingFromHtml(html)).not.toThrow();
    expect(parseReplicatePagePricingFromHtml(html)).toBeNull();
  });
});
