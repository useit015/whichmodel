import { err, ok, type Result } from "neverthrow";
import { z } from "zod";
import { ExitCode, WhichModelError } from "../types.js";

const modalitySchema = z.enum([
  "text",
  "image",
  "video",
  "audio_tts",
  "audio_stt",
  "audio_generation",
  "vision",
  "embedding",
  "multimodal",
]);

const modelPickSchema = z.object({
  id: z.string().min(1),
  reason: z.string().min(1),
  pricingSummary: z.string().min(1),
  estimatedCost: z.string().min(1),
});

export const recommendationSchema = z.object({
  taskAnalysis: z.object({
    summary: z.string().min(1),
    detectedModality: modalitySchema,
    modalityReasoning: z.string().min(1),
    keyRequirements: z.array(z.string()),
    costFactors: z.string().min(1),
  }),
  recommendations: z.object({
    cheapest: modelPickSchema,
    balanced: modelPickSchema,
    best: modelPickSchema,
  }),
  alternativesInOtherModalities: z.string().nullable().optional().default(null),
});

export const compareResultSchema = z.object({
  winner: z.enum(["A", "B", "tie"]),
  reasoning: z.string().min(1),
  modelA: z.object({
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    estimatedCost: z.string().min(1),
    suitedFor: z.array(z.string()),
  }),
  modelB: z.object({
    strengths: z.array(z.string()),
    weaknesses: z.array(z.string()),
    estimatedCost: z.string().min(1),
    suitedFor: z.array(z.string()),
  }),
});

export const openRouterChatResponseSchema = z
  .object({
    id: z.string().optional(),
    choices: z.array(
      z.object({
        index: z.number(),
        message: z.object({
          role: z.string(),
          content: z.string(),
        }),
        finish_reason: z.string().nullable().optional().default(null),
      })
    ),
    usage: z
      .object({
        prompt_tokens: z.number(),
        completion_tokens: z.number(),
        total_tokens: z.number().optional(),
      })
      .optional(),
    model: z.string(),
  })
  .passthrough();

export type RecommendationParsed = z.infer<typeof recommendationSchema>;
export type CompareResultParsed = z.infer<typeof compareResultSchema>;
export type OpenRouterChatResponseParsed = z.infer<typeof openRouterChatResponseSchema>;

export function parseRecommendationPayload(
  payload: unknown
): Result<RecommendationParsed, WhichModelError> {
  const parsed = recommendationSchema.safeParse(payload);
  if (parsed.success) {
    return ok(parsed.data);
  }

  return err(
    new WhichModelError(
      "LLM JSON response does not match expected recommendation structure.",
      ExitCode.LLM_FAILED,
      "Retry in a few minutes or use fallback mode."
    )
  );
}

export function parseCompareResultPayload(payload: unknown): Result<CompareResultParsed, Error> {
  const parsed = compareResultSchema.safeParse(payload);
  if (parsed.success) {
    return ok(parsed.data);
  }

  return err(new Error("Compare response did not match expected schema."));
}

export function parseOpenRouterChatResponse(
  payload: unknown
): Result<OpenRouterChatResponseParsed, WhichModelError> {
  const parsed = openRouterChatResponseSchema.safeParse(payload);
  if (parsed.success) {
    return ok(parsed.data);
  }

  return err(
    new WhichModelError(
      "OpenRouter LLM response is malformed.",
      ExitCode.LLM_FAILED,
      "Retry the request."
    )
  );
}
