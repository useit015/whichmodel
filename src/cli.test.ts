import { describe, expect, it } from "vitest";
import {
  parseConstraints,
  parseSources,
  validateSupportedSources,
  validateTask,
} from "./cli.js";
import { ExitCode } from "./types.js";

describe("validateTask", () => {
  it("throws INVALID_ARGUMENTS when task is missing", () => {
    expect(() => validateTask("")).toThrowError(
      expect.objectContaining({
        exitCode: ExitCode.INVALID_ARGUMENTS,
        message: "Task description required.",
      })
    );
  });

  it("throws INVALID_ARGUMENTS when task is too long", () => {
    const veryLongTask = "a".repeat(2001);
    expect(() => validateTask(veryLongTask)).toThrowError(
      expect.objectContaining({
        exitCode: ExitCode.INVALID_ARGUMENTS,
        message: "Task description too long (2001 characters).",
      })
    );
  });
});

describe("parseConstraints", () => {
  it("parses valid constraints", () => {
    expect(
      parseConstraints({
        modality: "text",
        maxPrice: "0.05",
        minContext: "100000",
        minResolution: "1024x1024",
        exclude: "foo,bar",
      })
    ).toEqual({
      modality: "text",
      maxPrice: 0.05,
      minContext: 100000,
      minResolution: "1024x1024",
      exclude: ["foo", "bar"],
    });
  });

  it("rejects invalid modality values", () => {
    expect(() => parseConstraints({ modality: "unknown" })).toThrowError(
      expect.objectContaining({
        exitCode: ExitCode.INVALID_ARGUMENTS,
      })
    );
  });

  it("rejects negative max price", () => {
    expect(() => parseConstraints({ maxPrice: "-1" })).toThrowError(
      expect.objectContaining({
        exitCode: ExitCode.INVALID_ARGUMENTS,
      })
    );
  });

  it("rejects non-integer min context", () => {
    expect(() => parseConstraints({ minContext: "10.5" })).toThrowError(
      expect.objectContaining({
        exitCode: ExitCode.INVALID_ARGUMENTS,
      })
    );
  });

  it("rejects invalid min resolution format", () => {
    expect(() => parseConstraints({ minResolution: "1024" })).toThrowError(
      expect.objectContaining({
        exitCode: ExitCode.INVALID_ARGUMENTS,
      })
    );
  });
});

describe("parseSources", () => {
  it("returns openrouter by default", () => {
    expect(parseSources()).toEqual(["openrouter"]);
  });

  it("normalizes comma-separated sources", () => {
    expect(parseSources(" OpenRouter , FAL ")).toEqual(["openrouter", "fal"]);
  });

  it("rejects invalid source values", () => {
    expect(() => parseSources("openrouter,badsource")).toThrowError(
      expect.objectContaining({
        exitCode: ExitCode.INVALID_ARGUMENTS,
      })
    );
  });
});

describe("validateSupportedSources", () => {
  it("accepts supported phase 1 sources", () => {
    expect(() => validateSupportedSources(["openrouter"])).not.toThrow();
  });

  it("rejects unsupported phase 1 sources", () => {
    expect(() => validateSupportedSources(["openrouter", "fal"])).toThrowError(
      expect.objectContaining({
        exitCode: ExitCode.INVALID_ARGUMENTS,
      })
    );
  });
});
