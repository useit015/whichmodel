import type { CatalogSource } from "./source.js";
import { classifyFalCategory, normalizeFalModel } from "./normalization.js";
import { ExitCode, WhichModelError, type FalModel, type ModelEntry } from "../types.js";

const DEFAULT_MODELS_ENDPOINT = "https://api.fal.ai/v1/models";
const DEFAULT_PRICING_ENDPOINT = "https://api.fal.ai/v1/models/pricing";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_DELAYS_MS = [1_000, 2_000, 4_000];
const DEFAULT_PAGE_SIZE = 200;
const PRICING_CHUNK_SIZE = 20;
const MAX_MODEL_PAGES = 8;
const MAX_CANDIDATE_MODELS = 300;

type Sleep = (ms: number) => Promise<void>;

export interface FalCatalogOptions {
  apiKey?: string;
  modelsEndpoint?: string;
  pricingEndpoint?: string;
  timeoutMs?: number;
  retryDelaysMs?: number[];
  fetchImpl?: typeof fetch;
  sleep?: Sleep;
}

interface FalPlatformModel {
  endpoint_id: string;
  metadata?: {
    display_name?: string;
    category?: string;
  };
}

interface FalModelsListResponse {
  models?: FalPlatformModel[];
  has_more?: boolean;
  next_cursor?: string | null;
}

interface FalPlatformPrice {
  endpoint_id: string;
  unit_price: number;
  unit?: string;
}

interface FalPricingResponse {
  prices?: FalPlatformPrice[];
}

export class FalCatalog implements CatalogSource {
  readonly sourceId = "fal";

  private readonly apiKey?: string;
  private readonly modelsEndpoint: string;
  private readonly pricingEndpoint: string;
  private readonly timeoutMs: number;
  private readonly retryDelaysMs: number[];
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: Sleep;

  constructor(options: FalCatalogOptions = {}) {
    this.apiKey = options.apiKey;
    this.modelsEndpoint = options.modelsEndpoint ?? DEFAULT_MODELS_ENDPOINT;
    this.pricingEndpoint = options.pricingEndpoint ?? DEFAULT_PRICING_ENDPOINT;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? wait;
  }

  async fetch(): Promise<ModelEntry[]> {
    if (!this.apiKey) {
      throw new WhichModelError(
        "FAL_API_KEY is not set.",
        ExitCode.NO_API_KEY,
        "Set FAL_API_KEY and retry."
      );
    }

    const platformModels = await this.fetchAllPlatformModels();
    if (platformModels.length === 0) {
      return [];
    }

    const priceMap = await this.fetchPricingMap(platformModels.map((model) => model.endpoint_id));
    const normalizedRaw: FalModel[] = platformModels
      .map((model) => this.toFalModel(model, priceMap.get(model.endpoint_id)))
      .filter((model): model is FalModel => model !== null);

    return normalizedRaw
      .map((model) => normalizeFalModel(model))
      .filter((model): model is ModelEntry => model !== null);
  }

  private async fetchAllPlatformModels(): Promise<FalPlatformModel[]> {
    const all: FalPlatformModel[] = [];
    let cursor: string | undefined;
    let pagesFetched = 0;

    for (;;) {
      const params = new URLSearchParams();
      params.set("limit", String(DEFAULT_PAGE_SIZE));
      if (cursor) {
        params.set("cursor", cursor);
      }

      const payload = await this.requestJson<FalModelsListResponse>(
        `${this.modelsEndpoint}?${params.toString()}`
      );

      if (!payload || !Array.isArray(payload.models)) {
        throw new WhichModelError(
          "fal.ai catalog response is invalid.",
          ExitCode.NETWORK_ERROR,
          "Retry in a few minutes."
        );
      }

      all.push(
        ...payload.models.filter((model) => classifyFalCategory(model.metadata?.category ?? "") !== null)
      );
      pagesFetched += 1;

      if (pagesFetched >= MAX_MODEL_PAGES || all.length >= MAX_CANDIDATE_MODELS) {
        break;
      }

      if (!payload.has_more || !payload.next_cursor) {
        break;
      }

      cursor = payload.next_cursor;
    }

    return [...all]
      .sort((a, b) => a.endpoint_id.localeCompare(b.endpoint_id))
      .slice(0, MAX_CANDIDATE_MODELS);
  }

  private async fetchPricingMap(
    endpointIds: string[]
  ): Promise<Map<string, { amount: number; unit?: string }>> {
    const priceMap = new Map<string, { amount: number; unit?: string }>();
    const sortedEndpointIds = [...endpointIds].sort((a, b) => a.localeCompare(b));

    for (const chunk of chunked(sortedEndpointIds, PRICING_CHUNK_SIZE)) {
      await this.fetchPricingForChunk(chunk, priceMap);
    }

    return priceMap;
  }

  private toFalModel(
    model: FalPlatformModel,
    pricing: { amount: number; unit?: string } | undefined
  ): FalModel | null {
    const category = model.metadata?.category;
    if (!category || typeof category !== "string") {
      return null;
    }

    if (
      !pricing ||
      typeof pricing.amount !== "number" ||
      !Number.isFinite(pricing.amount) ||
      pricing.amount <= 0
    ) {
      return null;
    }

    return {
      id: model.endpoint_id,
      name: model.metadata?.display_name?.trim() || model.endpoint_id,
      category,
      pricing: {
        type: this.falUnitToPricingType(category, pricing.unit),
        amount: pricing.amount,
      },
    };
  }

