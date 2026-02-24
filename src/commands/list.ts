/**
 * List command implementation
 *
 * Lists available models with filtering and sorting options.
 *
 * @module commands/list
 */

import chalk, { Chalk } from "chalk";
import type { Modality, ModelEntry } from "../types.js";
import { getModelPrimaryPrice, hasUsablePrice } from "../model-pricing.js";

export interface ListOptions {
  modality?: Modality;
  source?: string;
  sort: "price" | "name" | "context";
  limit: number;
}

export interface ModelListItem {
  id: string;
  name: string;
  pricing: string;
  context?: number;
  modality: string;
  source: string;
}

/**
 * Get the primary price for a model based on its modality
 */
/**
 * Format pricing for display
 */
function formatPricing(model: ModelEntry): string {
  const pricing = model.pricing;

  switch (pricing.type) {
    case "text":
      return `$${pricing.promptPer1mTokens.toFixed(2)} / $${pricing.completionPer1mTokens.toFixed(2)}`;
    case "image":
      if (pricing.perImage) {
        return `$${pricing.perImage.toFixed(3)} / image`;
      }
      if (pricing.perMegapixel) {
        return `$${pricing.perMegapixel.toFixed(3)} / MP`;
      }
      return "Varies";
    case "video":
      if (pricing.perSecond) {
        return `$${pricing.perSecond.toFixed(3)} / sec`;
      }
      if (pricing.perGeneration) {
        return `$${pricing.perGeneration.toFixed(2)} / gen`;
      }
      return "Varies";
    case "audio":
      if (pricing.perMinute) {
        return `$${pricing.perMinute.toFixed(3)} / min`;
      }
      if (pricing.perCharacter) {
        return `$${pricing.perCharacter.toFixed(6)} / char`;
      }
      if (pricing.perSecond) {
        return `$${pricing.perSecond.toFixed(4)} / sec`;
      }
      return "Varies";
    case "embedding":
      return `$${pricing.per1mTokens.toFixed(3)} / 1M`;
    default:
      return "N/A";
  }
}

/**
 * Format context length for display
 */
function formatContext(context?: number): string {
  if (!context) return "-";
  if (context >= 1_000_000) {
    return `${(context / 1_000_000).toFixed(1)}M`;
  }
  if (context >= 1000) {
    return `${Math.round(context / 1000)}K`;
  }
  return context.toString();
}

/**
 * Filter and sort models based on options
 */
export function filterAndSortModels(models: ModelEntry[], options: ListOptions): ModelListItem[] {
  let filtered = models.filter((model) => hasUsablePrice(model));

  // Filter by modality
  if (options.modality) {
    filtered = filtered.filter((m) => m.modality === options.modality);
  }

  // Filter by source
  if (options.source) {
    filtered = filtered.filter((m) => m.source === options.source);
  }

  // Sort
  filtered.sort((a, b) => {
    switch (options.sort) {
      case "price": {
        const priceA = getModelPrimaryPrice(a);
        const priceB = getModelPrimaryPrice(b);
        return priceA - priceB;
      }
      case "name":
        return a.name.localeCompare(b.name);
      case "context": {
        const ctxA = a.contextLength ?? 0;
        const ctxB = b.contextLength ?? 0;
        return ctxB - ctxA; // Higher context first
      }
      default:
        return 0;
    }
  });

  // Limit
  filtered = filtered.slice(0, options.limit);

  return filtered.map((m) => ({
    id: m.id,
    name: m.name,
    pricing: formatPricing(m),
    context: m.contextLength,
    modality: m.modality,
    source: m.source,
  }));
}

/**
 * Format list for terminal output
 */
export function formatListTerminal(
  items: ModelListItem[],
  total: number,
  options: ListOptions,
  noColor: boolean = false
): string {
  const c = noColor ? new Chalk({ level: 0 }) : chalk;
  const lines: string[] = [];

  // Header
  const showingText = options.limit < total ? `(showing top ${options.limit}` : "";
  const filterText = options.modality ? `${options.modality} models` : "models";
  const sortText = `sorted by ${options.sort})`;

  if (showingText) {
    lines.push(c.dim(`${total} ${filterText} ${showingText}, ${sortText}`));
  } else {
    lines.push(c.dim(`${total} ${filterText} (${sortText})`));
  }
  lines.push("");

  if (items.length === 0) {
    lines.push("No models found matching the criteria.");
    return lines.join("\n");
  }

  // Calculate column widths
  const idWidth = Math.max(10, ...items.map((i) => i.id.length)) + 2;
  const nameWidth = Math.max(10, ...items.map((i) => i.name.length)) + 2;
  const pricingWidth = Math.max(16, ...items.map((i) => i.pricing.length)) + 2;
  const contextWidth = 8;
  const sourceWidth = Math.max(6, ...items.map((i) => i.source.length)) + 2;

  // Table header
  const separator = "─".repeat(idWidth + nameWidth + pricingWidth + contextWidth + sourceWidth + 8);
  lines.push(`┌${separator}┐`);
  lines.push(
    `│ ${c.bold("ID".padEnd(idWidth))}│ ${c.bold("Name".padEnd(nameWidth))}│ ${c.bold("Pricing".padEnd(pricingWidth))}│ ${c.bold("Context".padEnd(contextWidth))}│ ${c.bold("Source")} │`
  );
  lines.push(`├${separator}┤`);

  // Table rows
  for (const item of items) {
    const idPadded = item.id.padEnd(idWidth);
    const namePadded = item.name.slice(0, nameWidth - 2).padEnd(nameWidth);
    const pricingPadded = item.pricing.padEnd(pricingWidth);
    const contextPadded = formatContext(item.context).padEnd(contextWidth);
    const sourcePadded = item.source.padEnd(sourceWidth - 1);

    lines.push(`│ ${c.cyan(idPadded)}│ ${namePadded}│ ${pricingPadded}│ ${contextPadded}│ ${sourcePadded}│`);
  }

  lines.push(`└${separator}┘`);

  // Footer hint
  if (options.limit < total) {
    lines.push("");
    lines.push(c.dim(`Use --limit ${total} to show all, or filter with --modality, --source`));
  }

  return lines.join("\n");
}

/**
 * Format list for JSON output
 */
export function formatListJSON(items: ModelListItem[]): object {
  return {
    models: items.map((item) => ({
      id: item.id,
      name: item.name,
      pricing: item.pricing,
      context: item.context ?? null,
      modality: item.modality,
      source: item.source,
    })),
    count: items.length,
  };
}
