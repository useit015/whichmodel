import {
  ExitCode,
  WhichModelError,
  type OpenRouterChatRequest,
} from "../types.js";
import { parseOpenRouterChatResponse } from "../schemas/llm-schemas.js";
import { isAbortError, wait, withJitter, DEFAULT_RETRY_DELAYS_MS } from "../utils/common.js";
import { wrapResultAsync } from "../utils/result.js";

const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 30_000;

export interface LLMClientOptions {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  timeoutMs?: number;
  retryDelaysMs?: number[];
  fetchImpl?: typeof fetch;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMCompletion {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export async function requestRecommendationCompletion(
  options: LLMClientOptions
): Promise<LLMCompletion> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryDelaysMs = options.retryDelaysMs ?? [...DEFAULT_RETRY_DELAYS_MS];
  const fetchImpl = options.fetchImpl ?? fetch;
  const maxAttempts = retryDelaysMs.length + 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const response = await postChatCompletion(fetchImpl, options, timeoutMs);

      if (!response.ok) {
        if (response.status === 401) {
          throw new WhichModelError(
            "Invalid OpenRouter API key.",
            ExitCode.LLM_FAILED,
            [
              "Please check that your key is valid, active, and starts with sk-or-.",
              "Manage keys at https://openrouter.ai/keys",
            ].join("\n")
          );
        }

        if (response.status === 402) {
          throw new WhichModelError(
            "Insufficient credits in your OpenRouter account.",
            ExitCode.LLM_FAILED,
            [
              "Add credits at https://openrouter.ai/credits",
              "The default recommender model is low-cost, but requires a positive balance.",
            ].join("\n")
          );
        }

        if (response.status === 429 && attempt < maxAttempts - 1) {
          await wait(withJitter(retryDelayForAttempt(retryDelaysMs, attempt)));
          continue;
        }

        if (shouldRetryStatus(response.status) && attempt < maxAttempts - 1) {
          await wait(withJitter(retryDelayForAttempt(retryDelaysMs, attempt)));
          continue;
        }

        throw new WhichModelError(
          `OpenRouter LLM request failed with status ${response.status}.`,
          ExitCode.LLM_FAILED,
          "Retry shortly or switch --model."
        );
      }

      const rawPayload = await wrapResultAsync(
        () => response.json(),
        () =>
          new WhichModelError(
            "OpenRouter LLM returned malformed JSON.",
            ExitCode.LLM_FAILED,
            "Retry the request."
          )
      );
      if (rawPayload.isErr()) {
        throw rawPayload.error;
      }

      const payloadResult = parseOpenRouterChatResponse(rawPayload.value);
      if (payloadResult.isErr()) {
        throw payloadResult.error;
      }
      const payload = payloadResult.value;
      const content = payload.choices?.[0]?.message?.content;
      if (!content || typeof content !== "string") {
        throw new WhichModelError(
          "OpenRouter LLM returned an empty response.",
          ExitCode.LLM_FAILED,
          "Retry the request."
        );
      }

      return {
        content,
        model: payload.model,
        usage: payload.usage
          ? {
              promptTokens: payload.usage.prompt_tokens,
              completionTokens: payload.usage.completion_tokens,
            }
          : undefined,
      };
    } catch (error) {
      lastError = error;

      if (error instanceof WhichModelError && !isRetryableCode(error.exitCode)) {
        throw error;
      }

      if (attempt < maxAttempts - 1 && isRetryableError(error)) {
        await wait(withJitter(retryDelayForAttempt(retryDelaysMs, attempt)));
        continue;
      }

      break;
    }
  }

  if (lastError instanceof WhichModelError) {
    throw lastError;
  }

  if (isAbortError(lastError)) {
    throw new WhichModelError(
      "OpenRouter LLM request timed out.",
      ExitCode.LLM_FAILED,
      "Retry in a few minutes. If this continues, try a smaller task description."
    );
  }

  const detail = lastError instanceof Error ? lastError.message : "Unknown LLM error";
  throw new WhichModelError(
    `LLM recommendation failed: ${detail}`,
    ExitCode.LLM_FAILED,
    "Retry in a few minutes or use fallback mode."
  );
}

async function postChatCompletion(
  fetchImpl: typeof fetch,
  options: LLMClientOptions,
  timeoutMs: number
): Promise<Response> {
  const body: OpenRouterChatRequest = {
    model: options.model,
    messages: [
      {
        role: "system",
        content: options.systemPrompt,
      },
      {
        role: "user",
        content: options.userPrompt,
      },
    ],
    response_format: {
      type: "json_object",
    },
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens ?? 1_200,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetchImpl(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/whichmodel/whichmodel",
        "X-Title": "whichmodel CLI",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function shouldRetryStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function isRetryableCode(code: ExitCode): boolean {
  return code === ExitCode.LLM_FAILED || code === ExitCode.NETWORK_ERROR;
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof WhichModelError) {
    return isRetryableCode(error.exitCode);
  }

  if (isAbortError(error)) {
    return true;
  }

  return error instanceof TypeError;
}

function retryDelayForAttempt(delays: ReadonlyArray<number>, attempt: number): number {
  return delays[Math.min(attempt, delays.length - 1)] ?? 0;
}
