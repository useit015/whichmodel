import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_CACHE_TTL_SECONDS,
  DEFAULT_RECOMMENDER_MODEL,
  getConfig,
  requireApiKey,
  validateConfig,
} from "./config.js";
import { ExitCode } from "./types.js";

const ENV_KEYS = [
  "OPENROUTER_API_KEY",
  "WHICHMODEL_MODEL",
  "WHICHMODEL_CACHE_TTL",
  "WHICHMODEL_CONFIG",
] as const;

const originalEnv: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};
for (const key of ENV_KEYS) {
  originalEnv[key] = process.env[key];
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

describe("getConfig", () => {
  it("loads config from env", () => {
    process.env.WHICHMODEL_CONFIG = "/tmp/whichmodel-config-does-not-exist.json";
    process.env.OPENROUTER_API_KEY = "sk-or-test";
    process.env.WHICHMODEL_MODEL = "openai/gpt-4o-mini";
    process.env.WHICHMODEL_CACHE_TTL = "120";

    const config = getConfig();
    expect(config.apiKey).toBe("sk-or-test");
    expect(config.recommenderModel).toBe("openai/gpt-4o-mini");
    expect(config.cacheTtl).toBe(120);
  });

  it("uses defaults when env is missing", () => {
    process.env.WHICHMODEL_CONFIG = "/tmp/whichmodel-config-does-not-exist.json";
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.WHICHMODEL_MODEL;
    delete process.env.WHICHMODEL_CACHE_TTL;

    const config = getConfig();
    expect(config.apiKey).toBe("");
    expect(config.recommenderModel).toBe(DEFAULT_RECOMMENDER_MODEL);
    expect(config.cacheTtl).toBe(DEFAULT_CACHE_TTL_SECONDS);
  });
});

describe("validateConfig", () => {
  it("returns error when API key is missing", () => {
    const result = validateConfig({ apiKey: "", recommenderModel: "x", cacheTtl: 1 });
    expect(result).toContain("OPENROUTER_API_KEY is not set");
  });

  it("returns null for valid API key", () => {
    const result = validateConfig({
      apiKey: "sk-or-valid",
      recommenderModel: "x",
      cacheTtl: 1,
    });
    expect(result).toBeNull();
  });
});

describe("requireApiKey", () => {
  it("throws code 3 when missing", () => {
    expect(() =>
      requireApiKey({ apiKey: "", recommenderModel: "x", cacheTtl: 1 })
    ).toThrowError(expect.objectContaining({ exitCode: ExitCode.NO_API_KEY }));
  });
});
