import type { Pricing } from "../types.js";

export function formatPricing(pricing: Pricing): string {
  switch (pricing.type) {
    case "text":
      return `$${pricing.promptPer1mTokens.toFixed(2)} / $${pricing.completionPer1mTokens.toFixed(2)} per 1M tokens (in/out)`;
    case "image":
      if (typeof pricing.perImage === "number") {
        return `$${pricing.perImage.toFixed(3)} / image`;
      }
      if (typeof pricing.perMegapixel === "number") {
        return `$${pricing.perMegapixel.toFixed(3)} / megapixel`;
      }
      if (typeof pricing.perStep === "number") {
        return `$${pricing.perStep.toFixed(5)} / step`;
      }
      return "image pricing unavailable";
    case "video":
      if (typeof pricing.perSecond === "number") {
        return `$${pricing.perSecond.toFixed(3)} / second`;
      }
      if (typeof pricing.perGeneration === "number") {
        return `$${pricing.perGeneration.toFixed(3)} / generation`;
      }
      return "video pricing unavailable";
    case "audio":
      if (typeof pricing.perCharacter === "number") {
        return `$${(pricing.perCharacter * 1000).toFixed(3)} / 1K characters`;
      }
      if (typeof pricing.perMinute === "number") {
        return `$${pricing.perMinute.toFixed(3)} / minute`;
      }
      if (typeof pricing.perSecond === "number") {
        return `$${pricing.perSecond.toFixed(4)} / second`;
      }
      return "audio pricing unavailable";
    case "embedding":
      return `$${pricing.per1mTokens.toFixed(2)} / 1M tokens`;
    default:
      return "pricing unavailable";
  }
}
