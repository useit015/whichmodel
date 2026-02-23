import { describe, expect, it } from "vitest";
import { buildSystemPrompt, buildUserPrompt } from "./prompts.js";

describe("buildSystemPrompt", () => {
  it("contains role and JSON instructions", () => {
    const prompt = buildSystemPrompt();

    expect(prompt).toContain("expert AI model selector");
    expect(prompt).toContain("Respond with ONLY this JSON structure");
  });
});

describe("buildUserPrompt", () => {
  it("renders constraints and modality sections", () => {
    const prompt = buildUserPrompt(
      "summarize legal contracts",
      {
        text: [
          {
            id: "openrouter::deepseek/deepseek-v3.2",
            name: "DeepSeek V3.2",
            modality: "text",
            pricing: { promptPer1mTokens: 0.25, completionPer1mTokens: 0.38 },
          },
        ],
      },
      { maxPrice: 1, minContext: 100000 }
    );

    expect(prompt).toContain("Task Description");
    expect(prompt).toContain("Max price: $1 per unit");
    expect(prompt).toContain("TEXT Models (1)");
  });

  it("handles no constraints", () => {
    const prompt = buildUserPrompt("write copy", { text: [] });
    expect(prompt).toContain("Constraints\nNone");
  });
});
