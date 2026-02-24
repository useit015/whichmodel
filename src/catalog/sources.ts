import { ExitCode, WhichModelError } from "../types.js";

export const VALID_SOURCES = [
  "openrouter",
  "fal",
  "replicate",
  "elevenlabs",
  "together",
] as const;

export const SUPPORTED_SOURCES = ["openrouter", "fal", "replicate"] as const;

const VALID_SOURCE_SET = new Set<string>(VALID_SOURCES);
const SUPPORTED_SOURCE_SET = new Set<string>(SUPPORTED_SOURCES);

export function parseSourcesCsv(sourcesArg?: string): string[] {
  if (!sourcesArg) {
    return ["openrouter"];
  }

  const sources = sourcesArg
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const normalized = sources.length > 0 ? sources : ["openrouter"];
  const invalid = normalized.filter((source) => !VALID_SOURCE_SET.has(source));
  if (invalid.length > 0) {
    throw new WhichModelError(
      `Invalid source value(s): ${invalid.join(", ")}.`,
      ExitCode.INVALID_ARGUMENTS,
      `Valid sources: ${VALID_SOURCES.join(", ")}`
    );
  }

  return normalized;
}

export function validateSupportedSourcesList(sources: string[]): void {
  const unsupported = sources.filter((source) => !SUPPORTED_SOURCE_SET.has(source));
  if (unsupported.length === 0) {
    return;
  }

  throw new WhichModelError(
    `Source(s) not yet supported: ${unsupported.join(", ")}.`,
    ExitCode.INVALID_ARGUMENTS,
    `Use --sources ${SUPPORTED_SOURCES.join(",")}`
  );
}
