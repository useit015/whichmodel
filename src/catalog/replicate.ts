import type { CatalogSource } from './source.js';
import { normalizeReplicateModel } from './normalization.js';
import { readCache, writeCache } from './cache.js';
import { DEFAULT_CACHE_TTL_SECONDS } from '../config.js';
import {
  isAbortError,
  wait,
  withJitter,
  DEFAULT_RETRY_DELAYS_MS
} from '../utils/common.js';
import {
  ExitCode,
  WhichModelError,
  type ModelEntry,
  type ReplicateModel,
  type ReplicateModelsResponse
} from '../types.js';

const DEFAULT_ENDPOINT = 'https://api.replicate.com/v1/models';
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_MODEL_PAGES = 8;
const MAX_CANDIDATE_MODELS = 300;

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

  constructor(options: ReplicateCatalogOptions = {}) {
    this.apiToken = options.apiToken;
    this.endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.retryDelaysMs = options.retryDelaysMs ?? [...DEFAULT_RETRY_DELAYS_MS];
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? wait;
    this.noCache = options.noCache ?? false;
    this.cacheTtl = options.cacheTtl ?? DEFAULT_CACHE_TTL_SECONDS;
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
    const models = rawModels
      .map(model => normalizeReplicateModel(model))
      .filter((model): model is ModelEntry => model !== null);

    if (models.length > 0) {
      await writeCache(this.sourceId, models, this.cacheTtl);
    }

    return models;
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
      const payload = await this.requestJson<ReplicateModelsResponse>(nextUrl);
      if (!payload || !Array.isArray(payload.results)) {
        throw new WhichModelError(
          'Replicate catalog response is invalid.',
          ExitCode.NETWORK_ERROR,
          'Retry in a few minutes.'
        );
      }

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
    const owner = typeof model.owner === 'string' ? model.owner : '';
    const name = typeof model.name === 'string' ? model.name : '';
    return `${owner}/${name}`;
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

        return (await response.json()) as T;
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
