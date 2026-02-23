import chalk, { Chalk } from "chalk";
import type { Recommendation } from "../types.js";

export interface TerminalMeta {
  recommenderModel: string;
  cost: number;
  promptTokens?: number;
  completionTokens?: number;
  verbose?: boolean;
  noColor?: boolean;
}

export function formatTerminal(rec: Recommendation, meta: TerminalMeta): string {
  const c = meta.noColor ? new Chalk({ level: 0 }) : chalk;
  const lines: string[] = [];

  lines.push(`${c.cyan("Task Analysis")}`);
  lines.push(`   Modality: ${c.bold(rec.taskAnalysis.detectedModality.toUpperCase())}`);
  lines.push(`   ${rec.taskAnalysis.summary}`);
  lines.push(`   ${c.dim(rec.taskAnalysis.modalityReasoning)}`);

  const tiers = [
    { key: "cheapest", icon: "Cheapest", color: c.green },
    { key: "balanced", icon: "Balanced", color: c.yellow },
    { key: "best", icon: "Best", color: c.magenta },
  ] as const;

  for (const tier of tiers) {
    const pick = rec.recommendations[tier.key];
    lines.push("");
    lines.push(`${tier.color(tier.icon)} - ${c.bold(pick.id)}`);
    lines.push(`   ${c.dim(pick.pricingSummary)}`);
    lines.push(`   ${pick.reason}`);
    lines.push(`   ${c.dim(`Est. ${pick.estimatedCost}`)}`);
  }

  if (rec.alternativesInOtherModalities) {
    lines.push("");
    lines.push(`${c.dim(rec.alternativesInOtherModalities)}`);
  }

  lines.push("");
  lines.push(
    `${c.dim(`This recommendation cost $${meta.cost.toFixed(4)} (${meta.recommenderModel})`)}`
  );

  if (meta.verbose) {
    lines.push(
      c.dim(
        `Tokens: prompt=${meta.promptTokens ?? "n/a"}, completion=${meta.completionTokens ?? "n/a"}`
      )
    );
  }

  return lines.join("\n");
}
