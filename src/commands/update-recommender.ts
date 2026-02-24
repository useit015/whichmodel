/**
 * Self-updating recommender module
 *
 * Allows the tool to analyze available models and update its default recommender.
 *
 * @module commands/update-recommender
 */

import chalk, { Chalk } from "chalk";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { renderBox } from "../formatter/box.js";
import type { ModelEntry, TextPricing } from "../types.js";
import { generateFallbackRecommendation } from "../recommender/fallback.js";

export interface RecommenderCriteria {
  modality: "text";
  maxPromptPricePer1m: number;
  maxCompletionPricePer1m: number;
  minContextLength: number;
}

export interface RecommenderUpdate {
  currentModel: string;
  newModel: string;
  newModelName: string;
  changed: boolean;
  reasoning: string;
  newPricing: {
    promptPer1m: number;
    completionPer1m: number;
  };
  savings: {
    promptPer1m: number;
    completionPer1m: number;
  } | null;
}

export const DEFAULT_RECOMMENDER_CRITERIA: RecommenderCriteria = {
  modality: "text",
  maxPromptPricePer1m: 1.00,
  maxCompletionPricePer1m: 2.00,
  minContextLength: 32000,
};

const RECOMMENDER_SELECTION_TASK =
  "Select the best-value model for analyzing user tasks and returning structured JSON recommendations.";

/**
 * Check if a model family supports reasoning
 */
function supportsReasoning(model: ModelEntry): boolean {
  const reasoningFamilies = ["claude", "gpt-4", "o1", "o3", "deepseek", "gemini", "qwen"];
  const family = model.family.toLowerCase();
  const name = model.name.toLowerCase();

  return (
    reasoningFamilies.some((f) => family.includes(f)) ||
    name.includes("reasoning") ||
    name.includes("think")
  );
}

function normalizeModelId(id: string): string {
  const parts = id.split("::");
  return parts.length > 1 ? parts.slice(1).join("::") : id;
}

/**
 * Select the best recommender model based on criteria
 */
export function selectBestRecommender(
  models: ModelEntry[],
  criteria: RecommenderCriteria = DEFAULT_RECOMMENDER_CRITERIA
): ModelEntry | null {
  const candidates = models.filter((model) => {
    // Recommender requests are sent through OpenRouter chat completions.
    if (model.source !== "openrouter") return false;

    // Must be text modality
    if (model.modality !== criteria.modality) return false;

    if (model.pricing.type !== "text") return false;
    const pricing = model.pricing;

    // Must support reasoning
    if (!supportsReasoning(model)) return false;

    // Must meet minimum context length
    if ((model.contextLength ?? 0) < criteria.minContextLength) return false;

    // Check pricing
    if (pricing.promptPer1mTokens > criteria.maxPromptPricePer1m) return false;
    if (pricing.completionPer1mTokens > criteria.maxCompletionPricePer1m) return false;

    return true;
  });

  if (candidates.length === 0) {
    return null;
  }

  // Reuse the same fallback recommender tiering logic used by main `whichmodel`.
  const selection = generateFallbackRecommendation(RECOMMENDER_SELECTION_TASK, candidates, {
    modality: "text",
  });
  const selectedId = selection.recommendations.cheapest.id;

  return candidates.find((model) => model.id === selectedId) ?? candidates[0] ?? null;
}

/**
 * Get the config file path
 */
function getConfigPath(): string {
  if (process.env.WHICHMODEL_CONFIG) {
    return process.env.WHICHMODEL_CONFIG;
  }

  if (process.platform === "win32") {
    const appData = process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming");
    return path.join(appData, "whichmodel", "config.json");
  }
  return path.join(os.homedir(), ".config", "whichmodel", "config.json");
}

interface ConfigFile {
  apiKey?: string;
  recommenderModel?: string;
  falApiKey?: string;
  replicateApiToken?: string;
  elevenLabsApiKey?: string;
  togetherApiKey?: string;
  cacheTtl?: number;
}

/**
 * Update the config file with a new recommender model
 */
