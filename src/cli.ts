import { Command } from "commander";
import ora from "ora";
import { getCacheStats, invalidateCache, formatCacheStats } from "./catalog/cache.js";
import { computeStats, formatStatsTerminal, formatStatsJSON } from "./commands/stats.js";
import { filterAndSortModels, formatListTerminal, formatListJSON } from "./commands/list.js";
import { parseWorkloadDescription, estimateCost, formatCostEstimate } from "./estimation/cost-calculator.js";
import {
  findModelById,
  callCompareLLM,
  formatCompareTerminal,
  formatCompareJSON,
} from "./commands/compare.js";
import {
  updateRecommenderModel,
  formatRecommenderUpdate,
} from "./commands/update-recommender.js";
import { FalCatalog } from "./catalog/fal.js";
import { mergeCatalogModels } from "./catalog/merge.js";
import { OpenRouterCatalog } from "./catalog/openrouter.js";
import { ReplicateCatalog } from "./catalog/replicate.js";
import {
  DEFAULT_RECOMMENDER_MODEL,
  getConfig,
  requireApiKey,
  validateConfig,
} from "./config.js";
import { toJsonOutput } from "./formatter/json.js";
import { formatTerminal } from "./formatter/terminal.js";
import { recommend } from "./recommender/index.js";
import {
  ExitCode,
  WhichModelError,
  type Constraints,
  type Config,
  type Modality,
  type ModelEntry,
} from "./types.js";

const VALID_MODALITIES: Modality[] = [
  "text",
  "image",
  "video",
  "audio_tts",
  "audio_stt",
  "audio_generation",
  "vision",
  "embedding",
  "multimodal",
];

const VALID_SOURCES = ["openrouter", "fal", "replicate", "elevenlabs", "together"] as const;
const SUPPORTED_SOURCES = ["openrouter", "fal", "replicate"] as const;
const VALID_SOURCE_SET = new Set<string>(VALID_SOURCES);
const SUPPORTED_SOURCE_SET = new Set<string>(SUPPORTED_SOURCES);
const MAX_TASK_LENGTH = 2000;

interface RecommendCLIOptions {
  json?: boolean;
  modality?: string;
  model?: string;
  maxPrice?: string;
  minContext?: string;
  minResolution?: string;
  exclude?: string;
  sources?: string;
  estimate?: string;
  verbose?: boolean;
  color?: boolean;
  noCache?: boolean;
  updateRecommender?: boolean;
}

const program = new Command();

