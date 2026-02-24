import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const entryPath = path.join(currentDir, "index.ts");

interface CLIResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function runCLI(args: string[], envOverrides: Record<string, string | undefined> = {}): CLIResult {
  const env = { ...process.env };
  for (const [key, value] of Object.entries(envOverrides)) {
    if (value === undefined) {
      delete env[key];
      continue;
    }

    env[key] = value;
  }

  const result = spawnSync(process.execPath, ["--import", "tsx", entryPath, ...args], {
    cwd: currentDir,
    env,
    encoding: "utf8",
  });

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function createTempOpenRouterCache(): { xdgCacheHome: string; cleanup: () => void } {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "whichmodel-cli-cache-"));
  const cacheDir = path.join(tempRoot, "whichmodel");
  fs.mkdirSync(cacheDir, { recursive: true });

  const now = Math.floor(Date.now() / 1000);
  const cachePayload = {
    data: [
      {
        id: "openrouter::openai/gpt-4o-mini",
        source: "openrouter",
        name: "GPT-4o Mini",
        modality: "text",
        inputModalities: ["text"],
        outputModalities: ["text"],
        pricing: {
          type: "text",
          promptPer1mTokens: 0.15,
          completionPer1mTokens: 0.6,
        },
        contextLength: 128000,
        provider: "openai",
        family: "gpt",
      },
    ],
    timestamp: now,
    ttl: 3600,
    source: "openrouter",
  };

  fs.writeFileSync(
    path.join(cacheDir, "openrouter-catalog.json"),
    JSON.stringify(cachePayload, null, 2),
    "utf8"
  );

  return {
    xdgCacheHome: tempRoot,
    cleanup: () => {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    },
  };
}

describe("CLI integration error handling", () => {
  it("exits with code 2 when task is missing", () => {
    const result = runCLI([], {
      OPENROUTER_API_KEY: undefined,
      WHICHMODEL_CONFIG: "/tmp/whichmodel-config-does-not-exist.json",
    });

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Error: Task description required.");
    expect(result.stderr).toContain("Usage: whichmodel <task>");
  });

  it("exits with code 3 when API key is missing", () => {
    const result = runCLI(["summarize contracts"], {
      OPENROUTER_API_KEY: undefined,
      WHICHMODEL_CONFIG: "/tmp/whichmodel-config-does-not-exist.json",
    });

    expect(result.status).toBe(3);
    expect(result.stderr).toContain("Error: OPENROUTER_API_KEY is not set.");
    expect(result.stderr).toContain("Set OPENROUTER_API_KEY and retry.");
  });

  it("exits with code 2 for invalid modality", () => {
    const result = runCLI(["task", "--modality", "invalid"]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Error: Invalid modality 'invalid'.");
    expect(result.stderr).toContain("Valid modalities:");
  });

  it("exits with code 2 for invalid max price", () => {
    const result = runCLI(["task", "--max-price", "abc"]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Error: Invalid price format 'abc'.");
    expect(result.stderr).toContain("--max-price expects a non-negative number in USD.");
  });

  it("exits with code 2 for invalid min context", () => {
    const result = runCLI(["task", "--min-context", "10.5"]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Error: Invalid min context '10.5'.");
    expect(result.stderr).toContain("--min-context expects a positive integer");
  });

  it("exits with code 2 for invalid min resolution", () => {
    const result = runCLI(["task", "--min-resolution", "1024"]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Error: Invalid resolution format '1024'.");
    expect(result.stderr).toContain("--min-resolution expects WIDTHxHEIGHT format.");
  });

  it("exits with code 2 for unknown sources", () => {
    const result = runCLI(["task", "--sources", "openrouter,unknown"]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Error: Invalid source value(s): unknown.");
    expect(result.stderr).toContain("Valid sources: openrouter, fal, replicate, elevenlabs, together");
  });

  it("exits with code 2 for unsupported sources", () => {
    const result = runCLI(["task", "--sources", "together"]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Error: Source(s) not yet supported: together.");
    expect(result.stderr).toContain("Use --sources openrouter,fal,replicate");
  });

  it("exits with code 3 when fal source is selected but FAL_API_KEY is missing", () => {
    const result = runCLI(["task", "--sources", "fal"], {
      OPENROUTER_API_KEY: "sk-or-test",
      FAL_API_KEY: undefined,
    });

    expect(result.status).toBe(3);
    expect(result.stderr).toContain("Error: FAL_API_KEY is not set.");
    expect(result.stderr).toContain("Set FAL_API_KEY and retry.");
  });

  it("exits with code 3 when replicate source is selected but REPLICATE_API_TOKEN is missing", () => {
    const result = runCLI(["task", "--sources", "replicate"], {
      OPENROUTER_API_KEY: "sk-or-test",
      REPLICATE_API_TOKEN: undefined,
    });

    expect(result.status).toBe(3);
    expect(result.stderr).toContain("Error: REPLICATE_API_TOKEN is not set.");
    expect(result.stderr).toContain("Set REPLICATE_API_TOKEN and retry.");
  });

  it("does not leak API keys in CLI output on failures", () => {
    const openrouterKey = "sk-or-v1-test-fake-key-not-real-xxxxx";
    const result = runCLI(["task", "--sources", "fal", "--verbose"], {
      OPENROUTER_API_KEY: openrouterKey,
      FAL_API_KEY: undefined,
    });

    expect(result.status).toBe(3);
    expect(result.stdout).not.toContain(openrouterKey);
    expect(result.stderr).not.toContain(openrouterKey);
    expect(result.stderr).toContain("Error: FAL_API_KEY is not set.");
  });

  it("supports list --json via global flag and without OPENROUTER_API_KEY", () => {
    const cache = createTempOpenRouterCache();
    try {
      const result = runCLI(["--json", "list", "--limit", "1"], {
        OPENROUTER_API_KEY: undefined,
        WHICHMODEL_CONFIG: "/tmp/whichmodel-config-does-not-exist.json",
        XDG_CACHE_HOME: cache.xdgCacheHome,
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('"models"');
      expect(result.stdout).not.toContain("┌");
    } finally {
      cache.cleanup();
    }
  });

  it("supports stats --json via global flag and without OPENROUTER_API_KEY", () => {
    const cache = createTempOpenRouterCache();
    try {
      const result = runCLI(["--json", "stats"], {
        OPENROUTER_API_KEY: undefined,
        WHICHMODEL_CONFIG: "/tmp/whichmodel-config-does-not-exist.json",
        XDG_CACHE_HOME: cache.xdgCacheHome,
      });

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('"totalModels"');
      expect(result.stdout).toContain('"sources"');
      expect(result.stdout).not.toContain("┌");
    } finally {
      cache.cleanup();
    }
  });

});
