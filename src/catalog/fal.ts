import type { CatalogSource } from "./source.js";
import { normalizeFalModel } from "./normalization.js";
import { ExitCode, WhichModelError, type FalModel, type FalResponse, type ModelEntry } from "../types.js";

const DEFAULT_ENDPOINT = "https://fal.run/api/models";
const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_DELAYS_MS = [1_000, 2_000, 4_000];

type Sleep = (ms: number) => Promise<void>;

export interface FalCatalogOptions {
  apiKey?: string;
  endpoint?: string;
  timeoutMs?: number;
  retryDelaysMs?: number[];
  fetchImpl?: typeof fetch;
  sleep?: Sleep;
}

export class FalCatalog implements CatalogSource {
  readonly sourceId = "fal";

  private readonly apiKey?: string;
  private readonly endpoint: string;
  private readonly timeoutMs: number;
  private readonly retryDelaysMs: number[];
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: Sleep;

  constructor(options: FalCatalogOptions = {}) {
    this.apiKey = options.apiKey;
    this.endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
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

        const payload = (await response.json()) as FalResponse;
        const models = this.parseResponseModels(payload);
        if (!models) {
          throw new WhichModelError(
            "fal.ai catalog response is invalid.",
            ExitCode.NETWORK_ERROR,
            "Retry in a few minutes."
          );
        }

        return models
          .map((model) => normalizeFalModel(model))
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

  private parseResponseModels(payload: FalResponse): FalModel[] | null {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (payload && typeof payload === "object") {
      if (Array.isArray(payload.models)) {
        return payload.models;
      }
      if (Array.isArray(payload.data)) {
        return payload.data;
      }
    }

    return null;
  }

  private async fetchWithTimeout(): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await this.fetchImpl(this.endpoint, {
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
