import { err, ok, Result, ResultAsync } from "neverthrow";
import { ExitCode, WhichModelError } from "../types.js";

export function toWhichModelError(
  error: unknown,
  fallbackMessage: string,
  exitCode: ExitCode,
  recoveryHint?: string
): WhichModelError {
  if (error instanceof WhichModelError) {
    return error;
  }

  if (error instanceof Error && error.message) {
    return new WhichModelError(`${fallbackMessage}: ${error.message}`, exitCode, recoveryHint);
  }

  return new WhichModelError(fallbackMessage, exitCode, recoveryHint);
}

export function wrapResult<T>(
  fn: () => T,
  onError: (error: unknown) => WhichModelError
): Result<T, WhichModelError> {
  try {
    return ok(fn());
  } catch (error) {
    return err(onError(error));
  }
}

export function wrapResultAsync<T>(
  promiseFactory: () => Promise<T>,
  onError: (error: unknown) => WhichModelError
): ResultAsync<T, WhichModelError> {
  return ResultAsync.fromPromise(Promise.resolve().then(promiseFactory), onError);
}