export async function updateConfigFile(updates: Partial<ConfigFile>): Promise<void> {
  const configPath = getConfigPath();
  const configDir = path.dirname(configPath);

  // Read existing config or create empty
  let existing: ConfigFile = {};
  try {
    const content = await fs.readFile(configPath, "utf-8");
    existing = JSON.parse(content) as ConfigFile;
  } catch {
    // Config doesn't exist, use empty
  }

  // Merge updates
  const updated = { ...existing, ...updates };

  // Ensure directory exists
  await fs.mkdir(configDir, { recursive: true, mode: 0o700 });

  // Write atomically
  const tempPath = `${configPath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(updated, null, 2), { mode: 0o600 });
  await fs.rename(tempPath, configPath);
}

/**
 * Update the default recommender model
 */
export async function updateRecommenderModel(
  models: ModelEntry[],
  currentModel: string,
  criteria: RecommenderCriteria = DEFAULT_RECOMMENDER_CRITERIA
): Promise<RecommenderUpdate> {
  const normalizedCurrentModel = normalizeModelId(currentModel);
  const best = selectBestRecommender(models, criteria);

  if (!best) {
    return {
      currentModel,
      newModel: normalizedCurrentModel,
      newModelName: currentModel,
      changed: false,
      reasoning: "No models meet the recommender criteria.",
      newPricing: { promptPer1m: 0, completionPer1m: 0 },
      savings: null,
    };
  }

  const bestPricing = best.pricing as TextPricing;
  const normalizedBestModel = normalizeModelId(best.id);
  const changed = normalizedBestModel !== normalizedCurrentModel;

  // Find current model pricing for comparison
  let savings: RecommenderUpdate["savings"] = null;
  const currentModelEntry = models.find(
    (m) => normalizeModelId(m.id) === normalizedCurrentModel
  );
  if (currentModelEntry && currentModelEntry.pricing.type === "text") {
    const currentPricing = currentModelEntry.pricing as TextPricing;
    savings = {
      promptPer1m: currentPricing.promptPer1mTokens - bestPricing.promptPer1mTokens,
      completionPer1m: currentPricing.completionPer1mTokens - bestPricing.completionPer1mTokens,
    };
  }

  // Update config file if changed
  if (changed) {
    await updateConfigFile({ recommenderModel: normalizedBestModel });
  }

  return {
    currentModel,
    newModel: normalizedBestModel,
    newModelName: best.name,
    changed,
    reasoning: changed
      ? `Found a better value model: ${best.name}`
      : "Current recommender is already optimal.",
    newPricing: {
      promptPer1m: bestPricing.promptPer1mTokens,
      completionPer1m: bestPricing.completionPer1mTokens,
    },
    savings,
  };
}

/**
 * Format the recommender update for terminal output
 */
export function formatRecommenderUpdate(update: RecommenderUpdate, noColor: boolean = false): string {
  const c = noColor ? new Chalk({ level: 0 }) : chalk;
  const lines: string[] = [];

  lines.push(c.cyan("Recommender Model Update"));
  lines.push("");

  if (update.changed) {
    lines.push(c.green(`New recommender: ${c.bold(update.newModelName)}`));
    lines.push(c.dim(`   Previous: ${update.currentModel}`));
  } else {
    lines.push(c.green(`Current recommender: ${c.bold(update.newModelName)} (no change)`));
    lines.push(c.dim(`   Model ID: ${update.newModel}`));
  }

  lines.push("");
  lines.push(`   Cost: $${update.newPricing.promptPer1m.toFixed(2)}/1M prompt, $${update.newPricing.completionPer1m.toFixed(2)}/1M completion`);

  if (update.savings) {
    if (update.savings.promptPer1m > 0 || update.savings.completionPer1m > 0) {
      lines.push(c.green(`   Savings: $${update.savings.promptPer1m.toFixed(2)}/1M prompt, $${update.savings.completionPer1m.toFixed(2)}/1M completion`));
    } else if (update.savings.promptPer1m < 0 || update.savings.completionPer1m < 0) {
      lines.push(c.yellow(`   Note: Previous model was cheaper but may have lower quality`));
    }
  }

  lines.push("");
  lines.push(c.dim(update.reasoning));

  if (update.changed) {
    lines.push("");
    lines.push(c.dim(`Config file updated: ${getConfigPath()}`));
  }

  return renderBox(lines.join("\n"), {
    title: "Recommender",
    noColor,
    borderColor: "cyan",
  });
}
