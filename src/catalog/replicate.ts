import type { CatalogSource } from './source.js';
import { normalizeReplicateModel } from './normalization.js';
import { readCache, writeCache } from './cache.js';
import {
  DEFAULT_CACHE_TTL_SECONDS,
  DEFAULT_REPLICATE_PRICE_CONCURRENCY,
  DEFAULT_REPLICATE_PRICE_FETCH_BUDGET,
  DEFAULT_REPLICATE_PRICE_MAX_STALE_SECONDS,
  DEFAULT_REPLICATE_PRICE_TTL_SECONDS
} from '../config.js';
import { parseReplicateModelsResponse } from '../schemas/provider-schemas.js';
import {
  applyReplicatePricingUpdates,
  readReplicatePricingCache,
  resolveReplicatePricingEntry,
  writeReplicatePricingCache
} from './replicate-pricing-cache.js';
import { fetchReplicatePagePricing } from './replicate-page-pricing.js';
import {
  isAbortError,
  wait,
  withJitter,
  DEFAULT_RETRY_DELAYS_MS
} from '../utils/common.js';
import { wrapResultAsync } from '../utils/result.js';
import {
  ExitCode,
  WhichModelError,
  type ModelEntry,
  type ReplicateModel
} from '../types.js';

const DEFAULT_ENDPOINT = 'https://api.replicate.com/v1/models';
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_MODEL_PAGES = 8;
const MAX_CANDIDATE_MODELS = 300;
const REPLICATE_PAGE_TIMEOUT_MS = 3_000;

type Sleep = (ms: number) => Promise<void>;

export interface ReplicateCatalogOptions {
  apiToken?: string;
  endpoint?: string;
  timeoutMs?: number;
  retryDelaysMs?: number[];
  fetchImpl?: typeof fetch;
  sleep?: Sleep;
  noCache?: boolean;
  cacheTtl?: number;
  replicatePriceTtlSeconds?: number;
  replicatePriceMaxStaleSeconds?: number;
  replicatePriceFetchBudget?: number;
  replicatePriceConcurrency?: number;
}

export class ReplicateCatalog implements CatalogSource {
  readonly sourceId = 'replicate';

  private readonly apiToken?: string;
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly retryDelaysMs: number[];
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: Sleep;
  private readonly noCache: boolean;
  private readonly cacheTtl: number;
  private readonly replicatePriceTtlSeconds: number;
  private readonly replicatePriceMaxStaleSeconds: number;
  private readonly replicatePriceFetchBudget: number;
  private readonly replicatePriceConcurrency: number;

  constructor(options: ReplicateCatalogOptions = {}) {
    this.apiToken = options.apiToken;
    this.endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.retryDelaysMs = options.retryDelaysMs ?? [...DEFAULT_RETRY_DELAYS_MS];
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? wait;
    this.noCache = options.noCache ?? false;
    this.cacheTtl = options.cacheTtl ?? DEFAULT_CACHE_TTL_SECONDS;
    this.replicatePriceTtlSeconds =
      options.replicatePriceTtlSeconds ?? DEFAULT_REPLICATE_PRICE_TTL_SECONDS;
    this.replicatePriceMaxStaleSeconds =
      options.replicatePriceMaxStaleSeconds ??
      DEFAULT_REPLICATE_PRICE_MAX_STALE_SECONDS;
    this.replicatePriceFetchBudget =
      options.replicatePriceFetchBudget ?? DEFAULT_REPLICATE_PRICE_FETCH_BUDGET;
    this.replicatePriceConcurrency =
      options.replicatePriceConcurrency ?? DEFAULT_REPLICATE_PRICE_CONCURRENCY;
  }

  async fetch(): Promise<ModelEntry[]> {
    if (!this.apiToken) {
      throw new WhichModelError(
        'REPLICATE_API_TOKEN is not set.',
        ExitCode.NO_API_KEY,
        'Set REPLICATE_API_TOKEN and retry.'
      );
    }

    if (!this.noCache) {
      const cached = await readCache(this.sourceId);
      if (cached) {
        return cached;
      }
    }

    const rawModels = await this.fetchAllModels();
    const enrichedRawModels = await this.enrichMissingPricing(rawModels);
    const models = enrichedRawModels
      .map(model => normalizeReplicateModel(model))
      .filter((model): model is ModelEntry => model !== null);

    if (models.length > 0) {
      await writeCache(this.sourceId, models, this.cacheTtl);
    }

    return models;
  }

