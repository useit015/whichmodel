

# Product Requirements Document (PRD)

## `whichmodel` — AI Model Recommender CLI

---

## 1. Overview

### 1.1 Problem Statement

There are 300+ AI models available on OpenRouter alone — and that number grows weekly. These span **text generation, image generation, video generation, audio, vision, and multimodal** use cases. Developers, creators, and AI engineers waste significant time manually comparing models across pricing, capabilities, modalities, and task suitability. The current process involves:

- Manually browsing the OpenRouter catalog, Replicate, fal.ai, or provider docs
- Reading benchmarks and community comparisons scattered across Twitter, Reddit, and blogs
- Making educated guesses or defaulting to "just use GPT-4o / Midjourney"
- Overpaying for simple tasks, using the wrong modality pipeline, or missing newer/cheaper options entirely

### 1.2 Solution

A CLI tool that takes a plain-English task description, fetches live model catalogs across **all modalities**, and uses a cheap LLM call to recommend **three models** (cheapest, balanced, best) with reasoning tailored to the specific task — whether that's writing code, generating product photos, creating video ads, or transcribing podcasts.

### 1.3 One-Liner

> *"Tell me what you want to build. I'll tell you which model to use — text, image, video, or audio."*

---

## 2. Goals & Non-Goals

### 2.1 Goals

| # | Goal | Success Metric |
|---|------|----------------|
| G1 | Reduce model selection time from ~15 min to ~5 seconds across all modalities | End-to-end CLI response < 10s |
| G2 | Save users money by surfacing cheaper viable alternatives | Recommended "cheap" model is ≥50% less expensive than the obvious default |
| G3 | Recommendations are task-aware AND modality-aware | Tool correctly identifies the needed modality 95% of the time |
| G4 | Zero configuration to get started | First useful output within 60 seconds of install |
| G5 | Cost of running the tool itself is negligible | < $0.005 per recommendation query |
| G6 | Cover all major AI modalities | Text, image, video, audio, multimodal — all supported in v1 |

### 2.2 Non-Goals (v1)

- **Not a benchmarking tool** — we don't run evals or generate sample outputs
- **Not a proxy/router** — we recommend, we don't route traffic
- **No GUI/web interface** — CLI only for v1
- **No model fine-tuning recommendations** — only off-the-shelf models
- **No uptime/latency monitoring** — we don't track provider reliability
- **No unified API abstraction** — we recommend models, not provide a wrapper to call them

---

## 3. Modality Framework

### 3.1 Supported Modalities

| Modality | Input → Output | Example Tasks | Pricing Unit | Example Models |
|----------|---------------|---------------|--------------|----------------|
| **Text Generation** | Text → Text | Writing, coding, analysis, chat | Per token | GPT-4o, Claude, DeepSeek, Llama |
| **Image Generation** | Text → Image | Product photos, art, logos, UI mockups | Per image / per megapixel / per step | DALL·E 3, Flux, Stable Diffusion, Midjourney |
| **Video Generation** | Text/Image → Video | Ads, social clips, animation, b-roll | Per second / per generation | Sora, Runway Gen-3, Kling, Veo |
| **Audio / Speech** | Text → Audio / Audio → Text | TTS, transcription, voice cloning, music | Per character / per minute / per second | ElevenLabs, Whisper, Suno, Udio |
| **Vision / Understanding** | Image → Text | OCR, image analysis, visual Q&A | Per token + per image | GPT-4o, Claude, Gemini |
| **Multimodal** | Any → Any | Complex pipelines, agents | Varies | Gemini, GPT-4o |
| **Embedding** | Text → Vector | Search, RAG, clustering | Per token | text-embedding-3, Voyage, Cohere |

### 3.2 Modality Detection

The recommender LLM must **infer the needed modality** from the task description. Examples:

| Task Description | Detected Modality | Reasoning |
|-----------------|-------------------|-----------|
| "write video scripts for YouTube" | Text Generation | Despite "video" in the prompt, the output is text |
| "generate product photos for an e-commerce store" | Image Generation | Output is images |
| "create 15-second ad clips from product images" | Video Generation | Output is video |
| "transcribe my podcast episodes" | Audio → Text (STT) | Input is audio, output is text |
| "add voiceover narration to my blog posts" | Text → Audio (TTS) | Input is text, output is audio |
| "analyze screenshots of competitor websites" | Vision / Understanding | Input is images, output is text analysis |
| "build a search engine for my documentation" | Embedding | Needs vector representations |
| "build an AI agent that browses the web and summarizes what it finds" | Text Generation (with tools) | Agent task, primarily text |

This is **exactly why an LLM is needed** — rule-based modality detection would fail on cases like "write video scripts" (text, not video).

---

## 4. Users & Personas

### 4.1 Primary: Solo Developer / AI Tinkerer

- Building AI-powered tools, apps, or automations
- Cost-sensitive, wants to avoid surprise bills
- Works across modalities: might need text today, images tomorrow
- Lives in the terminal

### 4.2 Secondary: Content Creator / Marketer

- Needs AI for video ads, product images, voiceovers, copywriting
- Doesn't know the model landscape beyond "ChatGPT and Midjourney"
- Cares about output quality and cost, not technical details
- Needs the simplest possible interface

### 4.3 Tertiary: AI Engineer at a Startup

- Building production pipelines that may span multiple modalities
- Evaluating models for cost at scale (10K+ generations/month)
- Needs to justify model choices with data
- Values cost projections and reasoning

---

## 5. User Stories

| ID | Story | Priority |
|----|-------|----------|
| US1 | As a user, I want to describe a task and get 3 model recommendations so I can pick one quickly | P0 |
| US2 | As a user, I want the tool to automatically detect the right modality from my description | P0 |
| US3 | As a user, I want to see reasoning behind each recommendation so I can trust the suggestion | P0 |
| US4 | As a user, I want to see pricing in units that make sense for the modality (per token, per image, per second) | P0 |
| US5 | As a user, I want to force a specific modality when the auto-detection is wrong | P1 |
| US6 | As a user, I want to filter by constraints (max price, min resolution, min context) | P1 |
| US7 | As a user, I want JSON output so I can pipe it into other tools | P1 |
| US8 | As a user, I want cost projections for my expected workload | P1 |
| US9 | As a user, I want to configure which LLM powers the recommender | P1 |
| US10 | As a user, I want to exclude specific models or providers | P2 |
| US11 | As a user, I want to compare two models head-to-head for a task | P2 |
| US12 | As a user, I want to see what modalities are available and how many models exist for each | P2 |

---

## 6. Data Sources

### 6.1 Model Catalogs

| Source | Modalities Covered | API | Auth Required | Priority |
|--------|-------------------|-----|--------------|----------|
| **OpenRouter** | Text, Vision, Multimodal, some Image | `GET /api/v1/models` | No (for catalog) | P0 |
| **fal.ai** | Image, Video, Audio | `GET /models` | Yes | P1 |
| **Replicate** | Image, Video, Audio, Text | `GET /v1/models` | Yes | P1 |
| **Together AI** | Text, Image, Embedding | `GET /v1/models` | Yes | P2 |
| **ElevenLabs** | Audio (TTS, Voice Clone) | `GET /v1/models` | Yes | P2 |
| **Manual/Static** | Models without APIs (Midjourney, Udio, Suno) | None (hardcoded) | N/A | P2 |

