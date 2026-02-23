import type { CompressedModel, ModelEntry } from "../types.js";

export function compressForLLM(models: ModelEntry[]): CompressedModel[] {
  return models.map((model) => {
    const compressed: CompressedModel = {
      id: model.id,
      name: model.name,
      modality: model.modality,
      pricing: flattenPricing(model.pricing),
    };

    if (typeof model.contextLength === "number") {
      compressed.contextLength = model.contextLength;
    }
    if (model.maxResolution) {
      compressed.maxResolution = model.maxResolution;
    }
    if (typeof model.maxDuration === "number") {
      compressed.maxDuration = model.maxDuration;
    }

    return compressed;
  });
}

export function groupByModality(
  models: CompressedModel[]
): Record<string, CompressedModel[]> {
  const grouped: Record<string, CompressedModel[]> = {};

  for (const model of models) {
    const bucket = grouped[model.modality] ?? [];
    bucket.push(model);
    grouped[model.modality] = bucket;
  }

  return grouped;
}

function flattenPricing(pricing: ModelEntry["pricing"]): Record<string, number> {
  const flat: Record<string, number> = {};

  for (const [key, value] of Object.entries(pricing)) {
    if (key === "type") {
      continue;
    }
    if (typeof value === "number") {
      flat[key] = value;
    }
  }

  return flat;
}
