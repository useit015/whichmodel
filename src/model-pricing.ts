import type { ModelEntry, Pricing } from "./types.js";

function toNonNegativeFinite(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return undefined;
  }

  return value;
}

function firstDefined(values: Array<number | undefined>): number | undefined {
  for (const value of values) {
    if (typeof value === "number") {
      return value;
    }
  }

  return undefined;
}

export function getPrimaryPriceFromPricing(pricing: Pricing): number {
  const price = (() => {
    switch (pricing.type) {
      case "text":
        return toNonNegativeFinite(pricing.promptPer1mTokens);
      case "image":
        return firstDefined([
          toNonNegativeFinite(pricing.perImage),
          toNonNegativeFinite(pricing.perMegapixel),
          toNonNegativeFinite(pricing.perStep),
        ]);
      case "video":
        return firstDefined([
          toNonNegativeFinite(pricing.perSecond),
          toNonNegativeFinite(pricing.perGeneration),
        ]);
      case "audio":
        return firstDefined([
          toNonNegativeFinite(pricing.perMinute),
          toNonNegativeFinite(pricing.perCharacter),
          toNonNegativeFinite(pricing.perSecond),
        ]);
      case "embedding":
        return toNonNegativeFinite(pricing.per1mTokens);
      default:
        return undefined;
    }
  })();

  return typeof price === "number" ? price : Number.POSITIVE_INFINITY;
}

export function getModelPrimaryPrice(model: Pick<ModelEntry, "pricing">): number {
  return getPrimaryPriceFromPricing(model.pricing);
}

export function hasUsablePrice(model: Pick<ModelEntry, "pricing">): boolean {
  return Number.isFinite(getModelPrimaryPrice(model));
}