### 6.2 Catalog Abstraction

Each source returns different schemas. We normalize to a unified format:

```typescript
interface ModelEntry {
  id: string;                          // "openrouter::anthropic/claude-sonnet-4"
  source: string;                      // "openrouter" | "fal" | "replicate"
  name: string;                        // "Claude Sonnet 4"
  modality: Modality;                  // "text" | "image" | "video" | "audio" | "embedding" | "multimodal"
  inputModalities: string[];           // ["text"] or ["text", "image"]
  outputModalities: string[];          // ["text"] or ["image"]

  // Pricing (normalized, flexible per modality)
  pricing: TextPricing | ImagePricing | VideoPricing | AudioPricing | EmbeddingPricing;
  // Text:  { promptPer1mTokens: 3.0, completionPer1mTokens: 15.0 }
  // Image: { perImage: 0.04, perMegapixel: 0.02 }
  // Video: { perSecond: 0.05, perGeneration: 0.50 }
  // Audio: { perMinute: 0.006, perCharacter: 0.00003 }

  // Capabilities (modality-specific)
  contextLength?: number;              // Text models
  maxResolution?: string;              // Image models: "1024x1024"
  maxDuration?: number;                // Video/Audio: seconds
  supportsStreaming?: boolean;

  // Metadata
  provider: string;                    // "anthropic" | "stability" | "runway"
  family: string;                      // "claude" | "flux" | "runway-gen3"
}

type Modality =
  | "text"
  | "image"
  | "video"
  | "audio_tts"
  | "audio_stt"
  | "audio_generation"
  | "vision"
  | "embedding"
  | "multimodal";

interface TextPricing {
  type: "text";
  promptPer1mTokens: number;
  completionPer1mTokens: number;
}

interface ImagePricing {
  type: "image";
  perImage?: number;
  perMegapixel?: number;
  perStep?: number;
}

interface VideoPricing {
  type: "video";
  perSecond?: number;
  perGeneration?: number;
}

interface AudioPricing {
  type: "audio";
  perMinute?: number;
  perCharacter?: number;
  perSecond?: number;
}

interface EmbeddingPricing {
  type: "embedding";
  per1mTokens: number;
}
```

### 6.3 v1 Scope

**v1 ships with OpenRouter only.** This already covers:
- All major text models (GPT, Claude, Gemini, DeepSeek, Llama, Mistral, Qwen, etc.)
- Vision/multimodal models
- Some image generation models (DALL·E via OpenRouter)

Subsequent versions add fal.ai (images/video), Replicate (everything), etc.

But the **architecture and prompt are designed for all modalities from day one**, so adding sources is additive, not a rewrite.

---

## 7. Technical Decisions

### 7.1 Language: TypeScript

- Type safety for complex normalized schemas across modalities
- Excellent CLI tooling ecosystem
- Target audience (developers) has Node.js / Bun installed
- Fast iteration with `tsx` for development

### 7.2 Runtime: Node.js (≥ 20) with Bun compatibility

- Node 20+ for native `fetch`, top-level await
- Also works under Bun out of the box
- No native modules — pure JS/TS

### 7.3 Default Recommender Model: `deepseek/deepseek-v3.2`

- Cheapest viable option ($0.26/$0.38 per 1M tokens)
- Supports structured JSON output
- Good reasoning capability for task analysis
- Fallback: `openai/gpt-4o-mini` ($0.15/$0.60)

### 7.4 Dependencies (minimal)

```jsonc
{
  "dependencies": {
    "commander": "^13.0.0",     // CLI framework (lightweight, zero-dep)
    "chalk": "^5.0.0",          // Terminal colors
    "ora": "^8.0.0"             // Spinner for loading states
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "tsx": "^4.0.0",            // Dev runner
    "tsup": "^8.0.0",           // Build/bundle
    "vitest": "^3.0.0",         // Testing
    "@types/node": "^22.0.0"
  }
}
```

> **Note:** No HTTP client dependency — uses Node 20's native `fetch`.

---

## 8. System Architecture

### 8.1 High-Level Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                          CLI Layer                             │
│              (argument parsing, output formatting)             │
└──────────┬────────────────────────────────┬────────────────────┘
           │                                │
           ▼                                ▼
┌─────────────────────┐        ┌─────────────────────────┐
│   Catalog Service   │        │  Recommendation Engine  │
│                     │        │                         │
│ • Fetch from APIs   │        │ • Detect modality       │
│ • Normalize schema  │        │ • Build prompt          │
│ • Compress fields   │───────▶│ • Call recommender LLM  │
│ • Apply filters     │        │ • Parse & validate JSON │
│ • Cache (optional)  │        │ • Retry on failure      │
└──────┬──────────────┘        └─────────────────────────┘
       │                                    │
       ▼                                    ▼
┌──────────────────────────────────────────────────────────┐
│                     Data Sources                         │
│                                                          │
│  ┌─────────────┐  ┌────────┐  ┌───────────┐  ┌───────┐ │
│  │ OpenRouter  │  │ fal.ai │  │ Replicate │  │ ...   │ │
│  │ (text,vision│  │ (image,│  │ (all)     │  │       │ │
│  │  multimodal)│  │  video)│  │           │  │       │ │
│  └─────────────┘  └────────┘  └───────────┘  └───────┘ │
└──────────────────────────────────────────────────────────┘
```

### 8.2 Project Structure

```
whichmodel/
├── package.json
├── tsconfig.json
├── tsup.config.ts               # Build config
├── vitest.config.ts
│
├── src/
│   ├── index.ts                 # Entry point
│   ├── cli.ts                   # Commander setup, argument parsing
│   ├── config.ts                # Env vars, config file, defaults
│   ├── types.ts                 # ModelEntry, Modality, Pricing types
│   │
│   ├── catalog/
│   │   ├── index.ts             # Aggregator — fetches from all sources
│   │   ├── source.ts            # CatalogSource interface
│   │   ├── openrouter.ts        # OpenRouter adapter
│   │   ├── fal.ts               # fal.ai adapter (v0.2)
│   │   ├── replicate.ts         # Replicate adapter (v0.2)
│   │   ├── static.ts            # Hardcoded models (Midjourney, etc.)
│   │   ├── normalizer.ts        # Raw → ModelEntry conversion
│   │   ├── compressor.ts        # ModelEntry → compact LLM-friendly format
│   │   └── cache.ts             # File-based cache with TTL
│   │
│   ├── recommender/
│   │   ├── index.ts             # Main recommend() function
│   │   ├── prompts.ts           # System + user prompt templates
│   │   ├── validator.ts         # Validate model IDs, find closest match
│   │   └── fallback.ts          # Price-sorted fallback when LLM fails
│   │
│   └── formatter/
│       ├── index.ts             # Route to terminal or JSON formatter
│       ├── terminal.ts          # Rich terminal output with chalk
│       ├── json.ts              # JSON output
│       └── pricing.ts           # Format pricing per modality
│
├── tests/
│   ├── catalog/
│   │   ├── openrouter.test.ts
│   │   ├── normalizer.test.ts
│   │   └── compressor.test.ts
│   ├── recommender/
│   │   ├── prompts.test.ts
│   │   └── validator.test.ts
│   └── formatter/
│       ├── terminal.test.ts
│       └── pricing.test.ts
│
└── fixtures/
    ├── openrouter-response.json  # Snapshot for tests
    └── fal-response.json