program
  .name("whichmodel")
  .description("Tell me what you want to build. I'll tell you which AI model to use.")
  .version("0.1.0")
  .argument("[task...]", "Task description")
  .option("--json", "Output as JSON")
  .option("-m, --modality <type>", "Force a specific modality")
  .option("--model <id>", "Override recommender LLM")
  .option("--max-price <number>", "Maximum price per unit in USD")
  .option("--min-context <tokens>", "Minimum context length in tokens")
  .option("--min-resolution <WxH>", "Minimum resolution")
  .option("--exclude <ids>", "Exclude model IDs (comma-separated)")
  .option("--sources <list>", "Catalog sources (comma-separated)")
  .option("--estimate <workload>", "Workload description for cost estimation")
  .option("-v, --verbose", "Show extra recommendation metadata")
  .option("--no-color", "Disable colored output")
  .option("--no-cache", "Bypass cache and fetch fresh catalog")
  .option("--update-recommender", "Update the default recommender model")
  .action(async (taskWords: string[], options: RecommendCLIOptions) => {
    const runStartedAt = Date.now();
    try {
      // Handle --update-recommender flag first (special case)
      if (options.updateRecommender) {
        const config = getConfig();
        requireApiKey(config);

        const spinner = ora("Analyzing models for best recommender...").start();
        const sources = parseSources(options.sources);
        const models = await fetchCatalogModels(sources, config, options.noCache ?? false);
        spinner.stop();

        const update = await updateRecommenderModel(
          models,
          config.recommenderModel ?? DEFAULT_RECOMMENDER_MODEL
        );
        console.log(formatRecommenderUpdate(update));
        return;
      }

      // Normal recommendation flow - validate task first
      const task = taskWords.join(" ").trim();
      validateTask(task);
      const constraints = parseConstraints(options);
      const sources = parseSources(options.sources);
      validateSupportedSources(sources);

      const config = getConfig();
      requireApiKey(config);

      const validationMessage = validateConfig(config);
      if (validationMessage?.startsWith("Warning:")) {
        console.error(validationMessage);
      }

      const spinner = ora("Fetching model catalog...").start();
      const catalogFetchStartedAt = Date.now();
      const allModels = await fetchCatalogModels(sources, config, options.noCache ?? false);
      const catalogFetchLatencyMs = Date.now() - catalogFetchStartedAt;
      let models = applyExclusions(allModels, options.exclude);
      models = applyModelConstraints(models, constraints);

      if (models.length === 0) {
        throw new WhichModelError(
          "No models found after applying filters.",
          ExitCode.NO_MODELS_FOUND,
          "Relax --max-price/--min-context filters or remove exclusions."
        );
      }

      spinner.text = "Analyzing task and generating recommendations...";

      const result = await recommend({
        task,
        models,
        apiKey: config.apiKey,
        recommenderModel: options.model ?? config.recommenderModel ?? DEFAULT_RECOMMENDER_MODEL,
        constraints,
        catalogSources: sources,
      });

      spinner.stop();

      // Apply cost estimation if --estimate flag is provided
      if (options.estimate) {
        try {
          const workload = parseWorkloadDescription(options.estimate);
          const tiers = ["cheapest", "balanced", "best"] as const;
          for (const tier of tiers) {
            const modelId = result.recommendation.recommendations[tier].id;
            const model = allModels.find((m) => m.id === modelId);
            if (model) {
              const costEst = estimateCost(model, workload);
              result.recommendation.recommendations[tier].estimatedCost = formatCostEstimate(costEst);
            }
          }
        } catch {
          // If parsing fails, keep the LLM-generated estimate
        }
      }

      if (options.json) {
        console.log(
          JSON.stringify(toJsonOutput(task, result.recommendation, result.meta), null, 2)
        );
        return;
      }

      const output = formatTerminal(result.recommendation, {
        recommenderModel: result.meta.recommenderModel,
        cost: result.meta.recommendationCostUsd,
        promptTokens: result.meta.promptTokens,
        completionTokens: result.meta.completionTokens,
        verbose: Boolean(options.verbose),
        noColor: options.color === false || Boolean(process.env.NO_COLOR),
        recommendationLatencyMs: result.meta.recommendationLatencyMs,
        catalogFetchLatencyMs,
        totalLatencyMs: Date.now() - runStartedAt,
      });
      console.log(output);
    } catch (error) {
      handleCLIError(error);
    }
  });

program
  .command("compare <modelA> <modelB>")
  .description("Compare two models head-to-head for a task")
  .requiredOption("--task <description>", "Task to compare for")
  .option("--json", "Output as JSON")
  .option("-v, --verbose", "Show detailed comparison")
  .action(async (modelA: string, modelB: string, options: { task: string; json?: boolean; verbose?: boolean }) => {
    try {
      const config = getConfig();
      requireApiKey(config);

      const spinner = ora("Fetching catalog...").start();
      const sources = parseSources(undefined); // Use default sources
      const models = await fetchCatalogModels(sources, config);
      spinner.stop();

      // Find the models
      const modelAEntry = findModelById(models, modelA);
      const modelBEntry = findModelById(models, modelB);

      if (!modelAEntry) {
        throw new WhichModelError(
          `Model not found: ${modelA}`,
          ExitCode.INVALID_ARGUMENTS,
          "Use 'whichmodel list' to see available models."
        );
      }

      if (!modelBEntry) {
        throw new WhichModelError(
          `Model not found: ${modelB}`,
          ExitCode.INVALID_ARGUMENTS,
          "Use 'whichmodel list' to see available models."
        );
      }

      // Check if comparing the same model
      if (modelAEntry.id === modelBEntry.id) {
        console.log(`Both model IDs resolve to the same model: ${modelAEntry.name}`);
        console.log(`ID: ${modelAEntry.id}`);
        return;
      }

      spinner.start("Comparing models...");

      const result = await callCompareLLM(
        options.task,
        modelAEntry,
        modelBEntry,
        config.apiKey,
        config.recommenderModel ?? DEFAULT_RECOMMENDER_MODEL
      );

      spinner.stop();

      if (options.json) {
        console.log(JSON.stringify(formatCompareJSON(result, modelAEntry, modelBEntry), null, 2));
      } else {
        console.log(
          formatCompareTerminal(result, modelAEntry, modelBEntry, {
            modelA: modelAEntry.id,
            modelB: modelBEntry.id,
            task: options.task,
            apiKey: config.apiKey,
            recommenderModel: config.recommenderModel ?? DEFAULT_RECOMMENDER_MODEL,
            verbose: options.verbose,
          })
        );
      }
    } catch (error) {
      handleCLIError(error);
    }
  });