  private falUnitToPricingType(category: string, unit?: string): string {
    const normalizedUnit = unit?.toLowerCase() ?? "";
    if (normalizedUnit.includes("character")) {
      return "per_character";
    }
    if (normalizedUnit.includes("minute")) {
      return "per_minute";
    }
    if (normalizedUnit.includes("second")) {
      return "per_second";
    }
    if (normalizedUnit.includes("image")) {
      return "per_image";
    }

    const normalized = category.toLowerCase();
    if (normalized.includes("image")) {
      return "per_image";
    }
    if (normalized.includes("video")) {
      return "per_generation";
    }
    return "per_generation";
  }

  private async requestJson<T>(url: string): Promise<T> {
    const maxAttempts = this.retryDelaysMs.length + 1;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const response = await this.fetchWithTimeout(url);

        if (!response.ok) {
          if (this.shouldRetryStatus(response.status) && attempt < maxAttempts - 1) {
            await this.sleep(this.retryDelayForAttempt(attempt));
            continue;
          }

          throw this.buildHttpError(response.status);
        }

        return (await response.json()) as T;
      } catch (error) {
        lastError = error;

        if (this.shouldRetryError(error) && attempt < maxAttempts - 1) {
          await this.sleep(this.retryDelayForAttempt(attempt));
          continue;
        }

        throw this.toNetworkError(error);
      }
    }

    throw this.toNetworkError(lastError);
  }

  private async fetchWithTimeout(url: string): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await this.fetchImpl(url, {
        method: "GET",
        headers: {
          Authorization: `Key ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async fetchPricingForChunk(
    endpointIds: string[],
    priceMap: Map<string, { amount: number; unit?: string }>
  ): Promise<void> {
    if (endpointIds.length === 0) {
      return;
    }

    const params = new URLSearchParams();
    params.set("limit", String(DEFAULT_PAGE_SIZE));
    for (const endpointId of endpointIds) {
      params.append("endpoint_id", endpointId);
    }

    try {
      const payload = await this.requestJson<FalPricingResponse>(
        `${this.pricingEndpoint}?${params.toString()}`
      );
      if (!payload || !Array.isArray(payload.prices)) {
        throw new WhichModelError(
          "fal.ai pricing response is invalid.",
          ExitCode.NETWORK_ERROR,
          "Retry in a few minutes."
        );
      }

      for (const price of payload.prices) {
        if (!price || typeof price.endpoint_id !== "string") {
          continue;
        }
        if (typeof price.unit_price !== "number" || !Number.isFinite(price.unit_price)) {
          continue;
        }
        priceMap.set(price.endpoint_id, {
          amount: price.unit_price,
          unit: price.unit,
        });
      }
    } catch (error) {
      const isNotFound =
        error instanceof WhichModelError &&
        error.exitCode === ExitCode.NETWORK_ERROR &&
        /\(status 404\)/.test(error.message);
      const isRateLimited =
        error instanceof WhichModelError &&
        error.exitCode === ExitCode.NETWORK_ERROR &&
        /\(status 429\)/.test(error.message);

      if (isRateLimited) {
        return;
      }

      if (!isNotFound) {
        throw error;
      }

      if (endpointIds.length === 1) {
        return;
      }

      const middle = Math.floor(endpointIds.length / 2);
      await this.fetchPricingForChunk(endpointIds.slice(0, middle), priceMap);
      await this.fetchPricingForChunk(endpointIds.slice(middle), priceMap);
    }
  }

  private retryDelayForAttempt(attempt: number): number {
    return this.retryDelaysMs[Math.min(attempt, this.retryDelaysMs.length - 1)] ?? 0;
  }

  private shouldRetryStatus(status: number): boolean {
    return status === 408 || status === 429 || status >= 500;
  }

  private shouldRetryError(error: unknown): boolean {
    if (error instanceof WhichModelError) {
      return false;
    }

    if (isAbortError(error)) {
      return true;
    }

    return error instanceof TypeError;
  }

  private buildHttpError(status: number): WhichModelError {
    if (status === 401 || status === 403) {
      return new WhichModelError(
        "Invalid or unauthorized fal.ai API key.",
        ExitCode.NO_API_KEY,
        "Check FAL_API_KEY at https://fal.ai/dashboard"
      );
    }

    if (status >= 500) {
      return new WhichModelError(
        `Unable to fetch fal.ai model catalog (status ${status}).`,
        ExitCode.NETWORK_ERROR,
        "Retry in a few minutes."
      );
    }

    return new WhichModelError(
      `Unable to fetch fal.ai model catalog (status ${status}).`,
      ExitCode.NETWORK_ERROR,
      "Check your fal.ai configuration and retry."
    );
  }

  private toNetworkError(error: unknown): WhichModelError {
    if (error instanceof WhichModelError) {
      return error;
    }

    if (isAbortError(error)) {
      return new WhichModelError(
        "Timeout fetching model catalog from fal.ai.",
        ExitCode.NETWORK_ERROR,
        "Retry in a few minutes."
      );
    }

    const detail = error instanceof Error ? error.message : "Unknown network failure.";
    return new WhichModelError(
      `Failed to fetch model catalog from fal.ai: ${detail}`,
      ExitCode.NETWORK_ERROR,
      "Check your internet connection and retry."
    );
  }
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: string }).name === "AbortError"
  );
}

async function wait(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }

  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function chunked<T>(values: T[], size: number): T[][] {
  if (size <= 0) {
    return [values];
  }

  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }

  return chunks;
}