```

### 8.3 Data Flow

```
User Input          Catalog APIs          Recommender LLM         Output
─────────           ────────────          ───────────────         ──────

"create product ──▶  GET /models  ──▶   Compress to
 photos"            (parallel)         ~100-150 models
                    OpenRouter          (~15-20KB JSON)
                    fal.ai                    │
                    Replicate                 │
                                              ▼
                                     ┌──────────────────┐
                                     │  System Prompt   │
                                     │  + Task desc     │
                                     │  + Compressed    │──▶  Structured
                                     │    catalog       │      JSON
                                     │  (grouped by     │        │
                                     │   modality)      │        ▼
                                     └──────────────────┘  Validate IDs
                                                                 │
                                                                 ▼
                                                          Pretty terminal
                                                          or JSON output
```

---

## 9. Implementation Details

### 9.1 Catalog Source Interface

```typescript
// src/catalog/source.ts

import type { ModelEntry } from "../types.js";

export interface CatalogSource {
  readonly sourceId: string;
  fetch(): Promise<ModelEntry[]>;
}
```

### 9.2 OpenRouter Adapter

```typescript
// src/catalog/openrouter.ts

import type { CatalogSource } from "./source.js";
import type { ModelEntry, Modality } from "../types.js";

interface OpenRouterModel {
  id: string;
  name: string;
  pricing: { prompt: string; completion: string };
  context_length: number;
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
  };
  top_provider?: { max_completion_tokens?: number };
}

export class OpenRouterCatalog implements CatalogSource {
  readonly sourceId = "openrouter";

  async fetch(): Promise<ModelEntry[]> {
    const res = await fetch("https://openrouter.ai/api/v1/models");
    if (!res.ok) throw new Error(`OpenRouter API: ${res.status}`);

    const { data } = (await res.json()) as { data: OpenRouterModel[] };

    return data
      .map((m) => this.normalize(m))
      .filter((m): m is ModelEntry => m !== null);
  }

  private normalize(raw: OpenRouterModel): ModelEntry | null {
    const promptPrice = parseFloat(raw.pricing?.prompt ?? "0");
    const completionPrice = parseFloat(raw.pricing?.completion ?? "0");

    // Skip models with no pricing
    if (promptPrice === 0 && completionPrice === 0) return null;

    const inputMod = raw.architecture?.input_modalities ?? ["text"];
    const outputMod = raw.architecture?.output_modalities ?? ["text"];
    const modality = this.classifyModality(inputMod, outputMod);

    return {
      id: `openrouter::${raw.id}`,
      source: "openrouter",
      name: raw.name,
      modality,
      inputModalities: inputMod,
      outputModalities: outputMod,
      pricing: {
        type: "text",
        promptPer1mTokens: round(promptPrice * 1_000_000, 4),
        completionPer1mTokens: round(completionPrice * 1_000_000, 4),
      },
      contextLength: raw.context_length,
      provider: raw.id.split("/")[0],
      family: this.extractFamily(raw.id),
    };
  }

  private classifyModality(input: string[], output: string[]): Modality {
    if (output.includes("image")) return "image";
    if (output.includes("video")) return "video";
    if (output.includes("audio")) return "audio_tts";
    if (input.includes("image") && output.includes("text")) return "vision";
    return "text";
  }

  private extractFamily(id: string): string {
    // "anthropic/claude-sonnet-4" → "claude"
    const name = id.split("/")[1] ?? id;
    if (name.includes("claude")) return "claude";
    if (name.includes("gpt")) return "gpt";
    if (name.includes("gemini")) return "gemini";
    if (name.includes("deepseek")) return "deepseek";
    if (name.includes("llama")) return "llama";
    if (name.includes("qwen")) return "qwen";
    if (name.includes("mistral")) return "mistral";
    return "other";
  }
}

function round(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}
```

### 9.3 Catalog Compressor

```typescript
// src/catalog/compressor.ts

import type { ModelEntry } from "../types.js";

interface CompressedModel {
  id: string;
  name: string;
  modality: string;
  pricing: Record<string, number>;
  contextLength?: number;
  maxResolution?: string;
  maxDuration?: number;
}

/**
 * Compress model entries to minimize token usage when sent to the LLM.
 * Strips metadata not needed for recommendation decisions.
 */
export function compressForLLM(models: ModelEntry[]): CompressedModel[] {
  return models.map((m) => {
    const compressed: CompressedModel = {
      id: m.id,
      name: m.name,
      modality: m.modality,
      pricing: flattenPricing(m.pricing),
    };

    if (m.contextLength) compressed.contextLength = m.contextLength;
    if (m.maxResolution) compressed.maxResolution = m.maxResolution;
    if (m.maxDuration) compressed.maxDuration = m.maxDuration;

    return compressed;
  });
}

/**
 * Group compressed models by modality for structured prompt injection.
 */
export function groupByModality(
  models: CompressedModel[]
): Record<string, CompressedModel[]> {
  const groups: Record<string, CompressedModel[]> = {};

  for (const model of models) {
    const key = model.modality;
    if (!groups[key]) groups[key] = [];
    groups[key].push(model);
  }

  return groups;
}

function flattenPricing(pricing: ModelEntry["pricing"]): Record<string, number> {
  const flat: Record<string, number> = {};
  for (const [key, value] of Object.entries(pricing)) {
    if (key === "type") continue;
    if (typeof value === "number") flat[key] = value;
  }
  return flat;
}
```

### 9.4 Recommender Engine

```typescript
// src/recommender/index.ts

import { buildSystemPrompt, buildUserPrompt } from "./prompts.js";
import { validateRecommendation } from "./validator.js";
import { priceSortedFallback } from "./fallback.js";
import { getConfig } from "../config.js";
import type { ModelEntry } from "../types.js";
import { compressForLLM, groupByModality } from "../catalog/compressor.js";

export interface Recommendation {
  taskAnalysis: {
    summary: string;
    detectedModality: string;
    modalityReasoning: string;
    keyRequirements: string[];
    costFactors: string;
  };
  recommendations: {
    cheapest: ModelPick;
    balanced: ModelPick;
    best: ModelPick;
  };
  alternativesInOtherModalities: string | null;
}

export interface ModelPick {
  id: string;
  reason: string;
  pricingSummary: string;
  estimatedCost: string;
}

const MAX_RETRIES = 2;

export async function recommend(
  task: string,
  models: ModelEntry[],
  constraints?: { maxPrice?: number; minContext?: number; modality?: string }
): Promise<Recommendation> {
  const config = getConfig();

  // Compress and group
  const compressed = compressForLLM(models);
  const grouped = groupByModality(compressed);

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(task, grouped, constraints);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: config.recommenderModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            response_format: { type: "json_object" },
          }),
        }
      );

      if (!res.ok) {
        const body = await res.text();
        throw new Error(`LLM API ${res.status}: ${body}`);
      }

      const data = (await res.json()) as {
        choices: Array<{ message: { content: string } }>;
        usage?: { prompt_tokens: number; completion_tokens: number };
      };

      const content = data.choices[0]?.message?.content;
      if (!content) throw new Error("Empty LLM response");

      const parsed = JSON.parse(content) as Recommendation;

      // Validate that recommended model IDs exist in catalog
      const validModelIds = new Set(models.map((m) => m.id));
      const validation = validateRecommendation(parsed, validModelIds);

      if (validation.valid) {
        return parsed;
      }

      // If invalid, will retry with correction context
      console.error(
        `Attempt ${attempt + 1}: Invalid model IDs: ${validation.invalidIds.join(", ")}`
      );
    } catch (err) {
      if (attempt === MAX_RETRIES - 1) {
        console.error("LLM recommendation failed, using fallback");
        return priceSortedFallback(task, models);
      }
      // Exponential backoff
      await sleep(1000 * 2 ** attempt);
    }
  }

  return priceSortedFallback(task, models);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

