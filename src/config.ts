import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ExitCode, WhichModelError, type Config } from "./types.js";

interface ConfigFile {
  apiKey?: string;
  recommenderModel?: string;
  falApiKey?: string;
  replicateApiToken?: string;
  elevenLabsApiKey?: string;
  togetherApiKey?: string;
  cacheTtl?: number;
  replicatePagePricing?: boolean;
  replicatePriceTtlSeconds?: number;
  replicatePriceMaxStaleSeconds?: number;
  replicatePriceFetchBudget?: number;
  replicatePriceConcurrency?: number;
}

export const DEFAULT_RECOMMENDER_MODEL = "deepseek/deepseek-v3.2";
export const DEFAULT_CACHE_TTL_SECONDS = 3600;
export const DEFAULT_REPLICATE_PAGE_PRICING = false;
export const DEFAULT_REPLICATE_PRICE_TTL_SECONDS = 86_400;
export const DEFAULT_REPLICATE_PRICE_MAX_STALE_SECONDS = 604_800;
export const DEFAULT_REPLICATE_PRICE_FETCH_BUDGET = 40;
export const DEFAULT_REPLICATE_PRICE_CONCURRENCY = 4;

export function getConfig(): Config {
  const configFile = loadConfigFile();

  return {
    apiKey: process.env.OPENROUTER_API_KEY ?? configFile?.apiKey ?? "",
    recommenderModel:
      process.env.WHICHMODEL_MODEL ??
      configFile?.recommenderModel ??
      DEFAULT_RECOMMENDER_MODEL,
    cacheTtl: parseIntegerEnv("WHICHMODEL_CACHE_TTL") ?? configFile?.cacheTtl ?? DEFAULT_CACHE_TTL_SECONDS,
    falApiKey: process.env.FAL_API_KEY ?? configFile?.falApiKey,
    replicateApiToken: process.env.REPLICATE_API_TOKEN ?? configFile?.replicateApiToken,
    elevenLabsApiKey: process.env.ELEVENLABS_API_KEY ?? configFile?.elevenLabsApiKey,
    togetherApiKey: process.env.TOGETHER_API_KEY ?? configFile?.togetherApiKey,
    replicatePagePricing:
      parseBooleanEnv("WHICHMODEL_REPLICATE_PAGE_PRICING") ??
      configFile?.replicatePagePricing ??
      DEFAULT_REPLICATE_PAGE_PRICING,
    replicatePriceTtlSeconds: resolveIntegerSetting(
      "WHICHMODEL_REPLICATE_PRICE_TTL_SECONDS",
      configFile?.replicatePriceTtlSeconds,
      DEFAULT_REPLICATE_PRICE_TTL_SECONDS,
      1
    ),
    replicatePriceMaxStaleSeconds: resolveIntegerSetting(
      "WHICHMODEL_REPLICATE_PRICE_MAX_STALE_SECONDS",
      configFile?.replicatePriceMaxStaleSeconds,
      DEFAULT_REPLICATE_PRICE_MAX_STALE_SECONDS,
      1
    ),
    replicatePriceFetchBudget: resolveIntegerSetting(
      "WHICHMODEL_REPLICATE_PRICE_FETCH_BUDGET",
      configFile?.replicatePriceFetchBudget,
      DEFAULT_REPLICATE_PRICE_FETCH_BUDGET,
      0
    ),
    replicatePriceConcurrency: resolveIntegerSetting(
      "WHICHMODEL_REPLICATE_PRICE_CONCURRENCY",
      configFile?.replicatePriceConcurrency,
      DEFAULT_REPLICATE_PRICE_CONCURRENCY,
      1
    ),
  };
}

export function validateConfig(config: Config): string | null {
  if (!config.apiKey) {
    return [
      "Error: OPENROUTER_API_KEY is not set.",
      "",
      "Get your API key at: https://openrouter.ai/keys",
      "Then run:",
      "  export OPENROUTER_API_KEY=sk-or-...",
    ].join("\n");
  }

  if (!config.apiKey.startsWith("sk-or-v1-")) {
    return "Warning: API key doesn't look like an OpenRouter key (should start with sk-or-v1-)";
  }

  return null;
}

export function requireApiKey(config: Config): void {
  if (!config.apiKey) {
    throw new WhichModelError(
      "OPENROUTER_API_KEY is not set.",
      ExitCode.NO_API_KEY,
      "Set OPENROUTER_API_KEY and retry."
    );
  }
}

function loadConfigFile(): ConfigFile | null {
  const configPath = process.env.WHICHMODEL_CONFIG ?? getDefaultConfigPath();

  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw) as ConfigFile;
    return parsed;
  } catch {
    return null;
  }
}

function getDefaultConfigPath(): string {
  if (process.platform === "win32") {
    const appData = process.env.APPDATA ?? os.homedir();
    return path.join(appData, "whichmodel", "config.json");
  }

  return path.join(os.homedir(), ".config", "whichmodel", "config.json");
}

function parseIntegerEnv(name: string): number | undefined {
  const value = process.env[name];
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBooleanEnv(name: string): boolean | undefined {
  const value = process.env[name];
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return undefined;
}

function resolveIntegerSetting(
  envName: string,
  fileValue: number | undefined,
  fallback: number,
  min: number
): number {
  const envValue = parseIntegerEnv(envName);
  if (typeof envValue === "number" && envValue >= min) {
    return envValue;
  }

  const configValue =
    typeof fileValue === "number" && Number.isFinite(fileValue) ? Math.trunc(fileValue) : undefined;
  if (typeof configValue === "number" && configValue >= min) {
    return configValue;
  }

  return fallback;
}