  private async enrichMissingPricing(
    rawModels: ReplicateModel[]
  ): Promise<ReplicateModel[]> {
    const budget = Math.max(0, this.replicatePriceFetchBudget);
    const concurrency = Math.max(1, this.replicatePriceConcurrency);
    if (budget === 0) {
      return rawModels;
    }

    const now = this.nowEpochSeconds();
    let cache = await readReplicatePricingCache();
    const refreshQueue: Array<{ key: string; model: ReplicateModel }> = [];

    for (const model of rawModels) {
      if (this.hasApiPricing(model)) {
        continue;
      }

      const key = this.modelKey(model);
      if (!key || key === '/') {
        continue;
      }

      const lookup = resolveReplicatePricingEntry(
        cache,
        key,
        now,
        this.replicatePriceMaxStaleSeconds
      );

      if (lookup.state === 'fresh' || lookup.state === 'stale') {
        this.applyEnrichedPricing(model, lookup.entry?.pricing);
      }

      if (lookup.state !== 'fresh' && refreshQueue.length < budget) {
        refreshQueue.push({ key, model });
      }
    }

    if (refreshQueue.length === 0) {
      return rawModels;
    }

    const updates = await this.runWithConcurrency(refreshQueue, concurrency, async item => {
      const result = await fetchReplicatePagePricing(item.key, {
        fetchImpl: this.fetchImpl,
        timeoutMs: REPLICATE_PAGE_TIMEOUT_MS
      });
      if (!result || Object.keys(result.pricing).length === 0) {
        return null;
      }

      this.applyEnrichedPricing(item.model, result.pricing);
      return {
        modelKey: item.key,
        pricing: result.pricing,
        source: result.source
      };
    });

    const validUpdates = updates.filter(
      (
        update
      ): update is {
        modelKey: string;
        pricing: Record<string, number>;
        source: 'billingConfig' | 'price-string';
      } => update !== null
    );

    if (validUpdates.length > 0) {
      cache = applyReplicatePricingUpdates(
        cache,
        validUpdates,
        this.replicatePriceTtlSeconds,
        now
      );
      await writeReplicatePricingCache(cache);
    }

    return rawModels;
  }

  private async fetchAllModels(): Promise<ReplicateModel[]> {
    const all: ReplicateModel[] = [];
    let nextUrl: string | null = this.endpoint;
    let pagesFetched = 0;

    while (
      nextUrl &&
      pagesFetched < MAX_MODEL_PAGES &&
      all.length < MAX_CANDIDATE_MODELS
    ) {
      const rawPayload = await this.requestJson<unknown>(nextUrl);
      const payloadResult = parseReplicateModelsResponse(rawPayload);
      if (payloadResult.isErr()) {
        throw payloadResult.error;
      }
      const payload = payloadResult.value;

      for (const model of payload.results) {
        if (model?.visibility === 'private') {
          continue;
        }
        all.push(model);
        if (all.length >= MAX_CANDIDATE_MODELS) {
          break;
        }
      }

      pagesFetched += 1;
      nextUrl = this.toNextUrl(payload.next);
    }

    return [...all]
      .sort((a, b) => {
        const runA = typeof a.run_count === 'number' ? a.run_count : -1;
        const runB = typeof b.run_count === 'number' ? b.run_count : -1;
        if (runA !== runB) {
          return runB - runA;
        }

        return this.modelKey(a).localeCompare(this.modelKey(b));
      })
      .slice(0, MAX_CANDIDATE_MODELS);
  }

  private modelKey(model: ReplicateModel): string {
    const owner = typeof model.owner === 'string' ? model.owner.trim() : '';
    const name = typeof model.name === 'string' ? model.name.trim() : '';
    return `${owner}/${name}`;
  }

  private hasApiPricing(model: ReplicateModel): boolean {
    return (
      this.hasNonEmptyPricing(model.pricing) ||
      this.hasNonEmptyPricing(model.latest_version?.pricing)
    );
  }

