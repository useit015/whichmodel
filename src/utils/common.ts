/**
 * Shared utility functions for the whichmodel CLI
 *
 * @module utils/common
 */

/**
 * Check if an error is an AbortError (from AbortController/AbortSignal)
 */
export function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: string }).name === "AbortError"
  );
}

/**
 * Wait for a specified number of milliseconds
 */
export async function wait(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Add jitter to a delay value to prevent thundering herd
 * Returns a value between 50% and 100% of the base delay
 */
export function withJitter(baseDelayMs: number): number {
  return Math.floor(baseDelayMs * (0.5 + Math.random() * 0.5));
}

/**
 * Default retry delays in milliseconds (exponential backoff)
 */
export const DEFAULT_RETRY_DELAYS_MS = [1_000, 2_000, 4_000] as const;
