import { describe, expect, it } from "vitest";
import { formatPricing } from "./pricing.js";

describe("formatPricing", () => {
  it("formats text pricing", () => {
    expect(
      formatPricing({ type: "text", promptPer1mTokens: 3, completionPer1mTokens: 15 })
    ).toBe("$3.00 / $15.00 per 1M tokens (in/out)");
  });

  it("formats image pricing", () => {
    expect(formatPricing({ type: "image", perImage: 0.04 })).toBe("$0.040 / image");
  });

  it("formats video pricing", () => {
    expect(formatPricing({ type: "video", perSecond: 0.1 })).toBe("$0.100 / second");
  });

  it("formats audio pricing", () => {
    expect(formatPricing({ type: "audio", perCharacter: 0.00003 })).toBe(
      "$0.030 / 1K characters"
    );
  });

  it("formats embedding pricing", () => {
    expect(formatPricing({ type: "embedding", per1mTokens: 0.02 })).toBe(
      "$0.02 / 1M tokens"
    );
  });
});
