import { compressForLLM, groupByModality } from "../catalog/compressor.js";
import {
  ExitCode,
  WhichModelError,
  type Constraints,
  type ModelEntry,
  type Recommendation,
  type RecommendationMeta,
} from "../types.js";
import { generateFallbackRecommendation } from "./fallback.js";
import { requestRecommendationCompletion } from "./llm-client.js";
import { buildSystemPrompt, buildUserPrompt } from "./prompts.js";
import { findClosestModelId, validateRecommendation } from "./validator.js";

const TOOL_VERSION = "0.1.0";

const RECOMMENDER_MODEL_PRICING_PER_1M: Record<
  string,
  { promptPer1mTokens: number; completionPer1mTokens: number }
> = {
  "deepseek/deepseek-v3.2": {
    promptPer1mTokens: 0.25,
    completionPer1mTokens: 0.38,
  },
  "openai/gpt-4o-mini": {
    promptPer1mTokens: 0.15,
    completionPer1mTokens: 0.6,
  },
};

export interface RecommendOptions {
  task: string;
  models: ModelEntry[];
  apiKey: string;
  recommenderModel: string;
  constraints?: Constraints;
  catalogSources: string[];
}

export interface RecommendResult {
  recommendation: Recommendation;
  meta: RecommendationMeta;
}

export async function recommend(options: RecommendOptions): Promise<RecommendResult> {
  const { task, models, apiKey, recommenderModel, constraints, catalogSources } = options;
  if (models.length === 0) {
    throw new WhichModelError(
      "No models found from configured sources.",
      ExitCode.NO_MODELS_FOUND,
      "Check your source configuration and retry."
    );
  }

  const recommendationStartedAt = Date.now();
  const compressed = compressForLLM(models);
  const grouped = groupByModality(compressed);

  let recommendation: Recommendation;
  let promptTokens: number | undefined;
  let completionTokens: number | undefined;
  let recommendationCostUsd = 0;

  try {
    const completion = await requestRecommendationCompletion({
      apiKey,
      model: recommenderModel,
      systemPrompt: buildSystemPrompt(),
      userPrompt: buildUserPrompt(task, grouped, constraints),
    });

    recommendation = parseRecommendation(completion.content);
    promptTokens = completion.usage?.promptTokens;
    completionTokens = completion.usage?.completionTokens;
    recommendationCostUsd = estimateRecommendationCost(
      recommenderModel,
      promptTokens,
      completionTokens
    );

    const validation = validateRecommendation(recommendation, new Set(models.map((m) => m.id)));
    if (!validation.valid) {
      recommendation = repairRecommendationIds(recommendation, new Set(models.map((m) => m.id)));
    }

    const repairedValidation = validateRecommendation(
      recommendation,
      new Set(models.map((m) => m.id))
    );
    if (!repairedValidation.valid) {
      recommendation = generateFallbackRecommendation(task, models, constraints);
    }
  } catch (error) {
    if (error instanceof WhichModelError && error.exitCode !== ExitCode.LLM_FAILED) {
      throw error;
    }

    recommendation = generateFallbackRecommendation(task, models, constraints);
  }

  const detectedModality = recommendation.taskAnalysis.detectedModality;
  const catalogModelsInModality = models.filter(
    (model) => model.modality === detectedModality
  ).length;
  recommendation = attachMissingModalityGuidance(
    recommendation,
    catalogSources,
    catalogModelsInModality
  );

  return {
    recommendation,
    meta: {
      recommenderModel,
      recommendationCostUsd,
      promptTokens,
      completionTokens,
      recommendationLatencyMs: Date.now() - recommendationStartedAt,
      catalogSources,
      catalogTotalModels: models.length,
      catalogModelsInModality,
      timestamp: new Date().toISOString(),
      version: TOOL_VERSION,
    },
  };
}

