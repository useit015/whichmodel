import { err, ok, type Result } from "neverthrow";
import { z } from "zod";
import { ExitCode, WhichModelError } from "../types.js";

const priceScalarSchema = z.union([z.string(), z.number()]).transform((value) => String(value));

export const openRouterModelSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    context_length: z.union([z.number().int().nonnegative(), z.null()]).transform((value) => value ?? 0),
    pricing: z.object({
      prompt: priceScalarSchema,
      completion: priceScalarSchema,
      image: priceScalarSchema.optional(),
      request: priceScalarSchema.optional(),
    }),
    architecture: z
      .object({
        modality: z.string().nullable().optional(),
        tokenizer: z.string().nullable().optional(),
        instruct_type: z.string().nullable().optional(),
        input_modalities: z.array(z.string()).nullable().optional(),
        output_modalities: z.array(z.string()).nullable().optional(),
      })
      .nullable()
      .optional(),
    top_provider: z
      .object({
        context_length: z.number().int().nullable().optional(),
        max_completion_tokens: z.number().int().nullable().optional(),
        is_moderated: z.boolean().nullable().optional(),
      })
      .nullable()
      .optional(),
    per_request_limits: z
      .object({
        prompt_tokens: z.number().int().nullable().optional(),
        completion_tokens: z.number().int().nullable().optional(),
      })
      .nullable()
      .optional(),
  })
  .passthrough();

export const openRouterResponseSchema = z
  .object({
    data: z.array(openRouterModelSchema),
  })
  .passthrough();

const falPlatformModelSchema = z
  .object({
    endpoint_id: z.string().min(1),
    metadata: z
      .object({
        display_name: z.string().optional(),
        category: z.string().optional(),
      })
      .optional(),
  })
  .passthrough();

export const falModelsListResponseSchema = z
  .object({
    models: z.array(falPlatformModelSchema),
    has_more: z.boolean().optional(),
    next_cursor: z.string().nullable().optional(),
  })
  .passthrough();

const falPlatformPriceSchema = z
  .object({
    endpoint_id: z.string().min(1),
    unit_price: z.number(),
    unit: z.string().optional(),
  })
  .passthrough();

export const falPricingResponseSchema = z
  .object({
    prices: z.array(falPlatformPriceSchema),
  })
  .passthrough();

const replicateModelSchema = z
  .object({
    url: z.string().optional(),
    owner: z.string().optional().default(""),
    name: z.string().optional().default(""),
    description: z.string().nullable().optional(),
    visibility: z.enum(["public", "private"]).optional(),
    run_count: z.number().optional(),
    latest_version: z
      .object({
        id: z.string().optional(),
        created_at: z.string().optional(),
        openapi_schema: z.unknown().optional(),
        pricing: z.unknown().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    pricing: z.unknown().optional(),
  })
  .passthrough();

export const replicateModelsResponseSchema = z
  .object({
    next: z.string().nullable().optional(),
    previous: z.string().nullable().optional(),
    results: z.array(replicateModelSchema),
  })
  .passthrough();

export type OpenRouterResponseParsed = z.infer<typeof openRouterResponseSchema>;
export type FalModelsListResponseParsed = z.infer<typeof falModelsListResponseSchema>;
export type FalPricingResponseParsed = z.infer<typeof falPricingResponseSchema>;
export type ReplicateModelsResponseParsed = z.infer<typeof replicateModelsResponseSchema>;

function schemaFailure(label: string): WhichModelError {
  return new WhichModelError(
    `${label} response is invalid.`,
    ExitCode.NETWORK_ERROR,
    "Retry in a few minutes."
  );
}

export function parseOpenRouterResponse(
  payload: unknown
): Result<OpenRouterResponseParsed, WhichModelError> {
  const parsed = openRouterResponseSchema.safeParse(payload);
  return parsed.success ? ok(parsed.data) : err(schemaFailure("OpenRouter catalog"));
}

export function parseFalModelsListResponse(
  payload: unknown
): Result<FalModelsListResponseParsed, WhichModelError> {
  const parsed = falModelsListResponseSchema.safeParse(payload);
  return parsed.success ? ok(parsed.data) : err(schemaFailure("fal.ai catalog"));
}

export function parseFalPricingResponse(
  payload: unknown
): Result<FalPricingResponseParsed, WhichModelError> {
  const parsed = falPricingResponseSchema.safeParse(payload);
  return parsed.success ? ok(parsed.data) : err(schemaFailure("fal.ai pricing"));
}

export function parseReplicateModelsResponse(
  payload: unknown
): Result<ReplicateModelsResponseParsed, WhichModelError> {
  const parsed = replicateModelsResponseSchema.safeParse(payload);
  return parsed.success ? ok(parsed.data) : err(schemaFailure("Replicate catalog"));
}
