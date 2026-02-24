/**
 * Compare command implementation
 *
 * Compares two models head-to-head for a specific task.
 *
 * @module commands/compare
 */

import chalk, { Chalk } from "chalk";
import { ExitCode, WhichModelError, type CompressedModel, type ModelEntry } from "../types.js";
import { compressForLLM } from "../catalog/compressor.js";
import { renderBox } from "../formatter/box.js";
import { requestRecommendationCompletion } from "../recommender/llm-client.js";
import { parseCompareResultPayload } from "../schemas/llm-schemas.js";
import { wrapResult } from "../utils/result.js";

export interface CompareOptions {
  task: string;
}

export interface CompareResult {
  winner: "A" | "B" | "tie";
  reasoning: string;
  modelA: {
    strengths: string[];
    weaknesses: string[];
    estimatedCost: string;
    suitedFor: string[];
  };
  modelB: {
    strengths: string[];
    weaknesses: string[];
    estimatedCost: string;
    suitedFor: string[];
  };
}

export interface CompareJSONOutput {
  winner: CompareResult["winner"];
  reasoning: string;
  modelA: CompareResult["modelA"] & {
    id: string;
    name: string;
  };
  modelB: CompareResult["modelB"] & {
    id: string;
    name: string;
  };
}

const COMPARE_SYSTEM_PROMPT = `You are an expert AI model evaluator. Your task is to compare two AI models for a specific use case.

You will receive:
1. A task description
2. Two models with their specifications

You must analyze both models and determine which is better suited for the given task.

Consider:
- Pricing and cost efficiency
- Context length and capabilities
- Quality and reliability for the specific task
- Speed and latency implications

Respond with a JSON object matching this exact structure:
{
  "winner": "A" or "B" or "tie",
  "reasoning": "A brief explanation of why this model won (2-3 sentences)",
  "modelA": {
    "strengths": ["strength 1", "strength 2"],
    "weaknesses": ["weakness 1"],
    "estimatedCost": "Cost estimate for typical usage",
    "suitedFor": ["use case 1", "use case 2"]
  },
  "modelB": {
    "strengths": ["strength 1", "strength 2"],
    "weaknesses": ["weakness 1"],
    "estimatedCost": "Cost estimate for typical usage",
    "suitedFor": ["use case 1", "use case 2"]
  }
}`;

function buildCompareUserPrompt(
  task: string,
  modelA: CompressedModel,
  modelB: CompressedModel
): string {
  return `Task: ${task}

Model A (ID: ${modelA.id}):
${JSON.stringify(modelA, null, 2)}

Model B (ID: ${modelB.id}):
${JSON.stringify(modelB, null, 2)}

Compare these two models for the given task and determine which is better suited.`;
}

/**
 * Find a model by ID (supports partial matching)
 */
export function findModelById(models: ModelEntry[], id: string): ModelEntry | null {
  // Try exact match first
  const exact = models.find((m) => m.id === id);
  if (exact) return exact;

  // Try matching without source prefix
  const withoutSource = models.find((m) => {
    const parts = m.id.split("::");
    const modelId = parts.length > 1 ? parts.slice(1).join("::") : m.id;
    return modelId === id || m.id.endsWith(`/${id}`);
  });
  if (withoutSource) return withoutSource;

  // Try partial match
  const partial = models.find((m) =>
    m.id.toLowerCase().includes(id.toLowerCase()) ||
    m.name.toLowerCase().includes(id.toLowerCase())
  );
  return partial ?? null;
}

/**
 * Call the LLM to compare models
 */
export async function callCompareLLM(
  task: string,
  modelA: ModelEntry,
  modelB: ModelEntry,
  apiKey: string,
  recommenderModel: string
): Promise<CompareResult> {
  // Compress models for LLM context
  const [compressedA] = compressForLLM([modelA]);
  const [compressedB] = compressForLLM([modelB]);

  const userPrompt = buildCompareUserPrompt(task, compressedA!, compressedB!);

  const response = await requestRecommendationCompletion({
    apiKey,
    model: recommenderModel,
    systemPrompt: COMPARE_SYSTEM_PROMPT,
    userPrompt,
    temperature: 0.3, // Lower temperature for more consistent comparisons
  });

  // Parse the JSON response
  const parseResult = wrapResult(
    () => JSON.parse(stripMarkdownFences(response.content)),
    () => new WhichModelError("Invalid compare response JSON.", ExitCode.LLM_FAILED)
  );
  if (parseResult.isErr()) {
    // If parsing fails, return a default comparison
    return {
      winner: "tie",
      reasoning: "Could not determine a clear winner from the comparison.",
      modelA: {
        strengths: ["Model specifications available"],
        weaknesses: [],
        estimatedCost: formatModelPricing(modelA),
        suitedFor: ["General use"],
      },
      modelB: {
        strengths: ["Model specifications available"],
        weaknesses: [],
        estimatedCost: formatModelPricing(modelB),
        suitedFor: ["General use"],
      },
    };
  }

  const comparisonResult = parseCompareResultPayload(parseResult.value);
  if (comparisonResult.isErr()) {
    return {
      winner: "tie",
      reasoning: "Could not determine a clear winner from the comparison.",
      modelA: {
        strengths: ["Model specifications available"],
        weaknesses: [],
        estimatedCost: formatModelPricing(modelA),
        suitedFor: ["General use"],
      },
      modelB: {
        strengths: ["Model specifications available"],
        weaknesses: [],
        estimatedCost: formatModelPricing(modelB),
        suitedFor: ["General use"],
      },
    };
  }

  return comparisonResult.value;
}