program
  .command("list")
  .description("List available models")
  .option("--modality <type>", "Filter by modality")
  .option("--source <name>", "Filter by source")
  .option("--sort <field>", "Sort by field (price, name, context)", "price")
  .option("--limit <n>", "Limit results", "50")
  .option("--json", "Output as JSON")
  .action(async (options: { modality?: string; source?: string; sort: string; limit: string; json?: boolean }) => {
    try {
      const config = getConfig();
      requireApiKey(config);

      // Validate modality
      if (options.modality && !VALID_MODALITIES.includes(options.modality as Modality)) {
        throw new WhichModelError(
          `Invalid modality '${options.modality}'.`,
          ExitCode.INVALID_ARGUMENTS,
          `Valid modalities: ${VALID_MODALITIES.join(", ")}`
        );
      }

      // Validate sort
      const validSorts = ["price", "name", "context"] as const;
      if (!validSorts.includes(options.sort as typeof validSorts[number])) {
        throw new WhichModelError(
          `Invalid sort field '${options.sort}'.`,
          ExitCode.INVALID_ARGUMENTS,
          `Valid sorts: ${validSorts.join(", ")}`
        );
      }

      // Parse limit
      const limit = Number.parseInt(options.limit, 10);
      if (!Number.isFinite(limit) || limit <= 0) {
        throw new WhichModelError(
          `Invalid limit '${options.limit}'.`,
          ExitCode.INVALID_ARGUMENTS,
          "Limit must be a positive integer."
        );
      }

      const spinner = ora("Fetching catalog...").start();
      const sources = options.source ? [options.source] : parseSources(undefined);
      const models = await fetchCatalogModels(sources, config);
      spinner.stop();

      const listOptions = {
        modality: options.modality as Modality | undefined,
        source: options.source,
        sort: options.sort as "price" | "name" | "context",
        limit,
      };

      const items = filterAndSortModels(models, listOptions);

      if (options.json) {
        console.log(JSON.stringify(formatListJSON(items), null, 2));
      } else {
        console.log(formatListTerminal(items, models.length, listOptions));
      }
    } catch (error) {
      handleCLIError(error);
    }
  });

program
  .command("stats")
  .description("Show catalog statistics")
  .option("--json", "Output as JSON")
  .action(async (options: { json?: boolean }) => {
    try {
      const config = getConfig();
      requireApiKey(config);

      const spinner = ora("Fetching catalog...").start();
      const sources = parseSources(undefined); // Use default sources
      const models = await fetchCatalogModels(sources, config);
      spinner.stop();

      const stats = computeStats(models, config);

      if (options.json) {
        console.log(JSON.stringify(formatStatsJSON(stats), null, 2));
      } else {
        console.log(formatStatsTerminal(stats));
      }
    } catch (error) {
      handleCLIError(error);
    }
  });

program
  .command("cache")
  .description("Manage catalog cache")
  .option("--stats", "Show cache statistics")
  .option("--clear", "Clear all cached catalog data")
  .action(async (options: { stats?: boolean; clear?: boolean }) => {
    try {
      if (options.clear) {
        await invalidateCache();
        console.log("Cache cleared.");
        return;
      }

      // Default to showing stats
      const stats = await getCacheStats();
      console.log(formatCacheStats(stats));
    } catch (error) {
      handleCLIError(error);
    }
  });

export { program };
export { validateTask, parseConstraints, parseSources, validateSupportedSources };
export { fetchCatalogModelsFromFetchers };

function validateTask(task: string): void {
  if (!task) {
    throw new WhichModelError(
      "Task description required.",
      ExitCode.INVALID_ARGUMENTS,
      [
        "Usage: whichmodel <task>",
        "",
        "Examples:",
        '  whichmodel "summarize legal contracts"',
        '  whichmodel "generate product photos"',
        "",
        "Run 'whichmodel --help' for more information.",
      ].join("\n")
    );
  }

  if (task.length > MAX_TASK_LENGTH) {
    throw new WhichModelError(
      `Task description too long (${task.length} characters).`,
      ExitCode.INVALID_ARGUMENTS,
      [
        "Please shorten your description to under 2000 characters.",
        "Focus on the core requirements rather than detailed context.",
      ].join("\n")
    );
  }
}

