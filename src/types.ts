/**
 * Core type definitions for whichmodel
 *
 * These types define the data structures used throughout the application
 * for model catalogs, recommendations, configuration, and CLI options.
 *
 * @version 0.1.0
 */

// =============================================================================
// MODALITY TYPES
// =============================================================================

/**
 * All supported AI modalities
 *
 * - text: Text generation (LLMs)
 * - image: Image generation
 * - video: Video generation
 * - audio_tts: Text-to-speech
 * - audio_stt: Speech-to-text (transcription)
 * - audio_generation: Music/sound generation
 * - vision: Image understanding/analysis
 * - embedding: Text embeddings for search/RAG
 * - multimodal: Models that handle multiple modalities
 */
export type Modality =
  | "text"
  | "image"
  | "video"
  | "audio_tts"
  | "audio_stt"
  | "audio_generation"
  | "vision"
  | "embedding"
  | "multimodal";

// =============================================================================
// PRICING TYPES (Per Modality)
// =============================================================================

/**
 * Pricing for text generation models
 * Prices are per 1 million tokens
 */
export interface TextPricing {
  type: "text";
  /** Price per 1M prompt/input tokens in USD */
  promptPer1mTokens: number;
  /** Price per 1M completion/output tokens in USD */
  completionPer1mTokens: number;
}

/**
 * Pricing for image generation models
 * Different providers use different pricing units
 */
export interface ImagePricing {
  type: "image";
  /** Price per generated image in USD (optional - some providers use per-megapixel) */
  perImage?: number;
  /** Price per megapixel in USD (optional) */
  perMegapixel?: number;
  /** Price per diffusion step in USD (optional - for SD-based models) */
  perStep?: number;
}

/**
 * Pricing for video generation models
 */
export interface VideoPricing {
  type: "video";
  /** Price per second of video in USD */
  perSecond?: number;
  /** Price per generation (regardless of length) in USD */
  perGeneration?: number;
}

/**
 * Pricing for audio models (TTS, STT, generation)
 */
export interface AudioPricing {
  type: "audio";
  /** Price per minute of audio in USD */
  perMinute?: number;
  /** Price per character in USD (for TTS) */
  perCharacter?: number;
  /** Price per second of audio in USD */
  perSecond?: number;
}

/**
 * Pricing for embedding models
 */
export interface EmbeddingPricing {
  type: "embedding";
  /** Price per 1M tokens in USD */
  per1mTokens: number;
}

/**
 * Union type for all pricing structures
 */
export type Pricing =
  | TextPricing
  | ImagePricing
  | VideoPricing
  | AudioPricing
  | EmbeddingPricing;

// =============================================================================
// MODEL CATALOG TYPES
// =============================================================================

/**
 * A model entry in the catalog
 *
 * This is the unified format that all catalog sources (OpenRouter, fal.ai, Replicate)
 * are normalized to.
 */
export interface ModelEntry {
  /** Unique identifier with source prefix (e.g., "openrouter::anthropic/claude-sonnet-4") */
  id: string;

  /** Source catalog (e.g., "openrouter", "fal", "replicate") */
  source: string;

  /** Human-readable model name (e.g., "Claude Sonnet 4") */
  name: string;

  /** Primary modality of this model */
  modality: Modality;

  /** Input modalities supported (e.g., ["text"], ["text", "image"]) */
  inputModalities: string[];

  /** Output modalities supported (e.g., ["text"], ["image"]) */
  outputModalities: string[];

  /** Pricing information (structure varies by modality) */
  pricing: Pricing;

  /** Maximum context length in tokens (text/vision models only) */
  contextLength?: number;

  /** Maximum output resolution (image/video models, e.g., "1024x1024") */
  maxResolution?: string;

  /** Maximum duration in seconds (video/audio models) */
  maxDuration?: number;

  /** Whether the model supports streaming output */
  supportsStreaming?: boolean;

  /** Provider name (e.g., "anthropic", "openai", "stability") */
  provider: string;

  /** Model family (e.g., "claude", "gpt", "flux", "llama") */
  family: string;
}

/**
 * Compressed model entry for LLM context
 *
 * Stripped-down version of ModelEntry to minimize token usage when
 * sending the catalog to the recommender LLM.
 */
export interface CompressedModel {
  /** Full model ID */
  id: string;

  /** Human-readable name */
  name: string;

  /** Primary modality */
  modality: string;

  /** Flattened pricing (key-value pairs only, no "type" field) */
  pricing: Record<string, number>;

  /** Context length if applicable */
  contextLength?: number;

  /** Max resolution if applicable */
  maxResolution?: string;

  /** Max duration if applicable */
  maxDuration?: number;
}

// =============================================================================
// RECOMMENDATION TYPES
// =============================================================================

/**
 * A single model recommendation
 */
export interface ModelPick {
  /** Model ID (e.g., "openrouter::anthropic/claude-sonnet-4") */
  id: string;

  /** Human-readable justification for this recommendation */
  reason: string;

  /** Human-readable pricing summary */
  pricingSummary: string;

  /** Estimated cost for a reasonable workload */
  estimatedCost: string;
}

