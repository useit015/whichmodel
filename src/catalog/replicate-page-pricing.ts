import type { ReplicatePricingSource } from "../types.js";

const REPLICATE_PAGE_BASE_URL = "https://replicate.com";
const JSON_SCRIPT_PATTERN =
  /<script\b[^>]*\btype=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;
const DEFAULT_TIMEOUT_MS = 3_000;
const DEFAULT_MAX_BODY_BYTES = 2_000_000;

type PricingCategory = "text" | "image" | "time" | "audio";

export interface ReplicatePagePricingResult {
  pricing: Record<string, number>;
  source: ReplicatePricingSource;
}

export interface FetchReplicatePagePricingOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxBodyBytes?: number;
}

export async function fetchReplicatePagePricing(
  modelKey: string,
  options: FetchReplicatePagePricingOptions = {}
): Promise<ReplicatePagePricingResult | null> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
  const url = buildReplicateModelUrl(modelKey);
  if (!url || !isAllowedReplicateUrl(url)) {
    return null;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url.toString(), {
      method: "GET",
      headers: {
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }

    const html = await readResponseTextWithLimit(response, maxBodyBytes);
    if (!html) {
      return null;
    }

    return parseReplicatePagePricingFromHtml(html);
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function parseReplicatePagePricingFromHtml(
  html: string
): ReplicatePagePricingResult | null {
  const parsedScripts = extractJsonScripts(html);

  for (const script of parsedScripts) {
    const billingConfig = findBillingConfig(script);
    if (!billingConfig) {
      continue;
    }

    const pricing = normalizeBillingConfigPricing(billingConfig);
    if (pricing) {
      return {
        pricing,
        source: "billingConfig",
      };
    }
  }

  for (const script of parsedScripts) {
    const pricing = normalizePriceStringFallback(script);
    if (pricing) {
      return {
        pricing,
        source: "price-string",
      };
    }
  }

  return null;
}

function buildReplicateModelUrl(modelKey: string): URL | null {
  const parts = modelKey.split("/");
  if (parts.length !== 2) {
    return null;
  }

  const [owner, name] = parts;
  if (!owner || !name) {
    return null;
  }

  if (!isSafePathSegment(owner) || !isSafePathSegment(name)) {
    return null;
  }

  return new URL(`/${owner}/${name}`, REPLICATE_PAGE_BASE_URL);
}

function isSafePathSegment(value: string): boolean {
  return /^[a-z0-9._-]+$/i.test(value);
}

function isAllowedReplicateUrl(url: URL): boolean {
  return url.protocol === "https:" && url.hostname === "replicate.com";
}

function extractJsonScripts(html: string): unknown[] {
  const scripts: unknown[] = [];
  for (const match of html.matchAll(JSON_SCRIPT_PATTERN)) {
    const payload = match[1];
    if (!payload) {
      continue;
    }

    try {
      scripts.push(JSON.parse(payload));
    } catch {
      // Ignore malformed JSON script blocks.
    }
  }

  return scripts;
}

function findBillingConfig(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) {
    return null;
  }

  const directCandidate = value.billingConfig;
  if (isRecord(directCandidate)) {
    return directCandidate;
  }

  for (const nested of Object.values(value)) {
    if (nested && typeof nested === "object") {
      const found = findBillingConfig(nested);
      if (found) {
        return found;
      }
    }
  }

  return null;
}

function normalizeBillingConfigPricing(
  billingConfig: Record<string, unknown>
): Record<string, number> | null {
  const tiers = billingConfig.current_tiers;
  if (!Array.isArray(tiers)) {
    return null;
  }

  const normalized: Record<string, number> = {};
  let category: PricingCategory | null = null;

  for (const tier of tiers) {
    if (!isRecord(tier) || !Array.isArray(tier.prices)) {
      continue;
    }

    for (const priceEntry of tier.prices) {
      const mapped = normalizePriceEntry(priceEntry);
      if (!mapped) {
        continue;
      }

      if (category && category !== mapped.category) {
        return null;
      }
      category = mapped.category;

      if (!(mapped.key in normalized)) {
        normalized[mapped.key] = mapped.value;
      }
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

function normalizePriceStringFallback(value: unknown): Record<string, number> | null {
  if (!isRecord(value) || typeof value.price !== "string") {
    return null;
  }

  const parsedAmount = parseCurrencyAmount(value.price);
  if (parsedAmount === undefined) {
    return null;
  }

  const mapped = mapPriceTextToPricing(value.price, parsedAmount, "");
  if (!mapped) {
    return null;
  }

  return { [mapped.key]: mapped.value };
}

function normalizePriceEntry(
  entry: unknown
): { category: PricingCategory; key: string; value: number } | null {
  if (!isRecord(entry)) {
    return null;
  }

  const rawPrice = typeof entry.price === "string" ? entry.price : "";
  const amount = parseCurrencyAmount(rawPrice);
  if (amount === undefined) {
    return null;
  }

  const metric = typeof entry.metric === "string" ? entry.metric.toLowerCase() : "";
  const title = typeof entry.title === "string" ? entry.title : "";
  const metricDisplay =
    typeof entry.metric_display === "string" ? entry.metric_display : "";
  const description = typeof entry.description === "string" ? entry.description : "";
  const hint = [title, metricDisplay, description].join(" ").toLowerCase();

  return mapPriceTextToPricing(hint, amount, metric);
}

function mapPriceTextToPricing(
  text: string,
  amount: number,
  metric: string
): { category: PricingCategory; key: string; value: number } | null {
  const normalizedText = text.toLowerCase();
  const hasPerMillion = normalizedText.includes("per million");
  const hasPerThousand = normalizedText.includes("per thousand");

  const isInputToken =
    metric.includes("token_input") || /\binput token/.test(normalizedText);
  const isOutputToken =
    metric.includes("token_output") || /\boutput token/.test(normalizedText);

  if (isInputToken || isOutputToken) {
    if (!hasPerMillion && !hasPerThousand) {
      return null;
    }
    const tokenValue = hasPerThousand ? round(amount * 1000) : round(amount);
    return {
      category: "text",
      key: isInputToken ? "input_per_1m" : "output_per_1m",
      value: tokenValue,
    };
  }

  const isOutputImage =
    metric.includes("image_output") || /\boutput image/.test(normalizedText);
  if (isOutputImage) {
    if (hasPerThousand) {
      return {
        category: "image",
        key: "per_image",
        value: round(amount / 1000),
      };
    }
    return {
      category: "image",
      key: "per_image",
      value: round(amount),
    };
  }

  if (
    /\bper second\b/.test(normalizedText) ||
    /\bsecond of output video\b/.test(normalizedText)
  ) {
    return {
      category: "time",
      key: "per_second",
      value: round(amount),
    };
  }

  if (/\bper minute\b/.test(normalizedText)) {
    return {
      category: "audio",
      key: "per_minute",
      value: round(amount),
    };
  }

  return null;
}

function parseCurrencyAmount(raw: string): number | undefined {
  const match = raw.match(/\$?\s*([0-9]+(?:\.[0-9]+)?)/);
  if (!match) {
    return undefined;
  }

  const amount = Number.parseFloat(match[1] ?? "");
  if (!Number.isFinite(amount) || amount <= 0) {
    return undefined;
  }

  return amount;
}

async function readResponseTextWithLimit(
  response: Response,
  maxBodyBytes: number
): Promise<string | null> {
  const contentLength = response.headers.get("content-length");
  if (contentLength) {
    const parsed = Number.parseInt(contentLength, 10);
    if (Number.isFinite(parsed) && parsed > maxBodyBytes) {
      return null;
    }
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    return Buffer.byteLength(text, "utf8") > maxBodyBytes ? null : text;
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    if (!value) {
      continue;
    }

    totalBytes += value.byteLength;
    if (totalBytes > maxBodyBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(merged);
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
