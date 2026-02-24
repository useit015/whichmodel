import { FalCatalog } from "../catalog/fal.js";
import { mergeCatalogModels } from "../catalog/merge.js";
import { OpenRouterCatalog } from "../catalog/openrouter.js";
import { ReplicateCatalog } from "../catalog/replicate.js";
import { parseSourcesCsv, validateSupportedSourcesList } from "../catalog/sources.js";
import { getConfig } from "../config.js";
import { wrapResultAsync } from "../utils/result.js";
import { ExitCode, WhichModelError, type ModelEntry } from "../types.js";

async function main(): Promise<void> {
  const sources = parseSourcesArg(process.argv.slice(2));
  const config = getConfig();

  const fetchers = sources.map((source) => ({
    source,
    fetch: async () => {
      if (source === "openrouter") {
        return new OpenRouterCatalog().fetch();
      }
      if (source === "fal") {
        return new FalCatalog({ apiKey: config.falApiKey }).fetch();
      }
      if (source === "replicate") {
        return new ReplicateCatalog({ apiToken: config.replicateApiToken }).fetch();
      }

      throw new WhichModelError(
        `Unsupported source '${source}'.`,
        ExitCode.INVALID_ARGUMENTS,
        "Use --sources openrouter,fal,replicate"
      );
    },
  }));

  const settledResult = await wrapResultAsync(
    () => Promise.allSettled(fetchers.map((fetcher) => fetcher.fetch())),
    (error) =>
      new WhichModelError(
        error instanceof Error ? error.message : "Failed to fetch source catalogs.",
        ExitCode.NETWORK_ERROR,
        "Retry in a few minutes."
      )
  );
  if (settledResult.isErr()) {
    throw settledResult.error;
  }
  const settled = settledResult.value;
  const successful: Array<{ source: string; models: ModelEntry[] }> = [];
  const failed: Array<{ source: string; message: string }> = [];

  settled.forEach((result, index) => {
    const source = fetchers[index]?.source ?? "unknown";
    if (result.status === "fulfilled") {
      successful.push({ source, models: result.value });
      return;
    }

    const reason = result.reason;
    failed.push({
      source,
      message: reason instanceof Error ? reason.message : String(reason),
    });
  });

  if (successful.length === 0) {
    const attempted = failed.map((item) => `  ✗ ${item.source}: ${item.message}`).join("\n");
    throw new WhichModelError(
      "All catalog sources failed to respond.",
      ExitCode.NO_MODELS_FOUND,
      [
        "Attempted sources:",
        attempted || "  (none)",
      ].join("\n")
    );
  }

  if (failed.length > 0) {
    const attempted = failed.map((item) => `  ✗ ${item.source}: ${item.message}`).join("\n");
    console.error(
      [
        "Warning: Some catalog sources failed. Continuing with available sources.",
        attempted,
      ].join("\n")
    );
  }

  const models = mergeCatalogModels(successful.map((item) => item.models));
  const sourceSummary = successful
    .map(({ source, models: sourceModels }) => `${source}=${sourceModels.length}`)
    .join(", ");

  console.log(`${models.length} models fetched (${sourceSummary})`);

  const counts = new Map<string, number>();
  for (const model of models) {
    counts.set(model.modality, (counts.get(model.modality) ?? 0) + 1);
  }

  const byModality = [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [modality, count] of byModality) {
    console.log(`- ${modality}: ${count}`);
  }
}

export function parseSourcesArg(args: string[]): string[] {
  const sourceFlagIndex = args.findIndex((arg) => arg === "--sources");
  if (sourceFlagIndex < 0) {
    return ["openrouter"];
  }

  const rawValue = args[sourceFlagIndex + 1];
  if (!rawValue) {
    throw new WhichModelError(
      "Missing value for --sources.",
      ExitCode.INVALID_ARGUMENTS,
      "Example: --sources openrouter,fal"
    );
  }

  const normalizedSources = parseSourcesCsv(rawValue);
  validateSupportedSourcesList(normalizedSources);
  return normalizedSources;
}

void main().catch((error: unknown) => {
  if (error instanceof WhichModelError) {
    console.error(`Error: ${error.message}`);
    if (error.recoveryHint) {
      console.error(error.recoveryHint);
    }
    process.exit(error.exitCode);
  }

  const detail = error instanceof Error ? error.message : "Unknown error";
  console.error(`Error: ${detail}`);
  process.exit(1);
});