function stripMarkdownFences(content: string): string {
  return content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

/**
 * Format a model's pricing for display
 */
function formatModelPricing(model: ModelEntry): string {
  const pricing = model.pricing;
  switch (pricing.type) {
    case "text":
      return `$${pricing.promptPer1mTokens.toFixed(2)} / $${pricing.completionPer1mTokens.toFixed(2)} per 1M tokens`;
    case "image":
      if (pricing.perImage) return `$${pricing.perImage.toFixed(4)} per image`;
      if (pricing.perMegapixel) return `$${pricing.perMegapixel.toFixed(4)} per MP`;
      return "Pricing varies";
    case "video":
      if (pricing.perSecond) return `$${pricing.perSecond.toFixed(4)} per second`;
      if (pricing.perGeneration) return `$${pricing.perGeneration.toFixed(2)} per video`;
      return "Pricing varies";
    case "audio":
      if (pricing.perMinute) return `$${pricing.perMinute.toFixed(4)} per minute`;
      if (pricing.perCharacter) return `$${pricing.perCharacter.toFixed(6)} per character`;
      return "Pricing varies";
    case "embedding":
      return `$${pricing.per1mTokens.toFixed(3)} per 1M tokens`;
    default:
      return "Pricing varies";
  }
}

/**
 * Format compare result for terminal output
 */
export function formatCompareTerminal(
  result: CompareResult,
  modelA: ModelEntry,
  modelB: ModelEntry,
  options: CompareOptions,
  noColor: boolean = false
): string {
  const c = noColor ? new Chalk({ level: 0 }) : chalk;
  const lines: string[] = [];

  lines.push(c.bold("Model Comparison"));
  lines.push(c.dim(`Task: ${options.task}`));
  lines.push("");

  // Winner announcement
  let winnerText: string;
  let winnerColor: (text: string) => string;
  if (result.winner === "A") {
    winnerText = `Winner: ${modelA.name}`;
    winnerColor = c.green;
  } else if (result.winner === "B") {
    winnerText = `Winner: ${modelB.name}`;
    winnerColor = c.green;
  } else {
    winnerText = "Result: It's a tie!";
    winnerColor = c.yellow;
  }
  lines.push(winnerColor(winnerText));
  lines.push(c.dim(result.reasoning));
  lines.push("");

  // Model A details
  lines.push(c.cyan(`Model A: ${c.bold(modelA.name)}`));
  lines.push(`   ${c.dim(`ID: ${modelA.id}`)}`);
  lines.push(`   ${c.dim(`Pricing: ${formatModelPricing(modelA)}`)}`);
  if (result.modelA.strengths.length > 0) {
    lines.push(`   ${c.green("Strengths:")}`);
    for (const s of result.modelA.strengths) {
      lines.push(`     • ${s}`);
    }
  }
  if (result.modelA.weaknesses.length > 0) {
    lines.push(`   ${c.red("Weaknesses:")}`);
    for (const w of result.modelA.weaknesses) {
      lines.push(`     • ${w}`);
    }
  }
  lines.push("");

  // Model B details
  lines.push(c.magenta(`Model B: ${c.bold(modelB.name)}`));
  lines.push(`   ${c.dim(`ID: ${modelB.id}`)}`);
  lines.push(`   ${c.dim(`Pricing: ${formatModelPricing(modelB)}`)}`);
  if (result.modelB.strengths.length > 0) {
    lines.push(`   ${c.green("Strengths:")}`);
    for (const s of result.modelB.strengths) {
      lines.push(`     • ${s}`);
    }
  }
  if (result.modelB.weaknesses.length > 0) {
    lines.push(`   ${c.red("Weaknesses:")}`);
    for (const w of result.modelB.weaknesses) {
      lines.push(`     • ${w}`);
    }
  }

  return renderBox(lines.join("\n"), {
    title: "Compare",
    noColor,
    borderColor: "yellow",
  });
}

/**
 * Format compare result for JSON output
 */
export function formatCompareJSON(
  result: CompareResult,
  modelA: ModelEntry,
  modelB: ModelEntry
): CompareJSONOutput {
  return {
    winner: result.winner,
    reasoning: result.reasoning,
    modelA: {
      id: modelA.id,
      name: modelA.name,
      ...result.modelA,
    },
    modelB: {
      id: modelB.id,
      name: modelB.name,
      ...result.modelB,
    },
  };
}
