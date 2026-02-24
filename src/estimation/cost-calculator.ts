/**
 * Cost estimation module
 *
 * Parses workload descriptions and calculates estimated costs for models.
 *
 * @module estimation/cost-calculator
 */

import type { ModelEntry, TextPricing, ImagePricing, VideoPricing, AudioPricing, Modality } from "../types.js";

export interface WorkloadSpec {
  quantity: number;
  unit: "requests" | "images" | "minutes" | "seconds" | "tokens";
  period: "day" | "week" | "month";
  parameters?: {
    resolution?: string;
    duration?: number;
    tokensPerRequest?: number;
  };
}

export interface CostEstimate {
  monthlyUnits: number;
  costPerUnit: number;
  monthlyCost: number;
  yearlyCost: number;
  breakdown: string;
}

// Period multipliers to convert to monthly
const PERIOD_MULTIPLIERS: Record<string, number> = {
  day: 30,
  week: 4.33,
  month: 1,
};

// Default assumptions for estimation
const DEFAULT_TOKENS_PER_REQUEST = 2000; // Assume 2K tokens per request for text tasks

/**
 * Parse a workload description string into a structured spec
 *
 * Supports formats like:
 * - "500 images/month at 1024x1024"
 * - "1000 requests per day"
 * - "10000 tokens/week"
 * - "500 images per month"
 */
export function parseWorkloadDescription(description: string): WorkloadSpec {
  const normalized = description.toLowerCase().trim();

  // Extract quantity
  const quantityMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:k|thousand|m|million)?/i);
  if (!quantityMatch) {
    throw new Error(`Could not parse quantity from workload description: "${description}"`);
  }
  let quantity = parseFloat(quantityMatch[1]!.replace(",", ""));

  // Handle k/m suffixes
  if (/\d+k\b/i.test(normalized) || /\d+\s*thousand/i.test(normalized)) {
    quantity *= 1000;
  } else if (/\d+m\b/i.test(normalized) || /\d+\s*million/i.test(normalized)) {
    quantity *= 1_000_000;
  }

  // Extract unit
  let unit: WorkloadSpec["unit"] = "requests";
  if (/images?\b/i.test(normalized) || /pics?\b/i.test(normalized) || /photos?\b/i.test(normalized)) {
    unit = "images";
  } else if (/videos?\b/i.test(normalized)) {
    unit = "seconds"; // Video usually priced per second
  } else if (/minutes?\b/i.test(normalized) || /mins?\b/i.test(normalized)) {
    unit = "minutes";
  } else if (/seconds?\b/i.test(normalized) || /secs?\b/i.test(normalized)) {
    unit = "seconds";
  } else if (/tokens?\b/i.test(normalized)) {
    unit = "tokens";
  } else if (/requests?\b/i.test(normalized) || /calls?\b/i.test(normalized) || /queries?\b/i.test(normalized)) {
    unit = "requests";
  }

  // Extract period
  let period: WorkloadSpec["period"] = "month"; // Default to monthly
  if (/\bper\s*day\b/i.test(normalized) || /\/day\b/i.test(normalized) || /\bdaily\b/i.test(normalized)) {
    period = "day";
  } else if (/\bper\s*week\b/i.test(normalized) || /\/week\b/i.test(normalized) || /\bweekly\b/i.test(normalized)) {
    period = "week";
  } else if (/\bper\s*month\b/i.test(normalized) || /\/month\b/i.test(normalized) || /\bmonthly\b/i.test(normalized)) {
    period = "month";
  }

  // Extract parameters
  const parameters: WorkloadSpec["parameters"] = {};

  // Resolution (e.g., "1024x1024")
  const resolutionMatch = normalized.match(/(\d+)\s*[xX×]\s*(\d+)/);
  if (resolutionMatch) {
    parameters.resolution = `${resolutionMatch[1]}x${resolutionMatch[2]}`;
  }

  // Duration (e.g., "30 seconds")
  const durationMatch = normalized.match(/(\d+)\s*(?:second|sec|minute|min)s?\b/);
  if (durationMatch) {
    const dur = parseInt(durationMatch[1]!, 10);
    if (/minute|min/i.test(normalized)) {
      parameters.duration = dur * 60; // Convert to seconds
    } else {
      parameters.duration = dur;
    }
  }

  // Tokens per request (e.g., "5000 tokens each")
  const tokensMatch = normalized.match(/(\d+)\s*tokens?\s*(?:each|per|\/request)/i);
  if (tokensMatch) {
    parameters.tokensPerRequest = parseInt(tokensMatch[1]!, 10);
  }

  const spec: WorkloadSpec = {
    quantity,
    unit,
    period,
    parameters: Object.keys(parameters).length > 0 ? parameters : undefined,
  };

  return spec;
}