function attachMissingModalityGuidance(
  recommendation: Recommendation,
  catalogSources: string[],
  catalogModelsInModality: number
): Recommendation {
  if (catalogModelsInModality > 0) {
    return recommendation;
  }

  const detected = recommendation.taskAnalysis.detectedModality;
  const sourcesLabel = catalogSources.join(", ");
  const guidanceLines = [
    `No '${detected}' models are available in configured sources (${sourcesLabel}).`,
  ];

  if (
    (detected === "image" ||
      detected === "video" ||
      detected === "audio_tts" ||
      detected === "audio_stt" ||
      detected === "audio_generation") &&
    !catalogSources.includes("fal")
  ) {
    guidanceLines.push("Add fal media models with --sources openrouter,fal and set FAL_API_KEY.");
  }

  if (
    (detected === "image" ||
      detected === "video" ||
      detected === "audio_tts" ||
      detected === "audio_stt" ||
      detected === "audio_generation") &&
    !catalogSources.includes("replicate")
  ) {
    guidanceLines.push(
      "Add Replicate media coverage with --sources openrouter,replicate and set REPLICATE_API_TOKEN."
    );
  }

  guidanceLines.push("Broaden sources or force a different modality with --modality.");
  const guidance = guidanceLines.join(" ");

  return {
    ...recommendation,
    alternativesInOtherModalities: recommendation.alternativesInOtherModalities
      ? `${recommendation.alternativesInOtherModalities} ${guidance}`
      : guidance,
  };
}

function parseRecommendation(rawContent: string): Recommendation {
  const sanitized = stripMarkdownFences(rawContent).trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(sanitized);
  } catch {
    throw new WhichModelError(
      "LLM returned invalid JSON.",
      ExitCode.LLM_FAILED,
      "Retry in a few minutes or use fallback mode."
    );
  }

  if (!isRecommendation(parsed)) {
    throw new WhichModelError(
      "LLM JSON response does not match expected recommendation structure.",
      ExitCode.LLM_FAILED,
      "Retry in a few minutes or use fallback mode."
    );
  }

  return parsed;
}

function repairRecommendationIds(
  recommendation: Recommendation,
  validIds: Set<string>
): Recommendation {
  const patched: Recommendation = JSON.parse(JSON.stringify(recommendation)) as Recommendation;

  for (const tier of ["cheapest", "balanced", "best"] as const) {
    const currentId = patched.recommendations[tier].id;
    if (validIds.has(currentId)) {
      continue;
    }

    const closest = findClosestModelId(currentId, validIds);
    if (closest) {
      patched.recommendations[tier].id = closest;
    }
  }

  return patched;
}

function stripMarkdownFences(content: string): string {
  return content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
}

function isRecommendation(value: unknown): value is Recommendation {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<Recommendation>;
  return (
    typeof candidate.taskAnalysis?.summary === "string" &&
    typeof candidate.taskAnalysis?.detectedModality === "string" &&
    typeof candidate.taskAnalysis?.modalityReasoning === "string" &&
    Array.isArray(candidate.taskAnalysis?.keyRequirements) &&
    typeof candidate.taskAnalysis?.costFactors === "string" &&
    typeof candidate.recommendations?.cheapest?.id === "string" &&
    typeof candidate.recommendations?.balanced?.id === "string" &&
    typeof candidate.recommendations?.best?.id === "string"
  );
}

function estimateRecommendationCost(
  modelId: string,
  promptTokens?: number,
  completionTokens?: number
): number {
  if (typeof promptTokens !== "number" || typeof completionTokens !== "number") {
    return 0;
  }

  const pricing = RECOMMENDER_MODEL_PRICING_PER_1M[modelId];
  if (!pricing) {
    return 0;
  }

  const inputCost = (promptTokens / 1_000_000) * pricing.promptPer1mTokens;
  const outputCost = (completionTokens / 1_000_000) * pricing.completionPer1mTokens;
  return inputCost + outputCost;
}
