# Output Examples

> **Version:** 1.0
> **Last Updated:** 2025-02-23
> **Status:** Production (Phase 1)

---

## Overview

This document provides complete examples of all output formats for `whichmodel`. Use these as the contract for output formatting code.

---

## Terminal Output

### Text Task Example

**Command:**
```bash
whichmodel "summarize legal contracts and flag risks"
```

**Output:**
```
🔍 Task Analysis
   Modality: TEXT
   Input-heavy comprehension task. Needs strong reasoning, long context
   (contracts can be 50-100 pages), and structured output. Accuracy is
   critical — hallucinated legal advice is dangerous.

💰 Cheapest — openrouter::deepseek/deepseek-v3.2
   $0.26 / $0.38 per 1M tokens (in/out) · Context: 164K
   Strong reasoning at the lowest price point. 164K context handles
   most contracts. May occasionally miss subtle legal nuances.
   Est. ~$8/mo for 200 contracts, ~15K tokens each

⚖️  Balanced — openrouter::google/gemini-2.5-flash
   $0.15 / $0.60 per 1M tokens (in/out) · Context: 1M
   Million-token context means no chunking needed for any contract.
   Strong analytical reasoning. Excellent structured output.
   Est. ~$18/mo for 200 contracts, ~15K tokens each

🏆 Best — openrouter::anthropic/claude-sonnet-4
   $3.00 / $15.00 per 1M tokens (in/out) · Context: 200K
   Best-in-class document comprehension. Excellent at nuanced legal
   analysis, catching edge cases, and structured risk assessment.
   Est. ~$420/mo for 200 contracts, ~15K tokens each

⚡ This recommendation cost $0.003 (deepseek/deepseek-v3.2)
```

---

### Image Task Example (Phase 2)

**Command:**
```bash
whichmodel "create social media graphics for a coffee brand"
```

**Output:**
```
🔍 Task Analysis
   Modality: IMAGE
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

⚡ This recommendation cost $0.003 (deepseek/deepseek-v3.2)
```

---

### Video Task Example (Phase 2)

**Command:**
```bash
whichmodel "create 15-second product demo videos from screenshots"
```

**Output:**
```
🔍 Task Analysis
   Modality: VIDEO
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

⚡ This recommendation cost $0.003 (deepseek/deepseek-v3.2)
```

---

### Audio TTS Task Example (Phase 2)

**Command:**
```bash
whichmodel "add voiceover narration to my blog posts"
```

**Output:**
```
🔍 Task Analysis
   Modality: AUDIO_TTS
   Converting written content to natural speech. Needs clear voice,
   natural prosody, and good handling of varied sentence structures.
   Blog length (2,000-5,000 characters) is standard.

💰 Cheapest — openrouter::openai/tts-1
   $0.015 / 1K characters
   Fast and affordable. Good quality for the price. Slight metallic
   artifacts in complex passages.
   Est. ~$1.50/mo for 100 blog posts (~3K chars each)

⚖️  Balanced — elevenlabs::eleven_multilingual_v2
   $0.030 / 1K characters
   Excellent natural prosody and emotion. Best-in-class voice quality.
   Handles technical terms well.
   Est. ~$9/mo for 100 blog posts (~3K chars each)

🏆 Best — elevenlabs::eleven_turbo_v2_5
   $0.030 / 1K characters
   Fastest generation with top quality. Perfect for high-volume
   production. Voice cloning available for brand consistency.
   Est. ~$9/mo for 100 blog posts (~3K chars each)

⚡ This recommendation cost $0.003 (deepseek/deepseek-v3.2)
```

---

### Audio STT Task Example (Phase 2)

**Command:**
```bash
whichmodel "transcribe my podcast episodes"
```

**Output:**
```
🔍 Task Analysis
   Modality: AUDIO_STT
   Speech-to-text for podcast content. Needs accurate transcription,
   speaker diarization for interviews, and timestamp support.
   Typical episodes: 30-60 minutes.

💰 Cheapest — openrouter::openai/whisper-1
   $0.006 / minute
   Excellent accuracy for the price. Supports 50+ languages.
   Good with background music and multiple speakers.
   Est. ~$3.60/mo for 10 hours of content

⚖️  Balanced — assemblyai::best
   $0.025 / minute
   Superior diarization and punctuation. Speaker labels included.
   Best for interview-style podcasts.
   Est. ~$15/mo for 10 hours of content

🏆 Best — deepgram::nova-2
   $0.0048 / minute
   Fastest transcription with excellent accuracy. Real-time
   streaming available. Best for high-volume production.
   Est. ~$2.88/mo for 10 hours of content

⚡ This recommendation cost $0.003 (deepseek/deepseek-v3.2)
```