### 9.5 Prompt Templates

```typescript
// src/recommender/prompts.ts

export function buildSystemPrompt(): string {
  return `You are an expert AI model selector with deep knowledge of models across
ALL modalities — text, image generation, video generation, audio/speech,
vision/understanding, embeddings, and multimodal.

## Your Job

Given a task description and a catalog of available models, you must:

1. **Detect the correct modality** for the task
2. **Recommend exactly 3 models** in that modality:
   - **cheapest**: Cheapest model that can do the job acceptably
   - **balanced**: Best quality-to-price ratio for this specific task
   - **best**: Highest quality regardless of cost

## Modality Detection Rules

Be careful with ambiguous tasks:
- "write video scripts" → TEXT (output is a script, not a video)
- "generate product photos" → IMAGE
- "create a 15-second ad from product images" → VIDEO
- "transcribe my podcast" → AUDIO_STT
- "add voiceover to my blog" → AUDIO_TTS
- "describe what's in these screenshots" → VISION
- "find similar documents" → EMBEDDING
- "build a chatbot" → TEXT
- "generate background music for a video" → AUDIO_GENERATION

If the task genuinely spans multiple modalities, recommend models for
the PRIMARY modality and note the others in your analysis.

## Pricing Analysis Per Modality

Different modalities have different cost structures. Analyze accordingly:

**Text models**: Consider prompt vs completion token pricing. Is the task
input-heavy (analysis, summarization) or output-heavy (generation, writing)?

**Image models**: Compare per-image or per-megapixel pricing. Consider
resolution needs, style control, number of generations needed.

**Video models**: Compare per-second or per-generation pricing. Consider
duration needs, resolution, motion quality.

**Audio models**: Compare per-minute, per-character, or per-second pricing.
Consider voice quality, language support, real-time needs.

**Embedding models**: Compare per-token pricing and dimensionality. Consider
retrieval quality vs cost at scale.

## Model Family Strengths

**Text**: Claude (writing, nuance), GPT-4o (general, tools), Gemini (speed,
long context), DeepSeek (code, math, cost), Llama (open, privacy),
Qwen (multilingual, code), Mistral (speed, European compliance)

**Image**: Flux (quality, prompt adherence), DALL·E 3 (ease of use, safety),
Stable Diffusion (control, customization, cost), Midjourney (aesthetics),
Ideogram (text rendering in images), Recraft (design, vectors)

**Video**: Runway Gen-3 (quality, control), Kling (motion, duration),
Sora (coming), Minimax (cost), Veo (Google quality), Pika (stylization)

**Audio**: ElevenLabs (voice quality, cloning), OpenAI TTS (cost, quality),
Whisper (transcription), Suno (music), Udio (music), Fish Audio (multilingual)

## Output Format

Respond with ONLY this JSON structure:
{
  "taskAnalysis": {
    "summary": "one-line description of what the task demands",
    "detectedModality": "text | image | video | audio_tts | audio_stt | audio_generation | vision | embedding | multimodal",
    "modalityReasoning": "why this modality was chosen",
    "keyRequirements": ["req1", "req2", "req3"],
    "costFactors": "what drives cost for this specific task"
  },
  "recommendations": {
    "cheapest": {
      "id": "source::provider/model-name",
      "reason": "2-3 sentence justification specific to this task",
      "pricingSummary": "human-readable pricing",
      "estimatedCost": "$X for Y units (describe a reasonable workload)"
    },
    "balanced": { ... },
    "best": { ... }
  },
  "alternativesInOtherModalities": null or "brief note if another modality could work"
}

IMPORTANT:
- Only recommend models that appear in the provided catalog
- Use the exact model ID from the catalog
- If the task is ambiguous, state assumptions in taskAnalysis
- Never recommend a model you aren't confident can handle the task`;
}

export function buildUserPrompt(
  task: string,
  groupedModels: Record<string, unknown[]>,
  constraints?: { maxPrice?: number; minContext?: number; modality?: string }
): string {
  const constraintLines: string[] = [];
  if (constraints?.maxPrice)
    constraintLines.push(`Max price: $${constraints.maxPrice} per unit`);
  if (constraints?.minContext)
    constraintLines.push(
      `Min context length: ${constraints.minContext.toLocaleString()} tokens`
    );
  if (constraints?.modality)
    constraintLines.push(`Force modality: ${constraints.modality}`);

  const constraintStr =
    constraintLines.length > 0 ? constraintLines.join("\n") : "None";

  const sections = Object.entries(groupedModels)
    .map(
      ([modality, models]) =>
        `### ${modality.toUpperCase()} Models (${models.length})\n${JSON.stringify(models, null, 2)}`
    )
    .join("\n\n");

  return `## Task Description
${task}

## Constraints
${constraintStr}

## Available Models (grouped by modality)

${sections}`;
}
```

### 9.6 Validator

```typescript
// src/recommender/validator.ts

import type { Recommendation } from "./index.js";

interface ValidationResult {
  valid: boolean;
  invalidIds: string[];
}

export function validateRecommendation(
  rec: Recommendation,
  validIds: Set<string>
): ValidationResult {
  const invalidIds: string[] = [];

  for (const tier of ["cheapest", "balanced", "best"] as const) {
    const pick = rec.recommendations[tier];
    if (!pick?.id || !validIds.has(pick.id)) {
      invalidIds.push(pick?.id ?? "undefined");
    }
  }

  return {
    valid: invalidIds.length === 0,
    invalidIds,
  };
}

/**
 * Find the closest matching model ID using simple string similarity.
 * Used for error messages when the LLM hallucinates a model ID.
 */
export function findClosestModelId(
  invalidId: string,
  validIds: Set<string>
): string | null {
  // Strip source prefix for comparison
  const needle = invalidId.replace(/^[^:]+::/, "").toLowerCase();
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const id of validIds) {
    const candidate = id.replace(/^[^:]+::/, "").toLowerCase();

    // Simple: longest common substring ratio
    let common = 0;
    for (let i = 0; i < needle.length; i++) {
      if (candidate.includes(needle.slice(i, i + 3))) common++;
    }
    const score = common / Math.max(needle.length, candidate.length);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = id;
    }
  }

  return bestScore > 0.3 ? bestMatch : null;
}
```

### 9.7 Terminal Formatter

```typescript
// src/formatter/terminal.ts

import chalk from "chalk";
import type { Recommendation } from "../recommender/index.js";

const ICONS = {
  analysis: "🔍",
  cheapest: "💰",
  balanced: "⚖️ ",
  best: "🏆",
  tip: "💡",
  cost: "⚡",
} as const;

