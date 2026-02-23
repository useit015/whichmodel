import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(currentDir, "catalog-fetch.ts");

function runCatalogFetch(args: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", scriptPath, ...args], {
    cwd: currentDir,
    env: process.env,
    encoding: "utf8",
  });
}

describe("catalog-fetch source validation", () => {
  it("fails for unknown source values", () => {
    const result = runCatalogFetch(["--sources", "openrouter,unknown"]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Error: Invalid source value(s): unknown.");
    expect(result.stderr).toContain(
      "Valid sources: openrouter, fal, replicate, elevenlabs, together"
    );
  });

  it("fails for currently unsupported sources", () => {
    const result = runCatalogFetch(["--sources", "together"]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("Error: Source(s) not yet supported: together.");
    expect(result.stderr).toContain("Use --sources openrouter,fal,replicate");
  });
});
