import type { JSONOutput, Recommendation, RecommendationMeta } from "../types.js";

export function toJsonOutput(
  task: string,
  recommendation: Recommendation,
  meta: RecommendationMeta
): JSONOutput {
  return {
    task,
    taskAnalysis: recommendation.taskAnalysis,
    recommendations: recommendation.recommendations,
    alternativesInOtherModalities: recommendation.alternativesInOtherModalities,
    meta,
  };
}