export function formatTerminal(
  rec: Recommendation,
  meta: { recommenderModel: string; cost: number }
): string {
  const lines: string[] = [];
  const { taskAnalysis: ta, recommendations: r } = rec;

  // Task Analysis
  lines.push("");
  lines.push(
    `${ICONS.analysis} ${chalk.bold("Task Analysis")}`
  );
  lines.push(
    `   Modality: ${chalk.cyan.bold(ta.detectedModality.toUpperCase())}`
  );
  lines.push(`   ${ta.summary}`);
  if (ta.keyRequirements.length > 0) {
    lines.push(
      `   Needs: ${ta.keyRequirements.join(", ")}`
    );
  }

  // Recommendations
  const tiers = [
    { key: "cheapest" as const, label: "Cheapest", icon: ICONS.cheapest, color: chalk.green },
    { key: "balanced" as const, label: "Balanced", icon: ICONS.balanced, color: chalk.yellow },
    { key: "best" as const, label: "Best", icon: ICONS.best, color: chalk.magenta },
  ];

  for (const tier of tiers) {
    const pick = r[tier.key];
    lines.push("");
    lines.push(
      `${tier.icon} ${tier.color.bold(`${tier.label}`)} — ${chalk.white.bold(pick.id)}`
    );
    lines.push(`   ${chalk.dim(pick.pricingSummary)}`);
    lines.push(`   ${pick.reason}`);
    lines.push(`   ${chalk.dim(`Est. ${pick.estimatedCost}`)}`);
  }

  // Cross-modality tip
  if (rec.alternativesInOtherModalities) {
    lines.push("");
    lines.push(
      `${ICONS.tip} ${chalk.dim(rec.alternativesInOtherModalities)}`
    );
  }

  // Meta
  lines.push("");
  lines.push(
    `${ICONS.cost} ${chalk.dim(`This recommendation cost $${meta.cost.toFixed(4)} (${meta.recommenderModel})`)}`
  );
  lines.push("");

  return lines.join("\n");
}
```

### 9.8 CLI Entry Point

```typescript
// src/cli.ts

import { Command } from "commander";
import ora from "ora";
import { OpenRouterCatalog } from "./catalog/openrouter.js";
import { recommend } from "./recommender/index.js";
import { formatTerminal } from "./formatter/terminal.js";
import { getConfig, validateConfig } from "./config.js";
import type { ModelEntry } from "./types.js";

const program = new Command();

program
  .name("whichmodel")
  .description(
    "Tell me what you want to build. I'll tell you which AI model to use."
  )
  .version("0.1.0");

// ── Main recommend command ──────────────────────────────────

program
  .argument("[task...]", "Task description")
  .option("--json", "Output as JSON")
  .option("--modality <type>", "Force modality (text, image, video, audio)")
  .option("--model <id>", "Override recommender LLM")
  .option("--max-price <dollars>", "Max price per unit", parseFloat)
  .option("--min-context <tokens>", "Min context length (text models)", parseInt)
  .option("--min-resolution <WxH>", "Min resolution (image models)")
  .option("--exclude <ids>", "Exclude model IDs (comma-separated)")
  .option("--sources <list>", "Catalog sources (comma-separated)")
  .option("--estimate <workload>", "Estimate cost for a workload")
  .option("--verbose", "Show raw response, token usage, cost")
  .option("--no-color", "Disable colored output")
  .action(async (taskWords: string[], options) => {
    const task = taskWords.join(" ");
    if (!task) {
      console.error(
        'Usage: whichmodel "generate product photos for my store"\n'
      );
      process.exit(2);
    }

    // Validate config
    const configError = validateConfig();
    if (configError) {
      console.error(configError);
      process.exit(3);
    }

    const spinner = ora("Fetching model catalog...").start();

    try {
      // 1. Fetch catalog
      const sources = buildSources(options.sources);
      const allModels: ModelEntry[] = [];

      const results = await Promise.allSettled(
        sources.map((s) => s.fetch())
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          allModels.push(...result.value);
        }
        // Warn but continue if a source fails
      }

      if (allModels.length === 0) {
        spinner.fail("No models found from any source");
        process.exit(4);
      }

      // Apply exclusions
      let models = allModels;
      if (options.exclude) {
        const excludePatterns = options.exclude.split(",").map((s: string) => s.trim());
        models = models.filter((m) =>
          !excludePatterns.some((p: string) =>
            p.endsWith("/*")
              ? m.id.includes(p.replace("/*", ""))
              : m.id === p
          )
        );
      }

      spinner.text = "Analyzing task and recommending models...";

      // 2. Get recommendation
      const rec = await recommend(task, models, {
        maxPrice: options.maxPrice,
        minContext: options.minContext,
        modality: options.modality,
      });

      spinner.stop();

      // 3. Format output
      if (options.json) {
        console.log(JSON.stringify(rec, null, 2));
      } else {
        const output = formatTerminal(rec, {
          recommenderModel: getConfig().recommenderModel,
          cost: 0.003, // TODO: calculate from actual token usage
        });
        console.log(output);
      }
    } catch (err) {
      spinner.fail(`Error: ${(err as Error).message}`);
      process.exit(1);
    }
  });

// ── Compare subcommand ──────────────────────────────────────

program
  .command("compare <modelA> <modelB>")
  .description("Compare two models head-to-head for a task")
  .requiredOption("--task <description>", "Task to compare for")
  .option("--json", "Output as JSON")
  .action(async (modelA: string, modelB: string, options) => {
    // TODO: implement comparison
    console.log(`Comparing ${modelA} vs ${modelB} for: ${options.task}`);
  });

// ── List subcommand ─────────────────────────────────────────

program
  .command("list")
  .description("List all available models")
  .option("--modality <type>", "Filter by modality")
  .option("--source <name>", "Filter by source")
  .option(
    "--sort <field>",
    'Sort by field (price, name, context)',
    "price"
  )
  .option("--json", "Output as JSON")
  .action(async (options) => {
    // TODO: implement listing
    console.log("Listing models...", options);
  });

// ── Stats subcommand ────────────────────────────────────────

program
  .command("stats")
  .description("Show catalog statistics")
  .action(async () => {
    // TODO: implement stats
    console.log("Catalog stats...");
  });

function buildSources(sourcesFlag?: string) {
  // For v1, always include OpenRouter
  // TODO: add fal, replicate based on available API keys
  return [new OpenRouterCatalog()];
}

export { program };
```

### 9.9 Config

```typescript
// src/config.ts

export interface Config {
  apiKey: string;
  recommenderModel: string;
  cacheTtl: number;
  falApiKey?: string;
  replicateApiToken?: string;
}

export function getConfig(): Config {
  return {
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
    recommenderModel:
      process.env.WHICHMODEL_MODEL ?? "deepseek/deepseek-v3.2",
    cacheTtl: parseInt(process.env.WHICHMODEL_CACHE_TTL ?? "3600", 10),
    falApiKey: process.env.FAL_API_KEY,
    replicateApiToken: process.env.REPLICATE_API_TOKEN,
  };
}

export function validateConfig(): string | null {
  const config = getConfig();

  if (!config.apiKey) {
    return [
      "Error: OPENROUTER_API_KEY is not set.",
      "",
      "Get your API key at: https://openrouter.ai/keys",
      "Then run:",
      "  export OPENROUTER_API_KEY=sk-or-...",
      "",
      "Or add it to your shell profile (~/.bashrc, ~/.zshrc)",
    ].join("\n");
  }

  return null;
}
```

### 9.10 Entry Point & Package Config

```typescript
// src/index.ts

