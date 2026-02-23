import type { Constraints, CompressedModel } from "../types.js";

const SYSTEM_PROMPT = `You are an expert AI model selector with deep knowledge of models across ALL modalities - text, image generation, video generation, audio/speech, vision/understanding, embeddings, and multimodal.

## Your Job

Given a task description and a catalog of available models, you must:

1. Detect the correct modality for the task
2. Recommend exactly 3 models in that modality:
   - cheapest: Cheapest model that can do the job acceptably
   - balanced: Best quality-to-price ratio for this specific task
   - best: Highest quality regardless of cost

## Modality Detection Rules

Be careful with ambiguous tasks:
- "write video scripts" -> TEXT
- "generate product photos" -> IMAGE
- "create a 15-second ad from product images" -> VIDEO
- "transcribe my podcast" -> AUDIO_STT
- "add voiceover to my blog" -> AUDIO_TTS
- "describe what's in these screenshots" -> VISION
- "find similar documents" -> EMBEDDING
- "build a chatbot" -> TEXT
- "generate background music for a video" -> AUDIO_GENERATION

## Output Format

Respond with ONLY valid JSON using this structure:
{
  "taskAnalysis": {
    "summary": "one-line description of what the task demands",
    "detectedModality": "text | image | video | audio_tts | audio_stt | audio_generation | vision | embedding | multimodal",
    "modalityReasoning": "why this modality was chosen",
    "keyRequirements": ["req1", "req2", "req3"],
    "costFactors": "what drives cost for this specific task"
  },
  "recommendations": {
    "cheapest": {
      "id": "source::provider/model-name",
      "reason": "2-3 sentence justification specific to this task",
      "pricingSummary": "human-readable pricing",
      "estimatedCost": "$X for Y units"
    },
    "balanced": { ... },
    "best": { ... }
  },
  "alternativesInOtherModalities": null or "brief note if another modality could work"
}

IMPORTANT:
- Only recommend models that appear in the provided catalog
- Use the exact model ID from the catalog (including source:: prefix)
- Always respond with valid JSON only, no markdown formatting`;

export function buildSystemPrompt(): string {
  return SYSTEM_PROMPT;
}

export function buildUserPrompt(
  task: string,
  groupedModels: Record<string, CompressedModel[]>,
  constraints?: Constraints
): string {
  const constraintLines: string[] = [];

  if (typeof constraints?.maxPrice === "number") {
    constraintLines.push(`Max price: $${constraints.maxPrice} per unit`);
  }
  if (typeof constraints?.minContext === "number") {
    constraintLines.push(`Min context length: ${constraints.minContext} tokens`);
  }
  if (constraints?.minResolution) {
    constraintLines.push(`Min resolution: ${constraints.minResolution}`);
  }
  if (constraints?.modality) {
    constraintLines.push(`Force modality: ${constraints.modality}`);
  }
  if (constraints?.exclude && constraints.exclude.length > 0) {
    constraintLines.push(`Excluded models: ${constraints.exclude.join(", ")}`);
  }

  const constraintsText = constraintLines.length > 0 ? constraintLines.join("\n") : "None";

  const sections = Object.entries(groupedModels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([modality, models]) => {
      return `### ${modality.toUpperCase()} Models (${models.length})\n\n\`\`\`json\n${JSON.stringify(
        models,
        null,
        2
      )}\n\`\`\``;
    })
    .join("\n\n");

  return `## Task Description\n${task}\n\n## Constraints\n${constraintsText}\n\n## Available Models (grouped by modality)\n\n${sections}`;
}
