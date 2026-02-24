import type { CatalogSource } from './source.js';
import { normalizeOpenRouterModel } from './normalization.js';
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
  type OpenRouterResponse
} from '../types.js';

const DEFAULT_ENDPOINT = 'https://openrouter.ai/api/v1/models';
const DEFAULT_TIMEOUT_MS = 10_000;

type Sleep = (ms: number) => Promise<void>;

export interface OpenRouterCatalogOptions {
  endpoint?: string;
  timeoutMs?: number;
  retryDelaysMs?: number[];
  fetchImpl?: typeof fetch;
  sleep?: Sleep;
  noCache?: boolean;
  cacheTtl?: number;
}

export class OpenRouterCatalog implements CatalogSource {
  readonly sourceId = 'openrouter';

  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly retryDelaysMs: number[];
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: Sleep;
  private readonly noCache: boolean;
  private readonly cacheTtl: number;

  constructor(options: OpenRouterCatalogOptions = {}) {
    this.endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.retryDelaysMs = options.retryDelaysMs ?? [...DEFAULT_RETRY_DELAYS_MS];
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? wait;
    this.noCache = options.noCache ?? false;
    this.cacheTtl = options.cacheTtl ?? DEFAULT_CACHE_TTL_SECONDS;
  }

  async fetch(): Promise<ModelEntry[]> {
    if (!this.noCache) {
      const cached = await readCache(this.sourceId);
      if (cached) {
        return cached;
      }
    }

    const maxAttempts = this.retryDelaysMs.length + 1;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const response = await this.fetchWithTimeout();

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

        const payload = (await response.json()) as OpenRouterResponse;
        if (!payload || !Array.isArray(payload.data)) {
          throw new WhichModelError(
            'OpenRouter catalog response is invalid.',
            ExitCode.NETWORK_ERROR,
            'Try again shortly. If this persists, check https://status.openrouter.ai.'
          );
        }

        const models = payload.data
          .map(model => normalizeOpenRouterModel(model))
          .filter((model): model is ModelEntry => model !== null);

        await writeCache(this.sourceId, models, this.cacheTtl);

        return models;
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

  private async fetchWithTimeout(): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await this.fetchImpl(this.endpoint, {
        method: 'GET',
        headers: { Accept: 'application/json' },
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
    if (status >= 500) {
      return new WhichModelError(
        `Unable to fetch model catalog (OpenRouter returned ${status}).`,
        ExitCode.NETWORK_ERROR,
        [
          'OpenRouter may be experiencing temporary issues.',
          'Retry in a few minutes and check https://status.openrouter.ai.'
        ].join('\n')
      );
    }

    if (status === 429) {
      return new WhichModelError(
        'OpenRouter rate limit exceeded while fetching the model catalog.',
        ExitCode.NETWORK_ERROR,
        'Wait a minute and retry.'
      );
    }

    return new WhichModelError(
      `Unable to fetch model catalog (OpenRouter returned ${status}).`,
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
        'Timeout fetching model catalog from OpenRouter.',
        ExitCode.NETWORK_ERROR,
        [
          'This can be caused by a slow network or temporary API issues.',
          'Retry in a few minutes and check https://status.openrouter.ai.'
        ].join('\n')
      );
    }

    const detail =
      error instanceof Error ? error.message : 'Unknown network failure.';

    return new WhichModelError(
      `Failed to fetch model catalog from OpenRouter: ${detail}`,
      ExitCode.NETWORK_ERROR,
      'Check your internet connection and retry. Status page: https://status.openrouter.ai'
    );
  }
}
