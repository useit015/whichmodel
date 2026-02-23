import { FalCatalog } from "../catalog/fal.js";
import { OpenRouterCatalog } from "../catalog/openrouter.js";
import { getConfig } from "../config.js";
import { ExitCode, WhichModelError } from "../types.js";

async function main(): Promise<void> {
  const sources = parseSourcesArg(process.argv.slice(2));
  const config = getConfig();

  const modelsBySource = await Promise.all(
    sources.map(async (source) => {
      if (source === "openrouter") {
        const models = await new OpenRouterCatalog().fetch();
        return { source, models };
      }

      if (source === "fal") {
        const models = await new FalCatalog({ apiKey: config.falApiKey }).fetch();
        return { source, models };
      }

      throw new WhichModelError(
        `Unsupported source '${source}'.`,
        ExitCode.INVALID_ARGUMENTS,
        "Use --sources openrouter,fal"
      );
    })
  );

  const models = modelsBySource.flatMap(({ models: sourceModels }) => sourceModels);
  const sourceSummary = modelsBySource
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

function parseSourcesArg(args: string[]): string[] {
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

  const sources = rawValue
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return sources.length > 0 ? sources : ["openrouter"];
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