import { program } from "./cli.js";
program.parse();
```

```jsonc
// package.json
{
  "name": "whichmodel",
  "version": "0.1.0",
  "description": "Tell me what you want to build. I'll tell you which AI model to use.",
  "type": "module",
  "bin": {
    "whichmodel": "./dist/index.js"
  },
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsup src/index.ts --format esm --dts --clean",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "tsc --noEmit && eslint src/",
    "prepublishOnly": "npm run build"
  },
  "files": ["dist"],
  "engines": {
    "node": ">=20.0.0"
  },
  "dependencies": {
    "commander": "^13.0.0",
    "chalk": "^5.4.0",
    "ora": "^8.2.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "tsx": "^4.19.0",
    "tsup": "^8.4.0",
    "vitest": "^3.1.0",
    "@types/node": "^22.0.0"
  },
  "keywords": ["ai", "llm", "model", "recommender", "cli", "openrouter"],
  "license": "MIT"
}
```

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

```typescript
// tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  target: "node20",
  banner: {
    js: "#!/usr/bin/env node",
  },
});
```

---

## 10. Pricing Normalization

### 10.1 The Challenge

Different modalities and providers use completely different pricing units. The tool must normalize and display pricing in units the user intuitively understands.

### 10.2 Pricing Display Per Modality

| Modality | Display Unit | Example |
|----------|-------------|---------|
| Text Generation | Per 1M tokens (input / output separately) | $3.00 / $15.00 per 1M tokens |
| Image Generation | Per image at standard resolution | $0.04 / image (1024×1024) |
| Video Generation | Per second of output | $0.05 / second |
| Text-to-Speech | Per 1K characters | $0.03 / 1K characters |
| Speech-to-Text | Per minute of audio | $0.006 / minute |
| Music Generation | Per second or per generation | $0.10 / generation |
| Embedding | Per 1M tokens | $0.10 / 1M tokens |
| Vision (image input) | Per image + per output token | $0.01 / image + $3.00 / 1M output tokens |

### 10.3 Pricing Formatter

```typescript
// src/formatter/pricing.ts

import type { ModelEntry } from "../types.js";

export function formatPricing(model: ModelEntry): string {
  const p = model.pricing;

  switch (p.type) {
    case "text":
      return `$${p.promptPer1mTokens} / $${p.completionPer1mTokens} per 1M tokens (in/out)`;
    case "image":
      if (p.perImage) return `$${p.perImage} / image`;
      if (p.perMegapixel) return `$${p.perMegapixel} / megapixel`;
      return "pricing varies";
    case "video":
      if (p.perSecond) return `$${p.perSecond} / second`;
      if (p.perGeneration) return `$${p.perGeneration} / generation`;
      return "pricing varies";
    case "audio":
      if (p.perMinute) return `$${p.perMinute} / minute`;
      if (p.perCharacter) return `$${(p.perCharacter * 1000).toFixed(3)} / 1K characters`;
      return "pricing varies";
    case "embedding":
      return `$${p.per1mTokens} / 1M tokens`;
    default:
      return "pricing unknown";
  }
}
```

### 10.4 Cost Estimation Workloads

The LLM should estimate cost based on a reasonable assumed workload for the task. If the user provides `--estimate`, use their numbers instead.

| Task Type | Default Assumed Workload |
|-----------|------------------------|
| Text: blog writing | 50 articles/month, ~2000 tokens each |
| Text: chatbot | 1000 conversations/day, ~500 tokens each |
| Image: product photos | 300 images/month |
| Video: ad clips | 50 clips/month, ~15 seconds each |
| TTS: voiceover | 100 articles/month, ~5000 characters each |
| STT: transcription | 100 hours/month |
| Embedding: search | 1M documents indexed, 10K queries/day |

---

## 11. Output Formats

### 11.1 Default (Pretty Terminal)

#### Text Task Example

```
$ whichmodel "summarize legal contracts and flag risks"

🔍 Task Analysis
   Modality: TEXT GENERATION
   Input-heavy comprehension task. Needs strong reasoning, long context
   (contracts can be 50-100 pages), and structured output. Accuracy is
   critical — hallucinated legal advice is dangerous.

💰 Cheapest — deepseek/deepseek-v3.2
   $0.26 / $0.38 per 1M tokens (in/out) · Context: 164K
   Strong reasoning at the lowest price point. 164K context handles
   most contracts. May occasionally miss subtle legal nuances.
   Est. ~$8/mo for 200 contracts, ~15K tokens each

⚖️  Balanced — google/gemini-2.5-flash
   $0.15 / $0.60 per 1M tokens (in/out) · Context: 1M
   Million-token context means no chunking needed for any contract.
   Strong analytical reasoning. Excellent structured output.
   Est. ~$18/mo for 200 contracts, ~15K tokens each

🏆 Best — anthropic/claude-sonnet-4
   $3.00 / $15.00 per 1M tokens (in/out) · Context: 200K
   Best-in-class document comprehension. Excellent at nuanced legal
   analysis, catching edge cases, and structured risk assessment.
   Est. ~$420/mo for 200 contracts, ~15K tokens each

⚡ This recommendation cost $0.003
```

#### Image Task Example

```
$ whichmodel "create social media graphics for a coffee brand"

🔍 Task Analysis
   Modality: IMAGE GENERATION
   Commercial brand imagery. Needs consistent style, warm color palette,
   text rendering capability, and multiple aspect ratios (1:1 for
   Instagram, 16:9 for Twitter/LinkedIn).

💰 Cheapest — fal::stabilityai/stable-diffusion-xl
   $0.003 / image (512×512) · $0.01 / image (1024×1024)
   Good quality at rock-bottom pricing. Requires more prompt
   engineering for brand consistency. ControlNet for composition.
   Est. ~$3/mo for 300 graphics

⚖️  Balanced — fal::black-forest-labs/flux-1.1-pro
   $0.04 / image (1024×1024)
   Excellent prompt adherence and aesthetic quality. Better text
   rendering than SDXL. Consistent style with minimal iteration.
   Est. ~$12/mo for 300 graphics

🏆 Best — fal::ideogram/ideogram-v3
   $0.08 / image (1024×1024)
   Best text rendering in images (perfect for brand overlays,
   social captions). Premium aesthetic quality. Magic Prompt
   feature auto-enhances your prompts.
   Est. ~$24/mo for 300 graphics

💡 Tip: For brand consistency, consider generating a style reference
   image first, then using image-to-image for variations.

⚡ This recommendation cost $0.003
```

#### Video Task Example

```
$ whichmodel "create 15-second product demo videos from screenshots"

🔍 Task Analysis
   Modality: VIDEO GENERATION
   Image-to-video generation. Input is product screenshots, output is
   short demo clips with smooth transitions and motion. 15 seconds is
   moderate length.

💰 Cheapest — fal::minimax/video-01
   $0.35 / generation (~5 seconds)
   Decent motion quality at the lowest price. May need to generate
   3 clips and stitch for 15 seconds.
   Est. ~$53/mo for 50 product videos (3 clips each)

⚖️  Balanced — fal::kling-ai/kling-v2
   $0.60 / generation (~10 seconds)
   Strong motion quality, good with product-style content. Better
   coherence over longer durations than competitors at this price.
   Est. ~$60/mo for 50 product videos (2 clips each)

