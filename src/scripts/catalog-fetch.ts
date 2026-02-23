import { OpenRouterCatalog } from "../catalog/openrouter.js";
import { WhichModelError } from "../types.js";

async function main(): Promise<void> {
  const catalog = new OpenRouterCatalog();
  const models = await catalog.fetch();

  console.log(`${models.length} models fetched from OpenRouter`);

  const counts = new Map<string, number>();
  for (const model of models) {
    counts.set(model.modality, (counts.get(model.modality) ?? 0) + 1);
  }

  const byModality = [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
  for (const [modality, count] of byModality) {
    console.log(`- ${modality}: ${count}`);
  }
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
