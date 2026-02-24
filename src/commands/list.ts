/**
 * List command implementation
 *
 * Lists available models with filtering and sorting options.
 *
 * @module commands/list
 */

import chalk, { Chalk } from "chalk";
import type { Modality, ModelEntry } from "../types.js";
import { renderBox } from "../formatter/box.js";
import { getModelPrimaryPrice } from "../model-pricing.js";

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

const DEFAULT_TERMINAL_COLUMNS = 80;
const MIN_CONTENT_WIDTH = 72;

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

function fitCell(value: string, width: number): string {
  return truncateCell(value, width).padEnd(width);
}

function buildSeparator(
  left: string,
  middle: string,
  right: string,
  widths: number[]
): string {
  return `${left}${widths.map((width) => "─".repeat(width + 2)).join(middle)}${right}`;
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
      return "N/A";
    case "video":
      if (pricing.perSecond) {
        return `$${pricing.perSecond.toFixed(3)} / sec`;
      }
      if (pricing.perGeneration) {
        return `$${pricing.perGeneration.toFixed(2)} / gen`;
      }
      return "N/A";
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
      return "N/A";
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
  let filtered = [...models];

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
        const pricedA = Number.isFinite(priceA);
        const pricedB = Number.isFinite(priceB);
        if (pricedA !== pricedB) {
          return pricedA ? -1 : 1;
        }
        if (!pricedA && !pricedB) {
          return a.name.localeCompare(b.name);
        }
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
    return renderBox(lines.join("\n"), {
      title: "Models",
      noColor,
      borderColor: "green",
    });
  }

  // Calculate and fit column widths to terminal content width
  const widths: [number, number, number, number, number] = [
    Math.max(10, "ID".length, ...items.map((item) => item.id.length)),
    Math.max(10, "Name".length, ...items.map((item) => item.name.length)),
    Math.max(16, "Pricing".length, ...items.map((item) => item.pricing.length)),
    Math.max(7, "Context".length),
    Math.max(6, "Source".length, ...items.map((item) => item.source.length)),
  ];
  const maxWidths: [number, number, number, number, number] = [56, 28, 24, 8, 12];
  for (const index of [0, 1, 2, 3, 4] as const) {
    widths[index] = Math.min(widths[index], maxWidths[index]);
  }
  const minWidths: [number, number, number, number, number] = [18, 12, 12, 7, 6];
  const tableWidth = (): number => widths.reduce((sum, width) => sum + width, 0) + 16;
  const maxContentWidth = getMaxContentWidth();

  let overflow = tableWidth() - maxContentWidth;
  if (overflow > 0) {
    const shrinkOrder: Array<0 | 1 | 2 | 3 | 4> = [0, 1, 2, 4, 3];
    for (const columnIndex of shrinkOrder) {
      if (overflow <= 0) {
        break;
      }
      const reducible = widths[columnIndex] - minWidths[columnIndex];
      if (reducible <= 0) {
        continue;
      }
      const reduction = Math.min(reducible, overflow);
      widths[columnIndex] -= reduction;
      overflow -= reduction;
    }
  }
  const [idWidth, nameWidth, pricingWidth, contextWidth, sourceWidth] = widths;

  lines.push(buildSeparator("┌", "┬", "┐", widths));
  lines.push(
    `│ ${c.bold(fitCell("ID", idWidth))} │ ${c.bold(fitCell("Name", nameWidth))} │ ${c.bold(
      fitCell("Pricing", pricingWidth)
    )} │ ${c.bold(fitCell("Context", contextWidth))} │ ${c.bold(fitCell("Source", sourceWidth))} │`
  );
  lines.push(buildSeparator("├", "┼", "┤", widths));

  // Table rows
  for (const item of items) {
    lines.push(
      `│ ${c.cyan(fitCell(item.id, idWidth))} │ ${fitCell(item.name, nameWidth)} │ ${fitCell(
        item.pricing,
        pricingWidth
      )} │ ${fitCell(formatContext(item.context), contextWidth)} │ ${fitCell(item.source, sourceWidth)} │`
    );
  }

  lines.push(buildSeparator("└", "┴", "┘", widths));

  // Footer hint
  if (options.limit < total) {
    lines.push("");
    lines.push(c.dim(`Use --limit ${total} to show all, or filter with --modality, --source`));
  }

  return renderBox(lines.join("\n"), {
    title: "Models",
    noColor,
    borderColor: "green",
  });
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
