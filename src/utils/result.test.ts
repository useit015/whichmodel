import { describe, expect, it } from "vitest";
import { ExitCode, WhichModelError } from "../types.js";
import { wrapResultAsync } from "./result.js";

describe("wrapResultAsync", () => {
  it("maps synchronous throws from promiseFactory to err", async () => {
    const result = await wrapResultAsync(
      () => {
        throw new Error("sync boom");
      },
      (error) =>
        new WhichModelError(
          error instanceof Error ? error.message : "unknown",
          ExitCode.GENERAL_ERROR
        )
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe("sync boom");
      expect(result.error.exitCode).toBe(ExitCode.GENERAL_ERROR);
    }
  });

  it("maps rejected promises to err", async () => {
    const result = await wrapResultAsync(
      async () => {
        throw new Error("async boom");
      },
      (error) =>
        new WhichModelError(
          error instanceof Error ? error.message : "unknown",
          ExitCode.NETWORK_ERROR
        )
    );

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error.message).toBe("async boom");
      expect(result.error.exitCode).toBe(ExitCode.NETWORK_ERROR);
    }
  });
});