/**
 * Task analysis performed by the recommender LLM
 */
export interface TaskAnalysis {
  /** One-line summary of what the task demands */
  summary: string;

  /** Detected modality for this task */
  detectedModality: Modality;

  /** Explanation of why this modality was chosen */
  modalityReasoning: string;

  /** Key requirements extracted from the task */
  keyRequirements: string[];

  /** Description of what drives cost for this specific task */
  costFactors: string;
}

/**
 * Complete recommendation response
 */
export interface Recommendation {
  /** Analysis of the task */
  taskAnalysis: TaskAnalysis;

  /** Three-tier recommendations */
  recommendations: {
    /** Cheapest viable option */
    cheapest: ModelPick;
    /** Best quality-to-price ratio */
    balanced: ModelPick;
    /** Highest quality regardless of cost */
    best: ModelPick;
  };

  /** Note about alternative approaches in other modalities (if applicable) */
  alternativesInOtherModalities: string | null;
}

/**
 * Metadata included in JSON output
 */
export interface RecommendationMeta {
  /** Model used for generating the recommendation */
  recommenderModel: string;

  /** Cost of this recommendation call in USD */
  recommendationCostUsd: number;

  /** Number of prompt tokens used */
  promptTokens?: number;

  /** Number of completion tokens used */
  completionTokens?: number;

  /** Recommender runtime in milliseconds */
  recommendationLatencyMs?: number;

  /** Catalog sources that were queried */
  catalogSources: string[];

  /** Total models in the catalog */
  catalogTotalModels: number;

  /** Models in the detected modality */
  catalogModelsInModality: number;

  /** ISO timestamp of the recommendation */
  timestamp: string;

  /** Tool version */
  version: string;
}

/**
 * Full JSON output structure
 */
export interface JSONOutput {
  /** Original task description */
  task: string;

  /** Task analysis */
  taskAnalysis: TaskAnalysis;

  /** Recommendations */
  recommendations: {
    cheapest: ModelPick;
    balanced: ModelPick;
    best: ModelPick;
  };

  /** Alternative approaches note */
  alternativesInOtherModalities: string | null;

  /** Metadata about the recommendation */
  meta: RecommendationMeta;
}

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

/**
 * Application configuration
 */
export interface Config {
  /** OpenRouter API key (required for recommendation/comparison LLM calls) */
  apiKey: string;

  /** Model to use for recommendations */
  recommenderModel: string;

  /** Cache TTL in seconds */
  cacheTtl: number;

  /** fal.ai API key (optional, enables image/video catalog) */
  falApiKey?: string;

  /** Replicate API token (optional, enables broader catalog) */
  replicateApiToken?: string;

  /** ElevenLabs API key (optional, enables audio catalog) */
  elevenLabsApiKey?: string;

  /** Together AI API key (optional) */
  togetherApiKey?: string;

  /** Freshness TTL for Replicate page-pricing entries in seconds */
  replicatePriceTtlSeconds?: number;

  /** Maximum allowed staleness window for Replicate page-pricing entries in seconds */
  replicatePriceMaxStaleSeconds?: number;

  /** Max number of Replicate page-pricing lookups allowed per run */
  replicatePriceFetchBudget?: number;

  /** Max concurrent Replicate page-pricing lookups per run */
  replicatePriceConcurrency?: number;
}

/**
 * Constraints for filtering models
 */
export interface Constraints {
  /** Maximum price per unit in USD */
  maxPrice?: number;

  /** Minimum context length in tokens */
  minContext?: number;

  /** Minimum resolution (e.g., "1024x1024") */
  minResolution?: string;

  /** Force a specific modality */
  modality?: Modality;

  /** Model IDs to exclude (supports wildcards like "openai/*") */
  exclude?: string[];

  /** Catalog sources to use */
  sources?: string[];
}

// =============================================================================
// CLI TYPES
// =============================================================================

/**
 * Parsed CLI options
 */
export interface CLIOptions {
  /** Output as JSON instead of formatted terminal output */
  json: boolean;

  /** Force a specific modality */
  modality?: Modality;

  /** Override the recommender model */
  model?: string;

  /** Maximum price per unit */
  maxPrice?: number;

  /** Minimum context length */
  minContext?: number;

  /** Minimum resolution */
  minResolution?: string;

  /** Model IDs to exclude */
  exclude?: string;

  /** Catalog sources to use */
  sources?: string;

  /** Workload description for cost estimation */
  estimate?: string;

  /** Show detailed/verbose output */
  verbose: boolean;

  /** Disable colored output */
  noColor: boolean;
}

// =============================================================================
// CATALOG SOURCE TYPES
// =============================================================================

/**
 * Interface for a catalog source adapter
 *
 * Each catalog source (OpenRouter, fal.ai, Replicate) implements this interface
 * to fetch and normalize models.
 */
export interface CatalogSource {
  /** Unique identifier for this source (e.g., "openrouter", "fal") */
  readonly sourceId: string;

  /**
   * Fetch models from this source
   * @returns Array of normalized model entries
   */
  fetch(): Promise<ModelEntry[]>;
}

