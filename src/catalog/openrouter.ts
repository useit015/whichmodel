import type { CatalogSource } from "./source.js";
import { normalizeOpenRouterModel } from "./normalization.js";
import {
  ExitCode,
  WhichModelError,
  type ModelEntry,
  type OpenRouterResponse,
} from "../types.js";

const DEFAULT_ENDPOINT = "https://openrouter.ai/api/v1/models";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_DELAYS_MS = [1_000, 2_000, 4_000];

type Sleep = (ms: number) => Promise<void>;

export interface OpenRouterCatalogOptions {
  endpoint?: string;
  timeoutMs?: number;
  retryDelaysMs?: number[];
  fetchImpl?: typeof fetch;
  sleep?: Sleep;
}

export class OpenRouterCatalog implements CatalogSource {
  readonly sourceId = "openrouter";

  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly retryDelaysMs: number[];
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: Sleep;

  constructor(options: OpenRouterCatalogOptions = {}) {
    this.endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? wait;
  }

  async fetch(): Promise<ModelEntry[]> {
    const maxAttempts = this.retryDelaysMs.length + 1;
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const response = await this.fetchWithTimeout();

        if (!response.ok) {
          if (this.shouldRetryStatus(response.status) && attempt < maxAttempts - 1) {
            await this.sleep(this.retryDelayForAttempt(attempt));
            continue;
          }

          throw this.buildHttpError(response.status);
        }

        const payload = (await response.json()) as OpenRouterResponse;
        if (!payload || !Array.isArray(payload.data)) {
          throw new WhichModelError(
            "OpenRouter catalog response is invalid.",
            ExitCode.NETWORK_ERROR,
            "Try again shortly. If this persists, check https://status.openrouter.ai."
          );
        }

        return payload.data
          .map((model) => normalizeOpenRouterModel(model))
          .filter((model): model is ModelEntry => model !== null);
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

  private async fetchWithTimeout(): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await this.fetchImpl(this.endpoint, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
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
    return new WhichModelError(
      `Unable to fetch model catalog (OpenRouter returned ${status}).`,
      ExitCode.NETWORK_ERROR,
      "Check https://status.openrouter.ai and retry in a few minutes."
    );
  }

  private toNetworkError(error: unknown): WhichModelError {
    if (error instanceof WhichModelError) {
      return error;
    }

    const detail =
      error instanceof Error ? error.message : "Unknown network failure.";

    return new WhichModelError(
      `Failed to fetch model catalog from OpenRouter: ${detail}`,
      ExitCode.NETWORK_ERROR,
      "Check your internet connection and retry. Status page: https://status.openrouter.ai"
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
  if (ms <= 0) return;

  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