---

### Vision Task Example

**Command:**
```bash
whichmodel "analyze screenshots of competitor websites"
```

**Output:**
```
🔍 Task Analysis
   Modality: VISION
   Image understanding for web screenshots. Needs layout analysis,
   text extraction (OCR), design pattern recognition, and
   comparative analysis capabilities.

💰 Cheapest — openrouter::google/gemini-2.0-flash
   $0.10 / $0.40 per 1M tokens · Image: $0.0025/image
   Fast and affordable. Good at layout and text extraction.
   May miss subtle design nuances.
   Est. ~$0.50 for 100 screenshots

⚖️  Balanced — openrouter::google/gemini-2.5-flash
   $0.15 / $0.60 per 1M tokens · Image: $0.0038/image
   Better reasoning and analysis. Handles complex layouts well.
   Good at comparative analysis.
   Est. ~$0.80 for 100 screenshots

🏆 Best — openrouter::anthropic/claude-sonnet-4
   $3.00 / $15.00 per 1M tokens · Image: $0.0048/image
   Best-in-class visual reasoning. Excellent at nuanced design
   analysis and pattern recognition.
   Est. ~$3.50 for 100 screenshots

⚡ This recommendation cost $0.003 (deepseek/deepseek-v3.2)
```

---

### Embedding Task Example

**Command:**
```bash
whichmodel "build a search engine for my documentation"
```

**Output:**
```
🔍 Task Analysis
   Modality: EMBEDDING
   Vector embeddings for semantic search. Needs high-quality
   representations, good retrieval performance, and reasonable
   dimensionality for storage efficiency.

💰 Cheapest — openrouter::text-embedding-3-small
   $0.02 / 1M tokens
   Good quality at lowest price. 1536 dimensions. Solid
   retrieval performance for general use.
   Est. ~$0.20 for 10M tokens of documentation

⚖️  Balanced — openrouter::voyage-3-large
   $0.12 / 1M tokens
   Excellent retrieval quality. 1024 dimensions (efficient).
   Best for technical documentation.
   Est. ~$1.20 for 10M tokens of documentation

🏆 Best — openrouter::cohere/embed-english-v3.0
   $0.10 / 1M tokens
   Top retrieval scores. Optimized for RAG applications.
   Compression options for storage efficiency.
   Est. ~$1.00 for 10M tokens of documentation

⚡ This recommendation cost $0.003 (deepseek/deepseek-v3.2)
```

---

## JSON Output

### Full JSON Schema

**Command:**
```bash
whichmodel "summarize legal contracts" --json
```

**Output:**
```json
{
  "task": "summarize legal contracts and flag risks",
  "taskAnalysis": {
    "summary": "Legal document summarization with risk identification",
    "detectedModality": "text",
    "modalityReasoning": "Task requires text output summarizing legal documents",
    "keyRequirements": [
      "long context",
      "reasoning",
      "accuracy",
      "structured output"
    ],
    "costFactors": "Input-heavy, documents can be 50-100 pages"
  },
  "recommendations": {
    "cheapest": {
      "id": "openrouter::deepseek/deepseek-v3.2",
      "reason": "Strong reasoning at the lowest price point. 164K context handles most contracts. May occasionally miss subtle legal nuances.",
      "pricingSummary": "$0.26 / $0.38 per 1M tokens (in/out)",
      "estimatedCost": "~$8/mo for 200 contracts, ~15K tokens each"
    },
    "balanced": {
      "id": "openrouter::google/gemini-2.5-flash",
      "reason": "Million-token context means no chunking needed for any contract. Strong analytical reasoning. Excellent structured output.",
      "pricingSummary": "$0.15 / $0.60 per 1M tokens (in/out)",
      "estimatedCost": "~$18/mo for 200 contracts, ~15K tokens each"
    },
    "best": {
      "id": "openrouter::anthropic/claude-sonnet-4",
      "reason": "Best-in-class document comprehension. Excellent at nuanced legal analysis, catching edge cases, and structured risk assessment.",
      "pricingSummary": "$3.00 / $15.00 per 1M tokens (in/out)",
      "estimatedCost": "~$420/mo for 200 contracts, ~15K tokens each"
    }
  },
  "alternativesInOtherModalities": null,
  "meta": {
    "recommenderModel": "deepseek/deepseek-v3.2",
    "recommendationCostUsd": 0.00697,
    "promptTokens": 25430,
    "completionTokens": 412,
    "catalogSources": ["openrouter"],
    "catalogTotalModels": 312,
    "catalogModelsInModality": 287,
    "timestamp": "2025-02-23T14:30:00.123Z",
    "version": "0.1.0"
  }
}
```

