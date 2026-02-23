import type { Recommendation, ValidationResult } from "../types.js";

const TIERS = ["cheapest", "balanced", "best"] as const;

export function validateRecommendation(
  recommendation: Recommendation,
  validIds: Set<string>
): ValidationResult {
  const invalidIds: string[] = [];

  for (const tier of TIERS) {
    const candidateId = recommendation.recommendations[tier]?.id;
    if (!candidateId || !validIds.has(candidateId)) {
      invalidIds.push(candidateId ?? "undefined");
    }
  }

  return {
    valid: invalidIds.length === 0,
    invalidIds,
  };
}

export function findClosestModelId(
  invalidId: string,
  validIds: Set<string>
): string | null {
  if (!invalidId) {
    return null;
  }

  const normalizedInvalid = normalizeId(invalidId);
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const validId of validIds) {
    const score = similarity(normalizedInvalid, normalizeId(validId));
    if (score > bestScore) {
      bestScore = score;
      bestMatch = validId;
    }
  }

  return bestScore >= 0.3 ? bestMatch : null;
}

function normalizeId(id: string): string {
  return id.replace(/^[^:]+::/, "").toLowerCase();
}

function similarity(a: string, b: string): number {
  if (a === b) {
    return 1;
  }

  if (a.includes(b) || b.includes(a)) {
    const shortest = Math.min(a.length, b.length);
    const longest = Math.max(a.length, b.length);
    return shortest / longest;
  }

  const setA = new Set(a.split(/[\/_\-.]/g).filter(Boolean));
  const setB = new Set(b.split(/[\/_\-.]/g).filter(Boolean));
  if (setA.size === 0 || setB.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersection += 1;
    }
  }

  const union = new Set([...setA, ...setB]).size;
  return intersection / union;
}
