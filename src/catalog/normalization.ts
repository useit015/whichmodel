import type {
  FalModel,
  ModelEntry,
  Modality,
  OpenRouterModel,
  ReplicateModel,
} from "../types.js";

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
const IMAGE_KEYWORDS = ["image", "photo", "picture", "mask", "jpg", "jpeg", "png", "webp"];
const VIDEO_KEYWORDS = ["video", "clip", "animation", "movie", "mp4", "webm", "gif"];
const AUDIO_KEYWORDS = ["audio", "speech", "voice", "music", "wav", "mp3", "flac", "transcript"];
const EMBEDDING_KEYWORDS = ["embedding", "embeddings", "vector", "vectors"];
const TEXT_HINT_KEYWORDS = ["text", "prompt", "instruction", "caption", "query", "message"];

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

  if (promptPerToken < 0 || completionPerToken < 0) {
    return null;
  }

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
  const modality = classifyFalCategory(raw.category);
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

export function normalizeReplicateModel(raw: ReplicateModel): ModelEntry | null {
  const modelKey = toReplicateModelKey(raw);
  if (!modelKey) {
    return null;
  }

  const openApiSchema = extractReplicateOpenApiSchema(raw);
  let inputModalities = detectReplicateInputModalities(openApiSchema);
  let outputModalities = detectReplicateOutputModalities(openApiSchema, raw);
  let modality = classifyModality(inputModalities, outputModalities);

  if (modality === "text") {
    const inferred = inferReplicateModalityFromMetadata(raw);
    if (inferred !== "text") {
      const fallback = fallbackModalitiesForModality(inferred);
      inputModalities = fallback.inputModalities;
      outputModalities = fallback.outputModalities;
      modality = inferred;
    }
  }

  const pricing = normalizeReplicatePricing(raw, modality);
  if (!pricing) {
    return null;
  }

  return {
    id: `replicate::${modelKey}`,
    source: "replicate",
    name: raw.name,
    modality,
    inputModalities,
    outputModalities,
    pricing,
    provider: extractProvider(modelKey),
    family: extractFamily(modelKey, raw.name),
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

function normalizeReplicatePricing(
  raw: ReplicateModel,
  modality: Modality
): ModelEntry["pricing"] | null {
  const pricingSources = [raw.pricing, raw.latest_version?.pricing];

  if (modality === "text") {
    const promptEntry =
      extractFirstNumericByKey(pricingSources, [
        "prompt_per_1m",
        "input_per_1m",
        "prompt",
        "input",
      ]) ?? extractFirstNumericByKey(pricingSources, ["per_token", "token"]);
    const completionEntry =
      extractFirstNumericByKey(pricingSources, [
        "completion_per_1m",
        "output_per_1m",
        "completion",
        "output",
      ]) ??
      extractFirstNumericByKey(pricingSources, ["per_token", "token"]) ??
      promptEntry;
    const promptPer1mTokens = normalizeTokenPricePer1m(promptEntry);
    const completionPer1mTokens = normalizeTokenPricePer1m(completionEntry);
    if (
      typeof promptPer1mTokens !== "number" ||
      typeof completionPer1mTokens !== "number"
    ) {
      return null;
    }

    return {
      type: "text",
      promptPer1mTokens,
      completionPer1mTokens,
    };
  }

  if (modality === "embedding") {
    const embeddingEntry =
      extractFirstNumericByKey(pricingSources, ["embedding_per_1m", "per_1m"]) ??
      extractFirstNumericByKey(pricingSources, ["embedding", "per_token", "token"]);
    const per1mTokens = normalizeTokenPricePer1m(embeddingEntry);
    if (typeof per1mTokens !== "number") {
      return null;
    }

    return {
      type: "embedding",
      per1mTokens,
    };
  }

  if (modality === "image") {
    const perImage = normalizeMoneyAmount(
      extractFirstNumericByKey(pricingSources, [
        "per_image",
        "image",
        "per_generation",
        "generation",
        "per_run",
        "run",
        "predict",
      ])
    );

    return perImage !== undefined ? { type: "image", perImage } : { type: "image" };
  }

  if (modality === "video") {
    const perSecond = normalizeMoneyAmount(
      extractFirstNumericByKey(pricingSources, ["per_second", "second"])
    );
    const perGeneration = normalizeMoneyAmount(
      extractFirstNumericByKey(pricingSources, [
        "per_generation",
        "generation",
        "per_run",
        "run",
        "predict",
      ])
    );

    if (perSecond !== undefined) {
      return { type: "video", perSecond };
    }

    return perGeneration !== undefined
      ? { type: "video", perGeneration }
      : { type: "video" };
  }

  if (
    modality === "audio_tts" ||
    modality === "audio_stt" ||
    modality === "audio_generation"
  ) {
    const perMinute = normalizeMoneyAmount(
      extractFirstNumericByKey(pricingSources, ["per_minute", "minute"])
    );
    const perCharacter = normalizeMoneyAmount(
      extractFirstNumericByKey(pricingSources, ["per_character", "character"])
    );
    const perSecond = normalizeMoneyAmount(
      extractFirstNumericByKey(pricingSources, ["per_second", "second"])
    );

    if (perMinute !== undefined) {
      return { type: "audio", perMinute };
    }

    if (perCharacter !== undefined) {
      return { type: "audio", perCharacter };
    }

    return perSecond !== undefined ? { type: "audio", perSecond } : { type: "audio" };
  }

  return null;
}

function toReplicateModelKey(raw: ReplicateModel): string | null {
  const owner = typeof raw.owner === "string" ? raw.owner.trim() : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (owner && name) {
    return `${owner}/${name}`;
  }

  if (typeof raw.url === "string" && raw.url.trim()) {
    try {
      const parsed = new URL(raw.url);
      const path = parsed.pathname.replace(/^\/+/, "");
      return path || null;
    } catch {
      return raw.url.replace(/^https?:\/\/[^/]+\//, "") || null;
    }
  }

  return null;
}

function extractReplicateOpenApiSchema(
  raw: ReplicateModel
): Record<string, unknown> | null {
  const candidate = raw.latest_version?.openapi_schema;
  return isRecord(candidate) ? candidate : null;
}

function detectReplicateInputModalities(openApiSchema: Record<string, unknown> | null): string[] {
  const inputSchema = extractReplicateSchemaNode(openApiSchema, "Input");
  if (!inputSchema) {
    return ["text"];
  }

  const text = collectSchemaText(inputSchema);
  const modalities = new Set<string>();
  if (hasAnyKeyword(text, IMAGE_KEYWORDS)) {
    modalities.add("image");
  }
  if (hasAnyKeyword(text, VIDEO_KEYWORDS)) {
    modalities.add("video");
  }
  if (hasAnyKeyword(text, AUDIO_KEYWORDS)) {
    modalities.add("audio");
  }
  if (hasAnyKeyword(text, TEXT_HINT_KEYWORDS) || modalities.size === 0) {
    modalities.add("text");
  }

  return Array.from(modalities);
}

function detectReplicateOutputModalities(
  openApiSchema: Record<string, unknown> | null,
  raw: ReplicateModel
): string[] {
  const outputSchema = extractReplicateSchemaNode(openApiSchema, "Output");
  if (!outputSchema) {
    return fallbackModalitiesForModality(inferReplicateModalityFromMetadata(raw)).outputModalities;
  }

  const text = collectSchemaText(outputSchema);
  const outputs = new Set<string>();

  if (hasAnyKeyword(text, EMBEDDING_KEYWORDS) || isNumericVectorArray(outputSchema)) {
    outputs.add("embedding");
  }
  if (hasAnyKeyword(text, IMAGE_KEYWORDS)) {
    outputs.add("image");
  }
  if (hasAnyKeyword(text, VIDEO_KEYWORDS)) {
    outputs.add("video");
  }
  if (hasAnyKeyword(text, AUDIO_KEYWORDS)) {
    outputs.add("audio");
  }

  if (outputs.size === 0 && hasUriLikeFormat(outputSchema)) {
    const inferred = inferReplicateModalityFromMetadata(raw);
    if (inferred === "video") {
      outputs.add("video");
    } else if (
      inferred === "audio_stt" ||
      inferred === "audio_tts" ||
      inferred === "audio_generation"
    ) {
      outputs.add(inferred === "audio_stt" ? "text" : "audio");
    } else if (inferred === "embedding") {
      outputs.add("embedding");
    } else {
      outputs.add("image");
    }
  }

  if (outputs.size === 0) {
    outputs.add("text");
  }

  return Array.from(outputs);
}

function inferReplicateModalityFromMetadata(raw: ReplicateModel): Modality {
  const combined = `${raw.owner ?? ""}/${raw.name ?? ""} ${raw.description ?? ""}`.toLowerCase();

  if (hasAnyKeyword(combined, EMBEDDING_KEYWORDS)) {
    return "embedding";
  }
  if (/(transcrib|speech[\s-]?to[\s-]?text|stt|whisper|caption)/.test(combined)) {
    return "audio_stt";
  }
  if (/(text[\s-]?to[\s-]?speech|tts|voiceover|voice synth|speech synth)/.test(combined)) {
    return "audio_tts";
  }
  if (/(music|sound effect|audio generation|text[\s-]?to[\s-]?audio)/.test(combined)) {
    return "audio_generation";
  }
  if (/(vision|ocr|image understanding|analy[sz]e image|vqa)/.test(combined)) {
    return "vision";
  }
  if (hasAnyKeyword(combined, VIDEO_KEYWORDS)) {
    return "video";
  }
  if (hasAnyKeyword(combined, IMAGE_KEYWORDS)) {
    return "image";
  }

  return "text";
}

function fallbackModalitiesForModality(modality: Modality): {
  inputModalities: string[];
  outputModalities: string[];
} {
  switch (modality) {
    case "image":
      return { inputModalities: ["text"], outputModalities: ["image"] };
    case "video":
      return { inputModalities: ["text"], outputModalities: ["video"] };
    case "audio_stt":
      return { inputModalities: ["audio"], outputModalities: ["text"] };
    case "audio_tts":
    case "audio_generation":
      return { inputModalities: ["text"], outputModalities: ["audio"] };
    case "vision":
      return { inputModalities: ["image"], outputModalities: ["text"] };
    case "embedding":
      return { inputModalities: ["text"], outputModalities: ["embedding"] };
    case "multimodal":
      return { inputModalities: ["text", "image"], outputModalities: ["text", "image"] };
    case "text":
    default:
      return { inputModalities: ["text"], outputModalities: ["text"] };
  }
}

function extractReplicateSchemaNode(
  openApiSchema: Record<string, unknown> | null,
  schemaName: "Input" | "Output"
): Record<string, unknown> | null {
  if (!openApiSchema) {
    return null;
  }

  const components = openApiSchema.components;
  if (!isRecord(components)) {
    return null;
  }

  const schemas = components.schemas;
  if (!isRecord(schemas)) {
    return null;
  }

  const node = schemas[schemaName];
  return isRecord(node) ? node : null;
}

function collectSchemaText(value: unknown): string {
  try {
    return JSON.stringify(value).toLowerCase();
  } catch {
    return "";
  }
}

function hasAnyKeyword(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

function hasUriLikeFormat(schema: Record<string, unknown>): boolean {
  const text = collectSchemaText(schema);
  return text.includes("\"format\":\"uri\"") || text.includes("\"format\":\"url\"");
}

function isNumericVectorArray(schema: Record<string, unknown>): boolean {
  const type = typeof schema.type === "string" ? schema.type.toLowerCase() : "";
  if (type !== "array") {
    return false;
  }

  const items = schema.items;
  if (!isRecord(items)) {
    return false;
  }

  const itemType = typeof items.type === "string" ? items.type.toLowerCase() : "";
  return itemType === "number" || itemType === "integer";
}

interface NumericEntry {
  key: string;
  value: number;
}

function extractFirstNumericByKey(
  sources: Array<unknown>,
  keyHints: string[]
): NumericEntry | undefined {
  const normalizedHints = keyHints.map((hint) => hint.toLowerCase());
  const allEntries = sources.flatMap((source) => collectNumericEntries(source));

  return allEntries.find((entry) =>
    normalizedHints.some((hint) => entry.key.includes(hint))
  );
}

function collectNumericEntries(
  value: unknown,
  parentKey = "",
  depth = 0
): NumericEntry[] {
  if (depth > 5 || value === null || value === undefined) {
    return [];
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return [{ key: parentKey.toLowerCase(), value }];
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      const parsed = Number.parseFloat(trimmed);
      if (Number.isFinite(parsed)) {
        return [{ key: parentKey.toLowerCase(), value: parsed }];
      }
    }
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectNumericEntries(item, `${parentKey}[${index}]`, depth + 1)
    );
  }

  if (!isRecord(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, nested]) =>
    collectNumericEntries(
      nested,
      parentKey ? `${parentKey}.${key}` : key,
      depth + 1
    )
  );
}

function normalizeTokenPricePer1m(entry: NumericEntry | undefined): number | undefined {
  if (!entry || !Number.isFinite(entry.value) || entry.value <= 0) {
    return undefined;
  }

  const key = entry.key;
  let value = entry.value;
  if (key.includes("cent")) {
    value = value / 100;
  }

  if (key.includes("1m")) {
    return round(value, 6);
  }
  if (key.includes("1k")) {
    return round(value * 1000, 6);
  }
  if (key.includes("token")) {
    return round(value * 1_000_000, 6);
  }
  if (value < 0.01) {
    return round(value * 1_000_000, 6);
  }

  return round(value, 6);
}

function normalizeMoneyAmount(entry: NumericEntry | undefined): number | undefined {
  if (!entry || !Number.isFinite(entry.value) || entry.value <= 0) {
    return undefined;
  }

  const cents = entry.key.includes("cent");
  return round(cents ? entry.value / 100 : entry.value, 6);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function classifyFalCategory(category: string): Modality | null {
  const normalized = category.trim().toLowerCase();

  if (normalized.includes("speech-to-text") || normalized.includes("audio-to-text")) {
    return "audio_stt";
  }

  if (normalized.includes("text-to-speech")) {
    return "audio_tts";
  }

  if (
    normalized.includes("text-to-audio") ||
    normalized.includes("audio-to-audio") ||
    normalized.includes("speech-to-speech") ||
    normalized.includes("video-to-audio") ||
    normalized.includes("audio-generation") ||
    normalized.includes("music")
  ) {
    return "audio_generation";
  }

  if (
    normalized.includes("image-generation") ||
    normalized.includes("text-to-image") ||
    normalized.includes("image-to-image")
  ) {
    return "image";
  }

  if (
    normalized.includes("image-to-video") ||
    normalized.includes("text-to-video") ||
    normalized.includes("video-generation") ||
    normalized.includes("video-to-video")
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

  if (
    modality === "audio_tts" ||
    modality === "audio_stt" ||
    modality === "audio_generation"
  ) {
    if (priceType === "per_minute") {
      return {
        type: "audio",
        perMinute: round(amount, 6),
      };
    }

    if (priceType === "per_character") {
      return {
        type: "audio",
        perCharacter: round(amount, 6),
      };
    }

    return {
      type: "audio",
      perSecond: round(amount, 6),
    };
  }

  return null;
}

function falInputModalities(category: string): string[] {
  const normalized = category.trim().toLowerCase();
  if (normalized.includes("image-to-video")) {
    return ["image"];
  }

  if (normalized.startsWith("image-to-")) {
    return ["image"];
  }

  if (normalized.startsWith("video-to-")) {
    return ["video"];
  }

  if (normalized.startsWith("audio-to-") || normalized.startsWith("speech-to-")) {
    return ["audio"];
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

  if (modality === "audio_stt") {
    return ["text"];
  }

  if (
    modality === "audio_tts" ||
    modality === "audio_generation"
  ) {
    return ["audio"];
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