/**
 * Calculate the cost estimate for a model given a workload spec
 */
export function estimateCost(model: ModelEntry, workload: WorkloadSpec): CostEstimate {
  const periodMultiplier = PERIOD_MULTIPLIERS[workload.period] ?? 1;
  const monthlyUnits = workload.quantity * periodMultiplier;

  let costPerUnit: number;
  let breakdown: string;

  const pricing = model.pricing;

  switch (pricing.type) {
    case "text": {
      // For text models, cost is per token
      const tokensPerRequest = workload.parameters?.tokensPerRequest ?? DEFAULT_TOKENS_PER_REQUEST;
      let tokensPerUnit: number;

      if (workload.unit === "tokens") {
        tokensPerUnit = 1;
        costPerUnit = pricing.promptPer1mTokens / 1_000_000;
      } else if (workload.unit === "requests") {
        tokensPerUnit = tokensPerRequest;
        costPerUnit = (pricing.promptPer1mTokens / 1_000_000) * tokensPerRequest;
      } else {
        // Default to requests
        tokensPerUnit = tokensPerRequest;
        costPerUnit = (pricing.promptPer1mTokens / 1_000_000) * tokensPerRequest;
      }

      breakdown = `${monthlyUnits.toLocaleString()} ${workload.unit}/month × $${pricing.promptPer1mTokens.toFixed(2)}/1M tokens × ${tokensPerUnit} tokens`;
      break;
    }

    case "image": {
      if (pricing.perImage) {
        costPerUnit = pricing.perImage;
        breakdown = `${monthlyUnits.toLocaleString()} images/month × $${pricing.perImage.toFixed(4)}/image`;
      } else if (pricing.perMegapixel && workload.parameters?.resolution) {
        const [width, height] = workload.parameters.resolution.split("x").map(Number);
        // Validate resolution is numeric
        if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
          const megapixels = (width * height) / 1_000_000;
          costPerUnit = pricing.perMegapixel * megapixels;
          breakdown = `${monthlyUnits.toLocaleString()} images/month × ${megapixels.toFixed(1)}MP × $${pricing.perMegapixel.toFixed(4)}/MP`;
        } else {
          // Invalid resolution, use 1MP default
          costPerUnit = pricing.perMegapixel;
          breakdown = `${monthlyUnits.toLocaleString()} images/month × $${pricing.perMegapixel.toFixed(4)}/MP (assumed 1MP)`;
        }
      } else if (pricing.perMegapixel) {
        // Assume 1MP default
        costPerUnit = pricing.perMegapixel;
        breakdown = `${monthlyUnits.toLocaleString()} images/month × $${pricing.perMegapixel.toFixed(4)}/MP (assumed 1MP)`;
      } else {
        costPerUnit = 0.02; // Default fallback
        breakdown = `${monthlyUnits.toLocaleString()} images/month (estimated)`;
      }
      break;
    }

    case "video": {
      const duration = workload.parameters?.duration ?? 5; // Default 5 seconds per video
      if (pricing.perSecond) {
        if (workload.unit === "seconds") {
          costPerUnit = pricing.perSecond;
          breakdown = `${monthlyUnits.toLocaleString()} seconds/month × $${pricing.perSecond.toFixed(4)}/sec`;
        } else {
          costPerUnit = pricing.perSecond * duration;
          breakdown = `${monthlyUnits.toLocaleString()} videos/month × ${duration}s × $${pricing.perSecond.toFixed(4)}/sec`;
        }
      } else if (pricing.perGeneration) {
        costPerUnit = pricing.perGeneration;
        breakdown = `${monthlyUnits.toLocaleString()} videos/month × $${pricing.perGeneration.toFixed(2)}/video`;
      } else {
        costPerUnit = 0.10; // Default fallback
        breakdown = `${monthlyUnits.toLocaleString()} videos/month (estimated)`;
      }
      break;
    }

    case "audio": {
      if (pricing.perMinute) {
        if (workload.unit === "minutes") {
          costPerUnit = pricing.perMinute;
          breakdown = `${monthlyUnits.toLocaleString()} minutes/month × $${pricing.perMinute.toFixed(4)}/min`;
        } else if (workload.unit === "seconds") {
          costPerUnit = pricing.perMinute / 60;
          breakdown = `${monthlyUnits.toLocaleString()} seconds/month × $${(pricing.perMinute / 60).toFixed(4)}/sec`;
        } else {
          costPerUnit = pricing.perMinute;
          breakdown = `${monthlyUnits.toLocaleString()} minutes/month × $${pricing.perMinute.toFixed(4)}/min`;
        }
      } else if (pricing.perSecond) {
        costPerUnit = pricing.perSecond;
        breakdown = `${monthlyUnits.toLocaleString()} seconds/month × $${pricing.perSecond.toFixed(4)}/sec`;
      } else if (pricing.perCharacter) {
        // For TTS, estimate ~15 characters per second of audio
        costPerUnit = pricing.perCharacter * 15 * 60; // ~900 chars per minute
        breakdown = `${monthlyUnits.toLocaleString()} requests/month × $${pricing.perCharacter.toFixed(6)}/char (estimated)`;
      } else {
        costPerUnit = 0.01; // Default fallback
        breakdown = `${monthlyUnits.toLocaleString()} requests/month (estimated)`;
      }
      break;
    }

    case "embedding": {
      const tokensPerRequest = workload.parameters?.tokensPerRequest ?? 1000;
      if (workload.unit === "tokens") {
        costPerUnit = pricing.per1mTokens / 1_000_000;
        breakdown = `${monthlyUnits.toLocaleString()} tokens/month × $${pricing.per1mTokens.toFixed(3)}/1M tokens`;
      } else {
        costPerUnit = (pricing.per1mTokens / 1_000_000) * tokensPerRequest;
        breakdown = `${monthlyUnits.toLocaleString()} requests/month × ${tokensPerRequest} tokens × $${pricing.per1mTokens.toFixed(3)}/1M tokens`;
      }
      break;
    }

    default:
      costPerUnit = 0.01;
      breakdown = `${monthlyUnits.toLocaleString()} units/month (estimated)`;
  }

  const monthlyCost = monthlyUnits * costPerUnit;
  const yearlyCost = monthlyCost * 12;

  return {
    monthlyUnits,
    costPerUnit,
    monthlyCost,
    yearlyCost,
    breakdown,
  };
}

/**
 * Format a cost estimate for display
 */
export function formatCostEstimate(estimate: CostEstimate): string {
  const monthlyStr = estimate.monthlyCost < 0.01
    ? `<$0.01`
    : `$${estimate.monthlyCost.toFixed(2)}`;

  const yearlyStr = estimate.yearlyCost < 1
    ? `<$1`
    : `$${estimate.yearlyCost.toFixed(0)}`;

  return `~${monthlyStr}/mo (~${yearlyStr}/yr)`;
}