  private hasNonEmptyPricing(value: unknown): boolean {
    if (value === null || value === undefined) {
      return false;
    }
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value);
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    if (typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>).length > 0;
    }
    return false;
  }

  private applyEnrichedPricing(
    model: ReplicateModel,
    pricing: Record<string, number> | undefined
  ): void {
    if (!pricing || Object.keys(pricing).length === 0) {
      return;
    }
    model.pricing = { ...pricing };
  }

  private nowEpochSeconds(): number {
    return Math.floor(Date.now() / 1000);
  }

  private async runWithConcurrency<TItem, TResult>(
    items: TItem[],
    concurrency: number,
    worker: (item: TItem) => Promise<TResult>
  ): Promise<TResult[]> {
    if (items.length === 0) {
      return [];
    }

    const results = new Array<TResult>(items.length);
    let index = 0;
    const workers = Array.from({
      length: Math.min(Math.max(1, concurrency), items.length)
    }).map(async () => {
      while (true) {
        const current = index;
        index += 1;
        if (current >= items.length) {
          return;
        }

        results[current] = await worker(items[current] as TItem);
      }
    });

    await Promise.all(workers);
    return results;
  }

  private toNextUrl(next: string | null | undefined): string | null {
    if (!next) {
      return null;
    }

    if (/^https?:\/\//i.test(next)) {
      return next;
    }

    try {
      return new URL(next, this.endpoint).toString();
    } catch {
      return null;
    }
  }

  private async requestJson<T>(url: string): Promise<T> {
    const maxAttempts = this.retryDelaysMs.length + 1;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const response = await this.fetchWithTimeout(url);
        if (!response.ok) {
          if (
            this.shouldRetryStatus(response.status) &&
            attempt < maxAttempts - 1
          ) {
            await this.sleep(withJitter(this.retryDelayForAttempt(attempt)));
            continue;
          }

          throw this.buildHttpError(response.status);
        }

        const payloadResult = await wrapResultAsync(
          () => response.json(),
          () =>
            new WhichModelError(
              'Replicate response body is invalid JSON.',
              ExitCode.NETWORK_ERROR,
              'Retry in a few minutes.'
            )
        );
        if (payloadResult.isErr()) {
          throw payloadResult.error;
        }

        return payloadResult.value as T;
      } catch (error) {
        lastError = error;

        if (this.shouldRetryError(error) && attempt < maxAttempts - 1) {
          await this.sleep(withJitter(this.retryDelayForAttempt(attempt)));
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
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          Accept: 'application/json'
        },
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private retryDelayForAttempt(attempt: number): number {
    return (
      this.retryDelaysMs[Math.min(attempt, this.retryDelaysMs.length - 1)] ?? 0
    );
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
        'Invalid or unauthorized Replicate API token.',
        ExitCode.NO_API_KEY,
        'Check REPLICATE_API_TOKEN at https://replicate.com/account/api-tokens'
      );
    }

    if (status === 429) {
      return new WhichModelError(
        'Replicate rate limit exceeded while fetching the model catalog.',
        ExitCode.NETWORK_ERROR,
        'Wait a minute and retry.'
      );
    }

    if (status >= 500) {
      return new WhichModelError(
        `Unable to fetch Replicate model catalog (status ${status}).`,
        ExitCode.NETWORK_ERROR,
        'Retry in a few minutes.'
      );
    }

    return new WhichModelError(
      `Unable to fetch Replicate model catalog (status ${status}).`,
      ExitCode.NETWORK_ERROR,
      'Check your network connection and retry.'
    );
  }

  private toNetworkError(error: unknown): WhichModelError {
    if (error instanceof WhichModelError) {
      return error;
    }

    if (isAbortError(error)) {
      return new WhichModelError(
        'Timeout fetching model catalog from Replicate.',
        ExitCode.NETWORK_ERROR,
        'Retry in a few minutes.'
      );
    }

    const detail =
      error instanceof Error ? error.message : 'Unknown network failure.';
    return new WhichModelError(
      `Failed to fetch model catalog from Replicate: ${detail}`,
      ExitCode.NETWORK_ERROR,
      'Check your internet connection and retry.'
    );
  }
}
