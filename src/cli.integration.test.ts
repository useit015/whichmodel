import { spawnSync } from "node:child_process";
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

  it("exits with code 2 for phase-unsupported sources", () => {
    const result = runCLI(["task", "--sources", "replicate"]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Error: Source(s) not supported in Phase 2: replicate.");
    expect(result.stderr).toContain("Use --sources openrouter,fal");
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

});
