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
import { renderBox } from "../formatter/box.js";
import { getModelPrimaryPrice, hasUsablePrice } from "../model-pricing.js";

export interface ModalityStats {
  count: number;
  pricedCount: number;
  priceRange: {
    min: number;
    max: number;
  };
}

export interface CatalogStats {
  totalModels: number;
  queriedSources?: string[];
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

const DEFAULT_TERMINAL_COLUMNS = 80;
const MIN_CONTENT_WIDTH = 72;

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
export function computeStats(
  models: ModelEntry[],
  config: Config,
  queriedSources?: string[]
): CatalogStats {
  const byModality: Record<string, ModalityStats> = {};
  const sources = new Set<string>();
  let totalModels = 0;

  for (const model of models) {
    totalModels += 1;

    sources.add(model.source);

    const modality = model.modality;
    if (!byModality[modality]) {
      byModality[modality] = {
        count: 0,
        pricedCount: 0,
        priceRange: { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY },
      };
    }

    byModality[modality].count++;

    if (hasUsablePrice(model)) {
      byModality[modality].pricedCount++;
      const price = getModelPrimaryPrice(model);
      if (Number.isFinite(price)) {
        byModality[modality].priceRange.min = Math.min(byModality[modality].priceRange.min, price);
        byModality[modality].priceRange.max = Math.max(byModality[modality].priceRange.max, price);
      }
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
    queriedSources,
    sources: Array.from(sources).sort(),
    byModality,
    configuredSources,
    missingSources,
  };
}

function getMaxContentWidth(): number {
  const columns = process.stdout?.columns;
  if (typeof columns !== "number" || !Number.isFinite(columns) || columns <= 0) {
    return DEFAULT_TERMINAL_COLUMNS - 8;
  }
  return Math.max(MIN_CONTENT_WIDTH, columns - 8);
}

function truncateCell(value: string, width: number): string {
  if (value.length <= width) {
    return value;
  }
  if (width <= 3) {
    return value.slice(0, width);
  }
  return `${value.slice(0, width - 3)}...`;
}

function buildSeparator(
  left: string,
  middle: string,
  right: string,
  widths: number[]
): string {
  return `${left}${widths.map((width) => "─".repeat(width + 2)).join(middle)}${right}`;
}

function buildRow(cells: string[], widths: number[]): string {
  return `│ ${cells
    .map((cell, index) => {
      const width = widths[index] ?? 0;
      return truncateCell(cell, width).padEnd(width);
    })
    .join(" │ ")} │`;
}

/**
 * Format stats for terminal output
 */
export function formatStatsTerminal(stats: CatalogStats, noColor: boolean = false): string {
  const c = noColor ? new Chalk({ level: 0 }) : chalk;
  const lines: string[] = [];
  const queriedSourceCount = stats.queriedSources?.length ?? stats.sources.length;
  if (queriedSourceCount !== stats.sources.length) {
    lines.push(
      `Catalog: ${c.bold(stats.totalModels.toString())} models from ${c.bold(
        queriedSourceCount.toString()
      )} queried source${queriedSourceCount !== 1 ? "s" : ""} (${c.bold(
        stats.sources.length.toString()
      )} with priced models)`
    );
  } else {
    lines.push(
      `Catalog: ${c.bold(stats.totalModels.toString())} models from ${c.bold(
        stats.sources.length.toString()
      )} source${stats.sources.length !== 1 ? "s" : ""}`
    );
  }
  lines.push("");
  const rows = MODALITY_ORDER.map((modality) => {
    const label = MODALITY_LABELS[modality];
    const modStats = stats.byModality[modality];
    let priceRange = "N/A";
    if (modStats && modStats.pricedCount > 0) {
      const unit = getPriceUnit(modality);
      const min = formatPrice(modStats.priceRange.min);
      const max = formatPrice(modStats.priceRange.max);
      if (min === "N/A" || max === "N/A") {
        priceRange = "N/A";
      } else if (min === max) {
        priceRange = `${min} ${unit}`;
      } else {
        priceRange = `${min} - ${max} ${unit}`;
      }
    }
    return {
      label,
      count: (modStats?.count ?? 0).toString(),
      priceRange,
    };
  });

  let labelWidth = Math.max("Modality".length, ...rows.map((row) => row.label.length));
  let countWidth = Math.max("Count".length, ...rows.map((row) => row.count.length));
  let priceWidth = Math.max("Price Range".length, ...rows.map((row) => row.priceRange.length));
  const widths: [number, number, number] = [labelWidth, countWidth, priceWidth];
  const tableWidth = (): number => widths.reduce((sum, width) => sum + width, 0) + 10;
  const maxContentWidth = getMaxContentWidth();
  const minimums: [number, number, number] = [8, 5, 12];

  let overflow = tableWidth() - maxContentWidth;
  if (overflow > 0) {
    const shrinkOrder: Array<0 | 1 | 2> = [2, 0];
    for (const index of shrinkOrder) {
      if (overflow <= 0) {
        break;
      }
      const reducible = widths[index] - minimums[index];
      if (reducible <= 0) {
        continue;
      }
      const reduction = Math.min(reducible, overflow);
      widths[index] -= reduction;
      overflow -= reduction;
    }
  }
  [labelWidth, countWidth, priceWidth] = widths;
  const finalWidths = [labelWidth, countWidth, priceWidth];

  lines.push(buildSeparator("┌", "┬", "┐", finalWidths));
  lines.push(buildRow(["Modality", "Count", "Price Range"], finalWidths));
  lines.push(buildSeparator("├", "┼", "┤", finalWidths));

  for (const row of rows) {
    lines.push(buildRow([row.label, row.count, row.priceRange], finalWidths));
  }

  lines.push(buildSeparator("└", "┴", "┘", finalWidths));
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

  return renderBox(lines.join("\n"), {
    title: "Stats",
    noColor,
    borderColor: "blue",
  });
}

/**
 * Format stats for JSON output
 */
export function formatStatsJSON(stats: CatalogStats): object {
  return {
    totalModels: stats.totalModels,
    queriedSources: stats.queriedSources ?? null,
    sources: stats.sources,
    byModality: Object.fromEntries(
      Object.entries(stats.byModality).map(([modality, modStats]) => [
        modality,
        {
          count: modStats.count,
          pricedCount: modStats.pricedCount,
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
