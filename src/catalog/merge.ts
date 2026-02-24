import type { ModelEntry } from "../types.js";
import { getModelPrimaryPrice } from "../model-pricing.js";

export function mergeCatalogModels(modelsBySource: ModelEntry[][]): ModelEntry[] {
  const merged = new Map<string, ModelEntry>();

  for (const sourceModels of modelsBySource) {
    for (const candidate of sourceModels) {
      const current = merged.get(candidate.id);
      if (!current) {
        merged.set(candidate.id, candidate);
        continue;
      }

      if (shouldReplaceModel(current, candidate)) {
        merged.set(candidate.id, candidate);
      }
    }
  }

  return [...merged.values()];
}

function shouldReplaceModel(current: ModelEntry, candidate: ModelEntry): boolean {
  const currentCompleteness = completenessScore(current);
  const candidateCompleteness = completenessScore(candidate);
  if (candidateCompleteness !== currentCompleteness) {
    return candidateCompleteness > currentCompleteness;
  }

  const currentPrice = primaryPrice(current);
  const candidatePrice = primaryPrice(candidate);
  if (currentPrice !== candidatePrice) {
    return candidatePrice < currentPrice;
  }

  return false;
}

function completenessScore(model: ModelEntry): number {
  let score = 0;
  if (typeof model.contextLength === "number") score += 1;
  if (typeof model.maxDuration === "number") score += 1;
  if (typeof model.maxResolution === "string") score += 1;
  if (typeof model.supportsStreaming === "boolean") score += 1;
  if (model.inputModalities.length > 0) score += 1;
  if (model.outputModalities.length > 0) score += 1;
  return score;
}

function primaryPrice(model: ModelEntry): number {
  return getModelPrimaryPrice(model);
}
