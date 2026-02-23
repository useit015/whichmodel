import type {
  Constraints,
  Modality,
  ModelEntry,
  ModelPick,
  Recommendation,
} from "../types.js";

const TIER_KEYS = ["cheapest", "balanced", "best"] as const;

export function generateFallbackRecommendation(
  task: string,
  models: ModelEntry[],
  constraints?: Constraints
): Recommendation {
  const detectedModality = constraints?.modality ?? detectTaskModality(task);
  const candidates = filterFallbackCandidates(models, detectedModality, constraints);

  const ordered = [...candidates].sort((a, b) => getPriceScore(a) - getPriceScore(b));
  const cheapest = ordered[0] ?? models[0];
  const balanced = ordered[Math.floor(Math.max(0, ordered.length - 1) / 2)] ?? cheapest;
  const best = pickBestCandidate(ordered) ?? balanced ?? cheapest;
  const defaultModel = cheapest ?? balanced ?? best;

  if (!defaultModel) {
    throw new Error("Fallback recommendation requires at least one model.");
  }

  const picks = uniquePicks([cheapest, balanced, best].filter(isModelEntry));

  return {
    taskAnalysis: {
      summary: summarizeTask(task),
      detectedModality,
      modalityReasoning:
        constraints?.modality
          ? `Modality was forced by constraints to ${constraints.modality}.`
          : `Detected ${detectedModality} from task keywords and fallback heuristics.`,
      keyRequirements: inferKeyRequirements(task, detectedModality),
      costFactors: describeCostFactors(detectedModality),
    },
    recommendations: {
      cheapest: toPick(
        picks[0] ?? defaultModel,
        "Lowest estimated price in the matched catalog subset."
      ),
      balanced: toPick(
        picks[1] ?? picks[0] ?? defaultModel,
        "Good compromise between price and capabilities for this modality."
      ),
      best: toPick(
        picks[2] ?? picks[1] ?? picks[0] ?? defaultModel,
        "Highest capability candidate in fallback selection."
      ),
    },
    alternativesInOtherModalities: null,
  };
}

export function detectTaskModality(task: string): Modality {
  const text = task.toLowerCase();

  if (/(transcribe|caption|speech to text|stt)/.test(text)) return "audio_stt";
  if (/(voiceover|text to speech|tts|narration|clone (a )?voice|voice clone)/.test(text)) {
    return "audio_tts";
  }
  if (/(music|soundtrack|audio generation)/.test(text)) return "audio_generation";
  if (/(embedding|semantic search|vector|rag)/.test(text)) return "embedding";
  if (
    /(screenshot|ocr|analy[sz]e image|analy[sz]e .*website|vision|extract text from pdf)/.test(
      text
    )
  ) {
    return "vision";
  }
  if (/(video|clip|animation)/.test(text) && !/(script|outline|copy)/.test(text)) return "video";
  if (/(image|photo|logo|illustration|art|avatar)/.test(text)) return "image";

  return "text";
}

function filterFallbackCandidates(
  models: ModelEntry[],
  modality: Modality,
  constraints?: Constraints
): ModelEntry[] {
  return models.filter((model) => {
    if (model.modality !== modality && !(modality === "text" && model.modality === "vision")) {
      return false;
    }

    if (typeof constraints?.minContext === "number") {
      if ((model.contextLength ?? 0) < constraints.minContext) {
        return false;
      }
    }

    if (typeof constraints?.maxPrice === "number") {
      if (getPriceScore(model) > constraints.maxPrice) {
        return false;
      }
    }

    return true;
  });
}

function pickBestCandidate(models: ModelEntry[]): ModelEntry | undefined {
  return [...models].sort((a, b) => {
    const contextA = a.contextLength ?? 0;
    const contextB = b.contextLength ?? 0;
    if (contextA !== contextB) {
      return contextB - contextA;
    }

    return getPriceScore(b) - getPriceScore(a);
  })[0];
}

function getPriceScore(model: ModelEntry): number {
  const pricing = model.pricing;

  switch (pricing.type) {
    case "text":
      return positiveOrInfinity(
        pricing.promptPer1mTokens + pricing.completionPer1mTokens
      );
    case "embedding":
      return positiveOrInfinity(pricing.per1mTokens);
    case "image":
      return positiveOrInfinity(
        pricing.perImage ?? pricing.perMegapixel ?? pricing.perStep
      );
    case "video":
      return positiveOrInfinity(pricing.perSecond ?? pricing.perGeneration);
    case "audio":
      return positiveOrInfinity(
        pricing.perMinute ?? pricing.perCharacter ?? pricing.perSecond
      );
    default:
      return Number.POSITIVE_INFINITY;
  }
}