🏆 Best — replicate::runway/gen3-alpha-turbo
   $0.10 / second
   Industry-leading motion quality and control. Camera motion
   presets perfect for product demos.
   Est. ~$75/mo for 50 videos at 15 seconds each

⚡ This recommendation cost $0.003
```

### 11.2 JSON Output (`--json`)

```json
{
  "task": "create social media graphics for a coffee brand",
  "taskAnalysis": {
    "summary": "Commercial brand image generation",
    "detectedModality": "image",
    "modalityReasoning": "Task requires generating visual graphics as output",
    "keyRequirements": ["brand consistency", "text rendering", "multiple aspect ratios"],
    "costFactors": "Number of images generated per month, resolution needs"
  },
  "recommendations": {
    "cheapest": {
      "id": "fal::stabilityai/stable-diffusion-xl",
      "reason": "Good quality at rock-bottom pricing...",
      "pricingSummary": "$0.003 / image (512×512)",
      "estimatedCost": "$3/mo for 300 graphics"
    },
    "balanced": { "...": "..." },
    "best": { "...": "..." }
  },
  "alternativesInOtherModalities": null,
  "meta": {
    "recommenderModel": "deepseek/deepseek-v3.2",
    "recommendationCostUsd": 0.003,
    "catalogSources": ["openrouter", "fal"],
    "catalogTotalModels": 412,
    "catalogModelsInModality": 47,
    "timestamp": "2025-07-15T10:30:00Z"
  }
}
```

---

## 12. CLI Interface Specification

### 12.1 Commands & Flags

```bash
# ─── Primary: Recommend ───────────────────────────────────────
whichmodel "generate product photos for my shopify store"

# Force modality
whichmodel "create engaging content for TikTok" --modality video

# With constraints
whichmodel "generate product photos" --max-price 0.05 --min-resolution 1024x1024
whichmodel "analyze long documents" --max-price 5 --min-context 128000

# Specify catalog sources
whichmodel "generate anime artwork" --sources fal,replicate

# JSON output
whichmodel "transcribe podcast episodes" --json

# Verbose
whichmodel "build a chatbot" --verbose

# Override recommender
whichmodel "write unit tests" --model openai/gpt-4o-mini

# Exclude
whichmodel "generate images" --exclude "openai/*,stability/*"

# Cost estimation with specific workload
whichmodel "generate product photos" \
  --estimate "500 images per month at 1024x1024"

# ─── Compare ──────────────────────────────────────────────────
whichmodel compare "fal::flux-pro" "openrouter::dall-e-3" \
  --task "product photography"

# ─── List & Explore ──────────────────────────────────────────
whichmodel list                             # All models
whichmodel list --modality image            # Image models only
whichmodel list --modality text --sort price # Text models by price
whichmodel list --source fal                # Only fal.ai models

# ─── Stats ────────────────────────────────────────────────────
whichmodel stats
#  Catalog: 412 models from 3 sources
#  ┌────────────────┬───────┬─────────────────────────────┐
#  │ Modality       │ Count │ Price Range                 │
#  ├────────────────┼───────┼─────────────────────────────┤
#  │ Text           │  287  │ $0.01 - $60.00 / 1M tokens  │
#  │ Image          │   52  │ $0.003 - $0.12 / image      │
#  │ Video          │   18  │ $0.05 - $0.50 / second      │
#  │ Audio (TTS)    │   12  │ $0.015 - $0.30 / 1K chars   │
#  │ Audio (STT)    │    8  │ $0.006 - $0.10 / minute     │
#  │ Embedding      │   22  │ $0.01 - $0.50 / 1M tokens   │
#  │ Vision         │   13  │ $0.01 - $0.08 / image       │
#  └────────────────┴───────┴─────────────────────────────┘
```

### 12.2 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENROUTER_API_KEY` | Yes (v1) | — | OpenRouter API key |
| `FAL_API_KEY` | No | — | fal.ai API key (enables image/video catalog) |
| `REPLICATE_API_TOKEN` | No | — | Replicate API key (enables broader catalog) |
| `WHICHMODEL_MODEL` | No | `deepseek/deepseek-v3.2` | Recommender model override |
| `WHICHMODEL_CACHE_TTL` | No | `3600` | Catalog cache TTL in seconds |
| `NO_COLOR` | No | — | Disable colored output (standard) |

### 12.3 Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | No API key configured for any source |
| 4 | Network error |
| 5 | LLM recommendation failed after retries |

---

## 13. Error Handling

### 13.1 Error Scenarios

| Scenario | Behavior |
|----------|----------|
| No API key for any source | `Error: OPENROUTER_API_KEY not set. Get one at https://openrouter.ai/keys` |
| OpenRouter API down | Retry 3x → use cache if available → fail with message |
| fal/Replicate API down | Warn, continue with available sources |
| Recommender LLM fails | Retry 3x → fallback mode (price-sorted list) |
| Invalid JSON from LLM | Retry once with stricter prompt → show raw in `--verbose` |
| Non-existent model ID recommended | Retry with correction → warn + show closest match |
| Ambiguous modality | LLM states assumption in taskAnalysis; user can override with `--modality` |
| No models found for detected modality | Tell user which sources to configure for that modality |

### 13.2 Fallback Mode

```
⚠️  LLM recommendation failed. Showing price-sorted models instead.

Detected modality: IMAGE (based on keywords)

Cheapest image generation models:
  1. fal::stabilityai/sdxl          — $0.003/image
  2. fal::black-forest-labs/flux    — $0.04/image
  3. openrouter::openai/dall-e-3    — $0.04/image

Note: These are not task-specific. Retry or use: whichmodel "<task>" --model gpt-4o-mini
```

### 13.3 Missing Source Guidance

```
$ whichmodel "generate a 30-second product video"

⚠️  No video generation models available.
    Video models require fal.ai or Replicate catalog access.

    To enable:
      export FAL_API_KEY=your_key        # Get at fal.ai/dashboard
      export REPLICATE_API_TOKEN=your_key # Get at replicate.com/account

    Or run with text-only sources:
      whichmodel "write a script for a 30-second product video" --modality text
```

---

## 14. Non-Functional Requirements

### 14.1 Performance

| Metric | Target |
|--------|--------|
| End-to-end latency | < 10 seconds (single source) · < 15 seconds (multi-source) |
| Catalog fetch (per source) | < 3 seconds |
| Multi-source fetch | Parallel via `Promise.allSettled`, total < 5 seconds |
| LLM call | < 8 seconds |
| Startup time | < 300ms (Node.js) |

### 14.2 Cost

| Component | Cost |
|-----------|------|
| Catalog API calls | Free (OpenRouter) / Free (fal, Replicate list endpoints) |
| Recommender LLM input | ~20-30K tokens × $0.26/1M = ~$0.006 |
| Recommender LLM output | ~400-600 tokens × $0.38/1M = ~$0.0002 |
| **Total per recommendation** | **~$0.003 - $0.007** |

### 14.3 Compatibility

| Requirement | Detail |
|-------------|--------|
| Node.js | ≥ 20 (native fetch, stable) |
| Bun | ≥ 1.0 (works out of the box) |
| OS | Linux, macOS, Windows |
| Install | `npm i -g whichmodel` / `npx whichmodel` / `bunx whichmodel` |

### 14.4 Package Size

| Target | Rationale |
|--------|-----------|
| < 500KB packed | CLI tools should be lightweight |
| 3 runtime deps | `commander`, `chalk`, `ora` — all well-maintained, minimal |
| Zero native deps | No `node-gyp`, works everywhere without build tools |

