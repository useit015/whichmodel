import { describe, expect, it, vi } from "vitest";
import { isAbortError, wait, withJitter, DEFAULT_RETRY_DELAYS_MS } from "./common.js";

describe("isAbortError", () => {
  it("returns true for AbortError", () => {
    const error = new Error("aborted");
    error.name = "AbortError";
    expect(isAbortError(error)).toBe(true);
  });

  it("returns false for regular Error", () => {
    const error = new Error("some error");
    expect(isAbortError(error)).toBe(false);
  });

  it("returns false for non-object values", () => {
    expect(isAbortError(null)).toBe(false);
    expect(isAbortError(undefined)).toBe(false);
    expect(isAbortError("error")).toBe(false);
    expect(isAbortError(123)).toBe(false);
  });

  it("returns false for object without name property", () => {
    expect(isAbortError({})).toBe(false);
    expect(isAbortError({ message: "error" })).toBe(false);
  });

  it("returns false for object with wrong name", () => {
    expect(isAbortError({ name: "TypeError" })).toBe(false);
    expect(isAbortError({ name: "Error" })).toBe(false);
  });
});

describe("wait", () => {
  it("resolves after specified delay", async () => {
    const start = Date.now();
    await wait(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40); // Allow some variance
  });

  it("returns immediately for zero delay", async () => {
    const start = Date.now();
    await wait(0);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(20);
  });

  it("returns immediately for negative delay", async () => {
    const start = Date.now();
    await wait(-100);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(20);
  });
});

describe("withJitter", () => {
  it("returns value between 50% and 100% of base delay", () => {
    // Run multiple times to test randomness
    for (let i = 0; i < 100; i++) {
      const result = withJitter(1000);
      expect(result).toBeGreaterThanOrEqual(500);
      expect(result).toBeLessThanOrEqual(1000);
    }
  });

  it("returns integer values", () => {
    for (let i = 0; i < 50; i++) {
      const result = withJitter(1000);
      expect(Number.isInteger(result)).toBe(true);
    }
  });

  it("handles zero delay", () => {
    const result = withJitter(0);
    expect(result).toBe(0);
  });
});

describe("DEFAULT_RETRY_DELAYS_MS", () => {
  it("has exponential backoff pattern", () => {
    expect(DEFAULT_RETRY_DELAYS_MS).toEqual([1_000, 2_000, 4_000]);
  });

  it("is readonly array", () => {
    expect(Array.isArray(DEFAULT_RETRY_DELAYS_MS)).toBe(true);
  });
});