function toPick(model: ModelEntry, reason: string): ModelPick {
  return {
    id: model.id,
    reason,
    pricingSummary: summarizePricing(model),
    estimatedCost: estimateCost(model),
  };
}

function summarizePricing(model: ModelEntry): string {
  const pricing = model.pricing;

  switch (pricing.type) {
    case "text":
      return `$${pricing.promptPer1mTokens.toFixed(2)} / $${pricing.completionPer1mTokens.toFixed(2)} per 1M tokens (in/out)`;
    case "embedding":
      return `$${pricing.per1mTokens.toFixed(2)} per 1M tokens`;
    case "image":
      if (typeof pricing.perImage === "number") return `$${pricing.perImage.toFixed(3)} per image`;
      if (typeof pricing.perMegapixel === "number") return `$${pricing.perMegapixel.toFixed(3)} per megapixel`;
      if (typeof pricing.perStep === "number") return `$${pricing.perStep.toFixed(5)} per step`;
      return "Pricing varies by provider";
    case "video":
      if (typeof pricing.perSecond === "number") return `$${pricing.perSecond.toFixed(3)} per second`;
      if (typeof pricing.perGeneration === "number") return `$${pricing.perGeneration.toFixed(3)} per generation`;
      return "Pricing varies by provider";
    case "audio":
      if (typeof pricing.perMinute === "number") return `$${pricing.perMinute.toFixed(3)} per minute`;
      if (typeof pricing.perCharacter === "number") return `$${(pricing.perCharacter * 1000).toFixed(3)} per 1K chars`;
      if (typeof pricing.perSecond === "number") return `$${pricing.perSecond.toFixed(4)} per second`;
      return "Pricing varies by provider";
    default:
      return "Pricing unavailable";
  }
}

function estimateCost(model: ModelEntry): string {
  const pricing = model.pricing;

  switch (pricing.type) {
    case "text": {
      const monthly = (pricing.promptPer1mTokens * 3 + pricing.completionPer1mTokens * 1.5) / 100;
      return `~$${monthly.toFixed(2)}/mo for a light text workload`;
    }
    case "image":
      return "~$5-25/mo depending on image volume and resolution";
    case "video":
      return "~$30-100/mo depending on duration and clip count";
    case "audio":
      return "~$5-40/mo depending on minutes generated/transcribed";
    case "embedding":
      return "~$1-15/mo depending on indexed corpus size";
    default:
      return "Cost depends on workload";
  }
}

function summarizeTask(task: string): string {
  const trimmed = task.trim();
  if (trimmed.length <= 90) {
    return trimmed;
  }

  return `${trimmed.slice(0, 87)}...`;
}

function inferKeyRequirements(task: string, modality: Modality): string[] {
  const requirements = new Set<string>();

  if (/fast|quick|realtime|real-time/.test(task.toLowerCase())) {
    requirements.add("fast response time");
  }
  if (/cheap|budget|low cost/.test(task.toLowerCase())) {
    requirements.add("low inference cost");
  }

  if (modality === "text" || modality === "vision") {
    requirements.add("strong reasoning");
    requirements.add("instruction following");
  }

  if (modality === "image" || modality === "video") {
    requirements.add("high visual quality");
  }

  if (requirements.size === 0) {
    requirements.add("reliable output quality");
    requirements.add("cost-effectiveness");
  }

  return [...requirements].slice(0, 4);
}

function describeCostFactors(modality: Modality): string {
  switch (modality) {
    case "text":
    case "vision":
      return "Token volume (input and output) drives total cost.";
    case "image":
      return "Image count and resolution are the dominant cost drivers.";
    case "video":
      return "Video length and number of generations drive cost.";
    case "audio_tts":
    case "audio_stt":
    case "audio_generation":
      return "Audio duration and generation count drive cost.";
    case "embedding":
      return "Total indexed token count is the main cost factor.";
    case "multimodal":
      return "Mixed token and media usage determines total cost.";
    default:
      return "Workload volume drives cost.";
  }
}

function uniquePicks(candidates: ModelEntry[]): ModelEntry[] {
  const seen = new Set<string>();
  const unique: ModelEntry[] = [];

  for (const candidate of candidates) {
    if (seen.has(candidate.id)) {
      continue;
    }

    unique.push(candidate);
    seen.add(candidate.id);
  }

  return unique;
}

function isModelEntry(value: ModelEntry | undefined): value is ModelEntry {
  return Boolean(value);
}

function positiveOrInfinity(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  return value;
}