---

## Verbose Output

**Command:**
```bash
whichmodel "summarize legal contracts" --verbose
```

**Output:**
```
🔍 Task Analysis
   Modality: TEXT
   Input-heavy comprehension task. Needs strong reasoning, long context
   (contracts can be 50-100 pages), and structured output.

💰 Cheapest — openrouter::deepseek/deepseek-v3.2
   $0.26 / $0.38 per 1M tokens (in/out) · Context: 164K
   Strong reasoning at the lowest price point.
   Est. ~$8/mo for 200 contracts, ~15K tokens each

⚖️  Balanced — openrouter::google/gemini-2.5-flash
   $0.15 / $0.60 per 1M tokens (in/out) · Context: 1M
   Million-token context means no chunking needed.
   Est. ~$18/mo for 200 contracts, ~15K tokens each

🏆 Best — openrouter::anthropic/claude-sonnet-4
   $3.00 / $15.00 per 1M tokens (in/out) · Context: 200K
   Best-in-class document comprehension.
   Est. ~$420/mo for 200 contracts, ~15K tokens each

📊 Details:
   Catalog fetch:      1.11s
   Catalog models:     312
   Models in modality: 287
   Prompt tokens:      25,430
   Completion tokens:  412
   LLM latency:        3.16s
   Total time:         4.28s

   Recommender: deepseek/deepseek-v3.2
   Cost breakdown:
     Input:  $0.00681 (25,430 × $0.26/1M)
     Output: $0.00016 (412 × $0.38/1M)
     Total:  $0.00697
```

---

## Error Output

### Terminal Error

```
Error: OPENROUTER_API_KEY is not set.

To get an API key:
  1. Visit https://openrouter.ai/keys
  2. Create an account or sign in
  3. Generate a new API key

Then set it in your shell:
  export OPENROUTER_API_KEY=sk-or-...
```

### JSON Error

```json
{
  "error": {
    "code": 3,
    "message": "OPENROUTER_API_KEY is not set",
    "recoveryHint": "Set the OPENROUTER_API_KEY environment variable",
    "documentationUrl": "https://github.com/whichmodel/whichmodel#configuration"
  }
}
```

---

## Fallback Output

When LLM fails:

```
⚠️  LLM recommendation failed. Showing price-sorted models instead.

Detected modality: TEXT (based on keywords)

Cheapest text models:
  1. openrouter::deepseek/deepseek-v3.2  — $0.26 / $0.38 per 1M tokens
  2. openrouter::google/gemini-2.0-flash — $0.10 / $0.40 per 1M tokens
  3. openrouter::meta-llama/llama-3.3-70b — $0.35 / $0.40 per 1M tokens

Balanced text models:
  1. openrouter::google/gemini-2.5-flash — $0.15 / $0.60 per 1M tokens
  2. openrouter::anthropic/claude-3.5-sonnet — $0.30 / $1.50 per 1M tokens
  3. openrouter::openai/gpt-4o-mini — $0.15 / $0.60 per 1M tokens

Best text models:
  1. openrouter::openai/gpt-4o — $2.50 / $10.00 per 1M tokens
  2. openrouter::anthropic/claude-sonnet-4 — $3.00 / $15.00 per 1M tokens
  3. openrouter::openai/o1 — $15.00 / $60.00 per 1M tokens

Note: These are not task-specific recommendations.
To use a different recommender model:
  whichmodel "<task>" --model openai/gpt-4o-mini
```

---

## Unicode/Emoji Reference

Icons used in terminal output:

| Icon | Usage | Unicode |
|------|-------|---------|
| 🔍 | Task Analysis | U+1F50D |
| 💰 | Cheapest | U+1F4B0 |
| ⚖️ | Balanced | U+2696 |
| 🏆 | Best | U+1F3C6 |
| 💡 | Tip | U+1F4A1 |
| ⚡ | Cost/Meta | U+26A1 |
| ⚠️ | Warning | U+26A0 |
| ✗ | Failure | U+2717 |
| ✓ | Success | U+2713 |

---

## Line Width

Maximum line width for terminal output: **80 characters**

Long lines should wrap with appropriate indentation:

```
💰 Cheapest — openrouter::deepseek/deepseek-v3.2
   $0.26 / $0.38 per 1M tokens (in/out) · Context: 164K
   Strong reasoning at the lowest price point. 164K context handles
   most contracts. May occasionally miss subtle legal nuances.
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-02-23 | Initial output examples |