function parseConstraints(options: RecommendCLIOptions): Constraints {
  const constraints: Constraints = {};

  if (options.modality) {
    if (!VALID_MODALITIES.includes(options.modality as Modality)) {
      throw new WhichModelError(
        `Invalid modality '${options.modality}'.`,
        ExitCode.INVALID_ARGUMENTS,
        [
          "Valid modalities:",
          ...VALID_MODALITIES.map((modality) => `  ${modality}`),
          "",
          'Example: whichmodel "generate images" --modality image',
        ].join("\n")
      );
    }

    constraints.modality = options.modality as Modality;
  }

  if (options.maxPrice !== undefined) {
    const parsedPrice = Number(options.maxPrice);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      throw new WhichModelError(
        `Invalid price format '${options.maxPrice}'.`,
        ExitCode.INVALID_ARGUMENTS,
        [
          "--max-price expects a non-negative number in USD.",
          "",
          "Example: --max-price 0.05",
        ].join("\n")
      );
    }
    constraints.maxPrice = parsedPrice;
  }

  if (options.minContext !== undefined) {
    if (!/^\d+$/.test(options.minContext)) {
      throw new WhichModelError(
        `Invalid min context '${options.minContext}'.`,
        ExitCode.INVALID_ARGUMENTS,
        "--min-context expects a positive integer, e.g. --min-context 200000"
      );
    }
    const parsedContext = Number.parseInt(options.minContext, 10);
    if (!Number.isFinite(parsedContext) || parsedContext <= 0) {
      throw new WhichModelError(
        `Invalid min context '${options.minContext}'.`,
        ExitCode.INVALID_ARGUMENTS,
        "--min-context expects a positive integer, e.g. --min-context 200000"
      );
    }
    constraints.minContext = parsedContext;
  }

  if (options.minResolution) {
    if (!/^\d+x\d+$/i.test(options.minResolution)) {
      throw new WhichModelError(
        `Invalid resolution format '${options.minResolution}'.`,
        ExitCode.INVALID_ARGUMENTS,
        [
          "--min-resolution expects WIDTHxHEIGHT format.",
          "",
          "Examples:",
          "  --min-resolution 1024x1024",
          "  --min-resolution 1920x1080",
        ].join("\n")
      );
    }

    constraints.minResolution = options.minResolution;
  }

  if (options.exclude) {
    constraints.exclude = options.exclude
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return constraints;
}

function applyExclusions(models: ModelEntry[], excludeArg?: string): ModelEntry[] {
  if (!excludeArg) {
    return models;
  }

  const patterns = excludeArg
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (patterns.length === 0) {
    return models;
  }

  return models.filter((model) => {
    return !patterns.some((pattern) => {
      if (pattern.endsWith("*")) {
        return model.id.startsWith(pattern.slice(0, -1));
      }
      return model.id === pattern;
    });
  });
}

function applyModelConstraints(models: ModelEntry[], constraints: Constraints): ModelEntry[] {
  return models.filter((model) => {
    if (constraints.modality && model.modality !== constraints.modality) {
      return false;
    }

    if (typeof constraints.minContext === "number") {
      if ((model.contextLength ?? 0) < constraints.minContext) {
        return false;
      }
    }

    if (typeof constraints.maxPrice === "number") {
      if (getPrimaryPrice(model) > constraints.maxPrice) {
        return false;
      }
    }

    if (constraints.minResolution && model.maxResolution) {
      if (!isResolutionAtLeast(model.maxResolution, constraints.minResolution)) {
        return false;
      }
    }

    return true;
  });
}

function getPrimaryPrice(model: ModelEntry): number {
  switch (model.pricing.type) {
    case "text":
      return model.pricing.promptPer1mTokens;
    case "image":
      return (
        model.pricing.perImage ??
        model.pricing.perMegapixel ??
        model.pricing.perStep ??
        Number.POSITIVE_INFINITY
      );
    case "video":
      return model.pricing.perSecond ?? model.pricing.perGeneration ?? Number.POSITIVE_INFINITY;
    case "audio":
      return (
        model.pricing.perMinute ??
        model.pricing.perCharacter ??
        model.pricing.perSecond ??
        Number.POSITIVE_INFINITY
      );
    case "embedding":
      return model.pricing.per1mTokens;
    default:
      return Number.POSITIVE_INFINITY;
  }
}

function isResolutionAtLeast(actual: string, minimum: string): boolean {
  const actualParts = actual.toLowerCase().split("x");
  const minimumParts = minimum.toLowerCase().split("x");
  const actualW = Number(actualParts[0] ?? Number.NaN);
  const actualH = Number(actualParts[1] ?? Number.NaN);
  const minimumW = Number(minimumParts[0] ?? Number.NaN);
  const minimumH = Number(minimumParts[1] ?? Number.NaN);
  if (
    !Number.isFinite(actualW) ||
    !Number.isFinite(actualH) ||
    !Number.isFinite(minimumW) ||
    !Number.isFinite(minimumH)
  ) {
    return false;
  }

  return actualW >= minimumW && actualH >= minimumH;
}