/**
 * Result of validating a recommendation
 */
export interface ValidationResult {
  /** Whether all recommended model IDs are valid */
  valid: boolean;

  /** List of invalid model IDs (if any) */
  invalidIds: string[];
}

// =============================================================================
// ERROR TYPES
// =============================================================================

/**
 * Error codes used in the application
 */
export enum ExitCode {
  SUCCESS = 0,
  GENERAL_ERROR = 1,
  INVALID_ARGUMENTS = 2,
  NO_API_KEY = 3,
  NO_MODELS_FOUND = 4,
  LLM_FAILED = 5,
  NETWORK_ERROR = 6,
}

/**
 * Custom error class for whichmodel errors
 */
export class WhichModelError extends Error {
  constructor(
    message: string,
    public readonly exitCode: ExitCode,
    public readonly recoveryHint?: string
  ) {
    super(message);
    this.name = "WhichModelError";
  }
}

// =============================================================================
// CACHE TYPES
// =============================================================================

/**
 * Cache entry structure
 */
export interface CacheEntry<T> {
  /** Cached data */
  data: T;

  /** Timestamp when cached (Unix epoch in seconds) */
  timestamp: number;

  /** TTL in seconds */
  ttl: number;

  /** Source that generated this data */
  source: string;
}

/**
 * Cache statistics for a single source
 */
export interface CacheSourceStats {
  /** Source name (e.g., "openrouter", "fal") */
  name: string;

  /** Timestamp when cached (Unix epoch in seconds) */
  timestamp: number;

  /** TTL in seconds */
  ttl: number;

  /** Number of models in cached data */
  modelCount: number;

  /** Human-readable age (e.g., "45m ago") */
  age: string;

  /** Whether the cache is stale (past TTL) */
  isStale: boolean;
}

/**
 * Cache statistics for all sources
 */
export interface CacheStats {
  /** Cache directory path */
  location: string;

  /** Statistics per source */
  sources: CacheSourceStats[];
}

export type ReplicatePricingSource = "billingConfig" | "price-string";

export interface ReplicatePricingEntry {
  /** Normalized Replicate pricing payload merged into raw model.pricing */
  pricing: Record<string, number>;

  /** Where the pricing payload came from on the Replicate model page */
  source: ReplicatePricingSource;

  /** Timestamp when this entry was fetched (Unix epoch in seconds) */
  fetchedAt: number;

  /** Timestamp when this entry expires (Unix epoch in seconds) */
  expiresAt: number;
}

export interface ReplicatePricingCacheFile {
  /** Cache schema version */
  version: 1;

  /** Last cache write time (Unix epoch in seconds) */
  updatedAt: number;

  /** Per-model pricing entries keyed by owner/name */
  entries: Record<string, ReplicatePricingEntry>;
}

// =============================================================================
// API RESPONSE TYPES (Raw)
// =============================================================================

/**
 * Raw OpenRouter model from API response
 * Used for normalization, not exposed to the rest of the application
 */
export interface OpenRouterModel {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
    image?: string;
    request?: string;
  };
  architecture?: {
    modality?: string | null;
    tokenizer?: string | null;
    instruct_type?: string | null;
    input_modalities?: string[] | null;
    output_modalities?: string[] | null;
  } | null;
  top_provider?: {
    context_length?: number | null;
    max_completion_tokens?: number | null;
    is_moderated?: boolean | null;
  } | null;
  per_request_limits?: {
    prompt_tokens?: number | null;
    completion_tokens?: number | null;
  } | null;
}

/**
 * OpenRouter API response structure
 */
export interface OpenRouterResponse {
  data: OpenRouterModel[];
}

/**
 * OpenRouter chat completion request
 */
export interface OpenRouterChatRequest {
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
  response_format?: { type: "json_object" };
  temperature?: number;
  max_tokens?: number;
}

/**
 * OpenRouter chat completion response
 */
export interface OpenRouterChatResponse {
  id: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

/**
 * Raw fal.ai model from API response
 */
export interface FalModel {
  id: string;
  name: string;
  description?: string;
  category: string;
  pricing?: {
    type: string;
    amount: number;
  };
  inputs?: Record<
    string,
    {
      type: string;
      description?: string;
      default?: unknown;
    }
  >;
  outputs?: Record<
    string,
    {
      type: string;
      description?: string;
    }
  >;
}

/**
 * fal.ai API response structure
 */
export type FalResponse =
  | FalModel[]
  | {
      models?: FalModel[];
      data?: FalModel[];
    };

/**
 * Raw Replicate model from API response
 */
export interface ReplicateModel {
  url?: string;
  owner: string;
  name: string;
  description?: string | null;
  visibility?: "public" | "private";
  run_count?: number;
  latest_version?: {
    id?: string;
    created_at?: string;
    openapi_schema?: unknown;
    pricing?: unknown;
    [key: string]: unknown;
  } | null;
  pricing?: unknown;
  [key: string]: unknown;
}

/**
 * Replicate paginated models response
 */
export interface ReplicateModelsResponse {
  next?: string | null;
  previous?: string | null;
  results?: ReplicateModel[];
}
