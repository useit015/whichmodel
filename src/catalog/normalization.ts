import type { FalModel, ModelEntry, Modality, OpenRouterModel } from "../types.js";

const FAMILY_PATTERNS: Array<[RegExp, string]> = [
  [/claude/, "claude"],
  [/gpt/, "gpt"],
  [/gemini/, "gemini"],
  [/deepseek/, "deepseek"],
  [/llama/, "llama"],
  [/qwen/, "qwen"],
  [/mistral|mixtral/, "mistral"],
  [/flux/, "flux"],
  [/dall-e|dalle/, "dalle"],
  [/stable-diffusion|sdxl/, "stable-diffusion"],
  [/whisper/, "whisper"],
  [/midjourney/, "midjourney"],
  [/runway/, "runway"],
  [/elevenlabs|eleven-/, "elevenlabs"],
  [/kling/, "kling"],
  [/ideogram/, "ideogram"],
  [/recraft/, "recraft"],
];

const DEFAULT_MODALITIES = ["text"];

export function classifyModality(input: string[], output: string[]): Modality {
  const normalizedInput = normalizeModalities(input);
  const normalizedOutput = normalizeModalities(output);
  const allModalities = new Set([...normalizedInput, ...normalizedOutput]);

  // If both sides have multiple modalities, treat it as truly multimodal.
  if (normalizedInput.length > 1 && normalizedOutput.length > 1) {
    return "multimodal";
  }

  if (normalizedOutput.includes("image")) return "image";
  if (normalizedOutput.includes("video")) return "video";

  if (
    normalizedOutput.includes("music") ||
    normalizedOutput.includes("sound")
  ) {
    return "audio_generation";
  }

  if (normalizedOutput.includes("audio")) {
    return normalizedInput.includes("audio") ? "audio_stt" : "audio_tts";
  }

  if (normalizedOutput.includes("embedding") || normalizedOutput.includes("vector")) {
    return "embedding";
  }

  // Treat as STT only for pure audio->text pipelines, not broad multimodal models.
  if (
    normalizedInput.includes("audio") &&
    normalizedInput.length === 1 &&
    normalizedOutput.includes("text") &&
    normalizedOutput.length === 1
  ) {
    return "audio_stt";
  }

  if (normalizedInput.includes("image") && normalizedOutput.includes("text")) {
    return "vision";
  }

  if (allModalities.size > 2) {
    return "multimodal";
  }

  return "text";
}

export function extractFamily(id: string, name?: string): string {
  const combined = `${id} ${name ?? ""}`.toLowerCase();

  for (const [pattern, family] of FAMILY_PATTERNS) {
    if (pattern.test(combined)) {
      return family;
    }
  }

  return "other";
}

export function extractProvider(id: string): string {
  const withoutSourcePrefix = id.replace(/^[^:]+::/, "");
  const provider = withoutSourcePrefix.split("/")[0];
  return provider && provider.length > 0 ? provider : "unknown";
}

export function normalizeOpenRouterModel(raw: OpenRouterModel): ModelEntry | null {
  const promptPerToken = parsePrice(raw.pricing?.prompt);
  const completionPerToken = parsePrice(raw.pricing?.completion);

  if (promptPerToken === 0 && completionPerToken === 0) {
    return null;
  }

  const inputModalities = normalizeModalities(raw.architecture?.input_modalities);
  const outputModalities = normalizeModalities(
    raw.architecture?.output_modalities
  );

  return {
    id: `openrouter::${raw.id}`,
    source: "openrouter",
    name: raw.name,
    modality: classifyModality(inputModalities, outputModalities),
    inputModalities,
    outputModalities,
    pricing: {
      type: "text",
      promptPer1mTokens: round(promptPerToken * 1_000_000, 6),
      completionPer1mTokens: round(completionPerToken * 1_000_000, 6),
    },
    contextLength: toPositiveNumber(raw.context_length),
    provider: extractProvider(raw.id),
    family: extractFamily(raw.id, raw.name),
  };
}

export function normalizeFalModel(raw: FalModel): ModelEntry | null {
  const modality = mapFalCategoryToModality(raw.category);
  if (!modality) {
    return null;
  }

  const pricing = normalizeFalPricing(raw, modality);
  if (!pricing) {
    return null;
  }

  const inputModalities = falInputModalities(raw.category);
  const outputModalities = falOutputModalities(modality);

  return {
    id: `fal::${raw.id}`,
    source: "fal",
    name: raw.name,
    modality,
    inputModalities,
    outputModalities,
    pricing,
    provider: extractProvider(raw.id),
    family: extractFamily(raw.id, raw.name),
  };
}

function normalizeModalities(values?: string[]): string[] {
  const source = values && values.length > 0 ? values : DEFAULT_MODALITIES;
  const normalized = source
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);

  if (normalized.length === 0) {
    return [...DEFAULT_MODALITIES];
  }

  return Array.from(new Set(normalized));
}

function mapFalCategoryToModality(category: string): Modality | null {
  const normalized = category.trim().toLowerCase();

  if (normalized.includes("image-generation") || normalized.includes("text-to-image")) {
    return "image";
  }

  if (
    normalized.includes("image-to-video") ||
    normalized.includes("text-to-video") ||
    normalized.includes("video-generation")
  ) {
    return "video";
  }

  return null;
}

function normalizeFalPricing(raw: FalModel, modality: Modality): ModelEntry["pricing"] | null {
  const amount = raw.pricing?.amount;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  const priceType = raw.pricing?.type?.toLowerCase() ?? "";

  if (modality === "image") {
    if (priceType === "per_image" || priceType === "per_generation") {
      return {
        type: "image",
        perImage: round(amount, 6),
      };
    }

    return {
      type: "image",
      perImage: round(amount, 6),
    };
  }

  if (modality === "video") {
    if (priceType === "per_second") {
      return {
        type: "video",
        perSecond: round(amount, 6),
      };
    }

    return {
      type: "video",
      perGeneration: round(amount, 6),
    };
  }

  return null;
}

function falInputModalities(category: string): string[] {
  const normalized = category.trim().toLowerCase();
  if (normalized.includes("image-to-video")) {
    return ["image"];
  }

  return ["text"];
}

function falOutputModalities(modality: Modality): string[] {
  if (modality === "image") {
    return ["image"];
  }

  if (modality === "video") {
    return ["video"];
  }

  return ["text"];
}

function parsePrice(raw: string | undefined): number {
  if (!raw) return 0;

  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toPositiveNumber(value: number | null | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return undefined;
  }

  return value;
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