---

## 15. Testing Strategy

### 15.1 Unit Tests

```typescript
// Example: tests/catalog/openrouter.test.ts
import { describe, it, expect, vi } from "vitest";
import { OpenRouterCatalog } from "../../src/catalog/openrouter.js";

describe("OpenRouterCatalog", () => {
  it("normalizes model to ModelEntry", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [{
          id: "anthropic/claude-sonnet-4",
          name: "Claude Sonnet 4",
          pricing: { prompt: "0.000003", completion: "0.000015" },
          context_length: 200000,
          architecture: {
            input_modalities: ["text", "image"],
            output_modalities: ["text"],
          },
        }],
      }),
    }));

    const catalog = new OpenRouterCatalog();
    const models = await catalog.fetch();

    expect(models).toHaveLength(1);
    expect(models[0]).toMatchObject({
      id: "openrouter::anthropic/claude-sonnet-4",
      source: "openrouter",
      modality: "vision",
      pricing: {
        type: "text",
        promptPer1mTokens: 3.0,
        completionPer1mTokens: 15.0,
      },
    });
  });

  it("filters out models with zero pricing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        data: [{
          id: "free/model",
          pricing: { prompt: "0", completion: "0" },
          context_length: 4096,
        }],
      }),
    }));

    const catalog = new OpenRouterCatalog();
    const models = await catalog.fetch();

    expect(models).toHaveLength(0);
  });
});
```

### 15.2 Test Coverage Targets

| Module | What to Test | Coverage |
|--------|-------------|----------|
| `catalog/openrouter.ts` | Normalization, modality classification, filtering, error handling | >90% |
| `catalog/compressor.ts` | Compression logic, grouping | >95% |
| `recommender/prompts.ts` | Prompt assembly with various inputs | >90% |
| `recommender/validator.ts` | ID validation, closest-match | >95% |
| `recommender/fallback.ts` | Fallback sorting per modality | >90% |
| `formatter/pricing.ts` | All modality pricing formats | >95% |
| `formatter/terminal.ts` | Output structure, edge cases | >85% |
| `config.ts` | Env vars, defaults, validation | >95% |
| `cli.ts` | Arg parsing, flag combos, exit codes | >80% |

### 15.3 Integration Tests

| Test | Method |
|------|--------|
| Full happy path (each modality) | Mock fetch → verify end-to-end output |
| Multi-source aggregation | Mock OpenRouter + fal → verify merged catalog |
| Source failure resilience | Mock one source 500 → verify graceful degradation |
| Modality detection accuracy | 20 task descriptions → verify via snapshot |
| LLM failure → fallback | Mock LLM 500 → verify fallback output |

### 15.4 Smoke Tests (Live)

```bash
# Text tasks
whichmodel "write marketing emails for a SaaS product"
whichmodel "analyze financial reports and extract KPIs"

# Image tasks
whichmodel "generate product photos for an online store"
whichmodel "create pixel art sprites for a game"

# Video tasks
whichmodel "create 15-second product demo videos"

# Audio tasks
whichmodel "add voiceover narration to my YouTube videos"
whichmodel "transcribe and summarize meeting recordings"

# Edge cases
whichmodel "write video scripts"                    # → TEXT
whichmodel "describe what's in these product images" # → VISION
whichmodel "build a semantic search engine"          # → EMBEDDING
```

---

## 16. Milestones & Roadmap

### Phase 1: MVP — Text Models (Week 1-2)

- [ ] Core flow: task → fetch OpenRouter → LLM recommend → pretty output
- [ ] Modality-aware prompt (text, vision, embedding from OpenRouter)
- [ ] `--json`, `--verbose`, `--no-color` flags
- [ ] Basic error handling + retry
- [ ] npm package published
- [ ] `npx whichmodel` works

### Phase 2: Multi-Modality (Week 3-4)

- [ ] fal.ai catalog integration (image, video, audio models)
- [ ] Pricing normalization across modalities
- [ ] `--modality` flag for manual override
- [ ] `--sources` flag
- [ ] Parallel catalog fetching with `Promise.allSettled`
- [ ] Missing source guidance messages

### Phase 3: Power Features (Week 5-6)

- [ ] Replicate catalog integration
- [ ] `whichmodel compare` subcommand
- [ ] `whichmodel list` and `whichmodel stats` subcommands
- [ ] `--max-price`, `--min-context`, `--min-resolution` filters
- [ ] `--exclude` flag
- [ ] `--estimate` workload cost projection
- [ ] Catalog caching with TTL (file-based, `~/.cache/whichmodel/`)
- [ ] Config file support (`~/.config/whichmodel/config.json`)

### Phase 4: Polish & Launch (Week 7-8)

- [ ] Test suite >80% coverage
- [ ] CI/CD pipeline (GitHub Actions)
- [ ] README with examples and terminal GIFs
- [ ] `brew` formula
- [ ] Blog post / launch on Hacker News
- [ ] Optional anonymous usage analytics (opt-in)

### Future (v1.x+)

- [ ] Static model entries (Midjourney, Suno, Udio — no API)
- [ ] `whichmodel bench` — generate a sample output with each recommended model
- [ ] Plugin system for custom catalog sources
- [ ] Web UI companion (`whichmodel serve` with a simple local server)
- [ ] VS Code extension
- [ ] Team/org shared configs
- [ ] Historical price tracking + alerts ("Flux Pro dropped 30%")
- [ ] "Model of the week" based on new releases + price drops
- [ ] MCP server for agent integration

---

## 17. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Different providers use incompatible pricing units | Confusing recommendations | High | Strict normalization layer; display modality-appropriate units |
| Modality detection wrong for ambiguous tasks | User gets irrelevant recommendations | Medium | LLM reasoning + `--modality` override + clear detection display |
| Catalog grows to 500+ models | Token cost increases | Medium | Aggressive pre-filter; remove deprecated, duplicates, zero-pricing |
| Provider APIs change schemas | Catalog adapters break | Medium | Per-source adapters with versioning; integration tests |
| Image/video model pricing too varied to normalize | Apples-to-oranges comparisons | Medium | Display native pricing units; LLM handles comparison reasoning |
| Users expect the tool to generate outputs | Scope misunderstanding | Low | Clear messaging: "we recommend, we don't generate" |
| DeepSeek V3.2 deprecated | Default recommender breaks | Medium | Fallback chain, configurable override |

---

## 18. Open Questions

| # | Question | Status |
|---|----------|--------|
| 1 | Should `whichmodel bench` actually generate a sample with each model? | Open — high value but adds complexity, cost, multi-provider auth |
| 2 | How to handle models that span modalities (GPT-4o does text + vision + image gen)? | List in primary modality with a cross-modality note |
| 3 | Should we scrape pricing for models without APIs (Midjourney: $10/mo subscription)? | v1: no. v1.x: static entries with subscription pricing noted |
| 4 | Should the recommender model be auto-selected? | No — circular. Hardcode default with `--model` override |
| 5 | Name: `whichmodel`, `pickmodel`, `whichmodel`, `airec`? | Open — decide before npm publish |
| 6 | Should we publish as an MCP server too for agent consumption? | Future — high value, low effort once core exists |
| 7 | Bun-first or Node-first? | Node-first for compatibility, but test on Bun in CI |
