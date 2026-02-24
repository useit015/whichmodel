/**
 * Stats command implementation
 *
 * Shows catalog statistics including model counts by modality,
 * price ranges, and configured/missing sources.
 *
 * @module commands/stats
 */

import chalk, { Chalk } from "chalk";
import type { Config, ModelEntry, Modality } from "../types.js";
import { getModelPrimaryPrice, hasUsablePrice } from "../model-pricing.js";

export interface ModalityStats {
  count: number;
  priceRange: {
    min: number;
    max: number;
  };
}

export interface CatalogStats {
  totalModels: number;
  sources: string[];
  byModality: Record<string, ModalityStats>;
  configuredSources: string[];
  missingSources: Array<{
    name: string;
    envVar: string;
    getUrl: string;
  }>;
}

const MODALITY_ORDER: Modality[] = [
  "text",
  "image",
  "video",
  "audio_tts",
  "audio_stt",
  "audio_generation",
  "vision",
  "embedding",
  "multimodal",
];

const MODALITY_LABELS: Record<Modality, string> = {
  text: "Text",
  image: "Image",
  video: "Video",
  audio_tts: "Audio (TTS)",
  audio_stt: "Audio (STT)",
  audio_generation: "Audio (Gen)",
  vision: "Vision",
  embedding: "Embedding",
  multimodal: "Multimodal",
};

/**
 * Format a price for display
 */
function formatPrice(price: number): string {
  if (!Number.isFinite(price) || price === Number.POSITIVE_INFINITY) {
    return "N/A";
  }
  if (price < 0.01) {
    return `$${price.toFixed(4)}`;
  }
  if (price < 1) {
    return `$${price.toFixed(3)}`;
  }
  return `$${price.toFixed(2)}`;
}

/**
 * Get the price unit for a modality
 */
function getPriceUnit(modality: Modality): string {
  switch (modality) {
    case "text":
    case "embedding":
      return "/ 1M tokens";
    case "image":
      return "/ image";
    case "video":
      return "/ second";
    case "audio_tts":
    case "audio_stt":
    case "audio_generation":
      return "/ minute";
    case "vision":
    case "multimodal":
      return "varies";
    default:
      return "";
  }
}

/**
 * Compute statistics from a list of models
 */
export function computeStats(models: ModelEntry[], config: Config): CatalogStats {
  const byModality: Record<string, ModalityStats> = {};
  const sources = new Set<string>();
  let totalModels = 0;

  for (const model of models) {
    if (!hasUsablePrice(model)) {
      continue;
    }
    totalModels += 1;

    sources.add(model.source);

    const modality = model.modality;
    if (!byModality[modality]) {
      byModality[modality] = {
        count: 0,
        priceRange: { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY },
      };
    }

    byModality[modality].count++;

    const price = getModelPrimaryPrice(model);
    if (Number.isFinite(price)) {
      byModality[modality].priceRange.min = Math.min(byModality[modality].priceRange.min, price);
      byModality[modality].priceRange.max = Math.max(byModality[modality].priceRange.max, price);
    }
  }

  // Determine configured and missing sources
  const configuredSources: string[] = [];
  const missingSources: CatalogStats["missingSources"] = [];

  configuredSources.push("openrouter");

  if (config.falApiKey) {
    configuredSources.push("fal");
  } else {
    missingSources.push({
      name: "fal",
      envVar: "FAL_API_KEY",
      getUrl: "https://fal.ai/dashboard/keys",
    });
  }

  if (config.replicateApiToken) {
    configuredSources.push("replicate");
  } else {
    missingSources.push({
      name: "replicate",
      envVar: "REPLICATE_API_TOKEN",
      getUrl: "https://replicate.com/account/api-tokens",
    });
  }

  if (config.elevenLabsApiKey) {
    configuredSources.push("elevenlabs");
  } else {
    missingSources.push({
      name: "elevenlabs",
      envVar: "ELEVENLABS_API_KEY",
      getUrl: "https://elevenlabs.io/app/settings/api-keys",
    });
  }

  if (config.togetherApiKey) {
    configuredSources.push("together");
  } else {
    missingSources.push({
      name: "together",
      envVar: "TOGETHER_API_KEY",
      getUrl: "https://api.together.xyz/settings/api-keys",
    });
  }

  return {
    totalModels,
    sources: Array.from(sources).sort(),
    byModality,
    configuredSources,
    missingSources,
  };
}

/**
 * Format stats for terminal output
 */
export function formatStatsTerminal(stats: CatalogStats, noColor: boolean = false): string {
  const c = noColor ? new Chalk({ level: 0 }) : chalk;
  const lines: string[] = [];

  lines.push(
    `Catalog: ${c.bold(stats.totalModels.toString())} models from ${c.bold(stats.sources.length.toString())} source${stats.sources.length !== 1 ? "s" : ""}`
  );
  lines.push("");

  // Table header
  lines.push("┌────────────────┬───────┬────────────────────────────┐");
  lines.push("│ Modality       │ Count │ Price Range                │");
  lines.push("├────────────────┼───────┼────────────────────────────┤");

  // Table rows
  for (const modality of MODALITY_ORDER) {
    const label = MODALITY_LABELS[modality];
    const modStats = stats.byModality[modality];

    let priceRange: string;
    if (!modStats || modStats.count === 0) {
      priceRange = "N/A";
    } else {
      const unit = getPriceUnit(modality);
      const min = formatPrice(modStats.priceRange.min);
      const max = formatPrice(modStats.priceRange.max);
      if (min === "N/A" || max === "N/A") {
        priceRange = "Varies";
      } else if (min === max) {
        priceRange = `${min} ${unit}`;
      } else {
        priceRange = `${min} - ${max} ${unit}`;
      }
    }

    const count = modStats?.count ?? 0;
    const countStr = count.toString().padStart(5);
    const labelPadded = label.padEnd(14);
    const pricePadded = priceRange.padEnd(26);

    lines.push(`│ ${labelPadded} │ ${countStr} │ ${pricePadded} │`);
  }

  lines.push("└────────────────┴───────┴────────────────────────────┘");
  lines.push("");

  // Sources section
  if (stats.configuredSources.length > 0) {
    lines.push(`Sources configured: ${c.green(stats.configuredSources.join(", "))}`);
  }

  if (stats.missingSources.length > 0) {
    const missing = stats.missingSources
      .map((s) => `${s.name} (${c.dim(`set ${s.envVar}`)})`)
      .join(", ");
    lines.push(`Missing sources: ${c.yellow(missing)}`);
  }

  return lines.join("\n");
}

/**
 * Format stats for JSON output
 */
export function formatStatsJSON(stats: CatalogStats): object {
  return {
    totalModels: stats.totalModels,
    sources: stats.sources,
    byModality: Object.fromEntries(
      Object.entries(stats.byModality).map(([modality, modStats]) => [
        modality,
        {
          count: modStats.count,
          priceRange: {
            min: Number.isFinite(modStats.priceRange.min) ? modStats.priceRange.min : null,
            max: Number.isFinite(modStats.priceRange.max) ? modStats.priceRange.max : null,
          },
        },
      ])
    ),
    configuredSources: stats.configuredSources,
    missingSources: stats.missingSources,
  };
}
