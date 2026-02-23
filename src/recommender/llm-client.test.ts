import { describe, expect, it, vi } from "vitest";
import { ExitCode } from "../types.js";
import { requestRecommendationCompletion } from "./llm-client.js";

function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("requestRecommendationCompletion", () => {
  it("returns parsed content and usage for success", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      mockResponse(200, {
        model: "deepseek/deepseek-v3.2",
        choices: [{ index: 0, message: { role: "assistant", content: "{\"ok\":true}" }, finish_reason: "stop" }],
        usage: {
          prompt_tokens: 100,
          completion_tokens: 20,
          total_tokens: 120,
        },
      })
    );

    const result = await requestRecommendationCompletion({
      apiKey: "sk-or-test",
      model: "deepseek/deepseek-v3.2",
      systemPrompt: "system",
      userPrompt: "user",
      fetchImpl,
      retryDelaysMs: [0],
      timeoutMs: 100,
    });

    expect(result.content).toBe('{"ok":true}');
    expect(result.usage).toEqual({ promptTokens: 100, completionTokens: 20 });
  });

  it("maps 401 to LLM_FAILED so fallback can execute", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(mockResponse(401, {}));

    await expect(
      requestRecommendationCompletion({
        apiKey: "bad",
        model: "deepseek/deepseek-v3.2",
        systemPrompt: "system",
        userPrompt: "user",
        fetchImpl,
        retryDelaysMs: [0],
      })
    ).rejects.toMatchObject({ exitCode: ExitCode.LLM_FAILED });
  });

  it("retries 5xx and then fails with LLM_FAILED", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(mockResponse(503, {}));

    await expect(
      requestRecommendationCompletion({
        apiKey: "sk-or-test",
        model: "deepseek/deepseek-v3.2",
        systemPrompt: "system",
        userPrompt: "user",
        fetchImpl,
        retryDelaysMs: [0, 0],
      })
    ).rejects.toMatchObject({ exitCode: ExitCode.LLM_FAILED });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });
});