function parseSources(sourcesArg?: string): string[] {
  if (!sourcesArg) {
    return ["openrouter"];
  }

  const sources = sourcesArg
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  const invalidSources = sources.filter((source) => !VALID_SOURCE_SET.has(source));
  if (invalidSources.length > 0) {
    throw new WhichModelError(
      `Invalid source value(s): ${invalidSources.join(", ")}.`,
      ExitCode.INVALID_ARGUMENTS,
      `Valid sources: ${VALID_SOURCES.join(", ")}`
    );
  }

  return sources.length > 0 ? sources : ["openrouter"];
}

function validateSupportedSources(sources: string[]): void {
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

async function fetchCatalogModels(
  sources: string[],
  config: Config,
  noCache: boolean = false
): Promise<ModelEntry[]> {
  const sourceFetchers: SourceFetcher[] = [];
  for (const source of sources) {
    if (source === "openrouter") {
      sourceFetchers.push({
        source,
        fetch: async () => new OpenRouterCatalog({ noCache, cacheTtl: config.cacheTtl }).fetch(),
      });
      continue;
    }

    if (source === "fal") {
      sourceFetchers.push({
        source,
        fetch: async () =>
          new FalCatalog({ apiKey: config.falApiKey, noCache, cacheTtl: config.cacheTtl }).fetch(),
      });
      continue;
    }

    if (source === "replicate") {
      sourceFetchers.push({
        source,
        fetch: async () =>
          new ReplicateCatalog({
            apiToken: config.replicateApiToken,
            noCache,
            cacheTtl: config.cacheTtl,
          }).fetch(),
      });
      continue;
    }

    throw new WhichModelError(
      `Unsupported source '${source}'.`,
      ExitCode.INVALID_ARGUMENTS,
      `Use --sources ${SUPPORTED_SOURCES.join(",")}`
    );
  }

  return fetchCatalogModelsFromFetchers(sourceFetchers, sources);
}

interface SourceFetcher {
  source: string;
  fetch: () => Promise<ModelEntry[]>;
}

async function fetchCatalogModelsFromFetchers(
  fetchers: SourceFetcher[],
  requestedSources: string[],
  warn: (message: string) => void = (message) => {
    console.error(message);
  }
): Promise<ModelEntry[]> {
  const settled = await Promise.allSettled(fetchers.map((fetcher) => fetcher.fetch()));
  const successfulModels: ModelEntry[][] = [];
  const failures: Array<{ source: string; message: string }> = [];

  settled.forEach((result, index) => {
    const source = fetchers[index]?.source ?? "unknown";
    if (result.status === "fulfilled") {
      successfulModels.push(result.value);
      return;
    }

    const reason = result.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    failures.push({ source, message });
  });

  if (successfulModels.length === 0) {
    if (failures.length === 1 && settled.length === 1) {
      const reason = settled[0];
      if (reason && reason.status === "rejected" && reason.reason instanceof WhichModelError) {
        throw reason.reason;
      }
    }

    const attempted = failures.map((failure) => `  ✗ ${failure.source}: ${failure.message}`).join("\n");
    throw new WhichModelError(
      "All catalog sources failed to respond.",
      ExitCode.NO_MODELS_FOUND,
      [
        "Attempted sources:",
        attempted || "  (none)",
        "",
        "Suggestions:",
        "  • Check your internet connection",
        "  • Verify API keys are valid",
        "  • Try again in a few minutes",
      ].join("\n")
    );
  }

  if (failures.length > 0) {
    const attempted = failures.map((failure) => `  ✗ ${failure.source}: ${failure.message}`).join("\n");
    warn(
      [
        "Warning: Some catalog sources failed. Continuing with available sources.",
        attempted,
      ].join("\n")
    );
  }

  const merged = mergeCatalogModels(successfulModels);
  if (merged.length === 0) {
    throw new WhichModelError(
      "No models found from any source.",
      ExitCode.NO_MODELS_FOUND,
      [
        `Configured sources: ${requestedSources.join(", ")}`,
        "",
        "If you expected more models:",
        "  • Add FAL_API_KEY for image/video models",
        "  • Add REPLICATE_API_TOKEN for broader coverage",
      ].join("\n")
    );
  }

  return merged;
}

function handleCLIError(error: unknown): never {
  if (error instanceof WhichModelError) {
    console.error(`Error: ${error.message}`);
    if (error.recoveryHint) {
      console.error(error.recoveryHint);
    }
    process.exit(error.exitCode);
  }

  const detail = error instanceof Error ? error.message : "Unknown error";
  console.error(`Error: ${detail}`);
  process.exit(ExitCode.GENERAL_ERROR);
}
