# Error Handling Specification

> **Version:** 1.0
> **Last Updated:** 2025-02-23
> **Status:** Production (Phase 1)

---

## Overview

This document defines all error scenarios, user-facing messages, and recovery strategies for `whichmodel`.

---

## Error Categories

### 1. Configuration Errors (Exit Code 3)

Missing or invalid configuration before the tool can run.

### 2. Input Errors (Exit Code 2)

Invalid user input that can be corrected.

### 3. Network Errors (Exit Code 4, 6)

Network-related failures when fetching catalogs or calling LLM.

### 4. LLM Errors (Exit Code 5)

Failures in the recommendation engine.

### 5. General Errors (Exit Code 1)

Unexpected errors not covered by other categories.

---

## Error Scenarios

### Configuration Errors

#### E001: Missing API Key

**Trigger:** `OPENROUTER_API_KEY` environment variable not set

**Exit Code:** 3

**Message:**
```
Error: OPENROUTER_API_KEY is not set.

To get an API key:
  1. Visit https://openrouter.ai/keys
  2. Create an account or sign in
  3. Generate a new API key

Then set it in your shell:
  export OPENROUTER_API_KEY=sk-or-...

Or add it to your shell profile (~/.bashrc, ~/.zshrc):
  echo 'export OPENROUTER_API_KEY=sk-or-...' >> ~/.zshrc
  source ~/.zshrc
```

---

#### E002: Invalid API Key

**Trigger:** OpenRouter API returns 401 Unauthorized

**Exit Code:** 1

**Message:**
```
Error: Invalid OpenRouter API key.

Please check that:
  • Your API key is correct (starts with sk-or-...)
  • Your API key hasn't been revoked
  • You have credits in your account

Check your key at: https://openrouter.ai/keys
```

---

#### E003: Insufficient Credits

**Trigger:** OpenRouter API returns 402 Payment Required

**Exit Code:** 1

**Message:**
```
Error: Insufficient credits in your OpenRouter account.

Add credits at: https://openrouter.ai/credits

Current model (deepseek/deepseek-v3.2) costs ~$0.007 per recommendation.
```

---

### Input Errors

#### E010: Missing Task Description

**Trigger:** No task argument provided

**Exit Code:** 2

**Message:**
```
Error: Task description required.

Usage: whichmodel <task>

Examples:
  whichmodel "summarize legal contracts"
  whichmodel "generate product photos"
  whichmodel "transcribe my podcast"

Run 'whichmodel --help' for more information.
```

---

#### E011: Task Too Long

**Trigger:** Task description exceeds 2000 characters

**Exit Code:** 2

**Message:**
```
Error: Task description too long (2500 characters).

Please shorten your description to under 2000 characters.
Focus on the core requirements rather than detailed context.
```

---

#### E012: Invalid Modality

**Trigger:** `--modality` flag has invalid value

**Exit Code:** 2

**Message:**
```
Error: Invalid modality 'foo'.

Valid modalities:
  text              Text generation (writing, coding, analysis)
  image             Image generation (photos, art, graphics)
  video             Video generation (clips, animations)
  audio_tts         Text-to-speech (voiceover, narration)
  audio_stt         Speech-to-text (transcription)
  audio_generation  Music/sound generation
  vision            Image understanding (analysis, OCR)
  embedding         Vector embeddings (search, RAG)
  multimodal        Multi-purpose models

Example: whichmodel "generate images" --modality image
```

---

#### E013: Invalid Price Format

**Trigger:** `--max-price` is not a valid number

**Exit Code:** 2

**Message:**
```
Error: Invalid price format 'abc'.

--max-price expects a number in USD.

Example: --max-price 0.05
```

---

#### E014: Invalid Resolution Format

**Trigger:** `--min-resolution` is not in WxH format

**Exit Code:** 2

**Message:**
```
Error: Invalid resolution format '1024'.

--min-resolution expects WIDTHxHEIGHT format.

Example: --min-resolution 1024x1024
         --min-resolution 1920x1080
```

---

### Network Errors

#### E020: Catalog Fetch Timeout

**Trigger:** OpenRouter catalog API times out (>10s)

**Exit Code:** 6

**Message:**
```
Error: Timeout fetching model catalog from OpenRouter.

This could be due to:
  • Slow network connection
  • OpenRouter API experiencing issues

Suggestions:
  • Check your internet connection
  • Try again in a few minutes
  • Use --sources with an alternative if configured

Status page: https://status.openrouter.ai
```

**Recovery:** Retry 3 times with exponential backoff, then fail

---

#### E021: Catalog Fetch Failed

**Trigger:** OpenRouter API returns 500/502/503

**Exit Code:** 6

**Message:**
```
Error: Unable to fetch model catalog (OpenRouter returned 503).

This usually means OpenRouter is experiencing temporary issues.

Suggestions:
  • Wait a few minutes and try again
  • Check https://status.openrouter.ai for known issues

Retrying automatically...
```

**Recovery:** Retry 3 times with exponential backoff (1s, 2s, 4s)

---

#### E022: All Sources Failed

**Trigger:** Multiple catalog sources configured, all failed

**Exit Code:** 4

**Message:**
```
Error: All catalog sources failed to respond.

Attempted sources:
  ✗ openrouter: 503 Service Unavailable
  ✗ fal: Connection timeout
  ✗ replicate: 401 Unauthorized

Suggestions:
  • Check your internet connection
  • Verify API keys are valid
  • Try again in a few minutes
```

---

### Filter/Result Errors

#### E030: No Models Found

**Trigger:** No models returned from any configured source

**Exit Code:** 4

**Message:**
```
Error: No models found from any source.

Configured sources: openrouter

If you expected more models:
  • Add FAL_API_KEY for image/video models
  • Add REPLICATE_API_TOKEN for broader coverage

Run 'whichmodel stats' to see available models.
```

---

#### E031: All Models Excluded

**Trigger:** Filters exclude all available models

**Exit Code:** 4

**Message:**
```
Error: All models excluded by filters.

Your filters:
  --max-price 0.001
  --min-context 1000000
  --exclude openai/*,anthropic/*

No models match all criteria.

Suggestions:
  • Increase --max-price (cheapest text model is $0.01/1M tokens)
  • Reduce --min-context (highest is 1M tokens)
  • Remove some exclusions
```

---

#### E032: No Models for Modality

**Trigger:** Detected/requested modality has no available models

**Exit Code:** 4

**Message:**
```
Error: No video generation models available.

Video models require additional catalog sources.

To enable:
  export FAL_API_KEY=your_key           # Get at fal.ai/dashboard
  export REPLICATE_API_TOKEN=your_key   # Get at replicate.com/account

Or describe your task differently:
  whichmodel "write a script for a product video" --modality text
```

---

### LLM Errors

#### E040: LLM Timeout

**Trigger:** LLM API times out (>30s)

**Exit Code:** 5 (after retries exhausted)

**Message:**
```
Error: Recommendation request timed out after 30 seconds.

This could mean:
  • OpenRouter is experiencing high load
  • The recommender model is slow to respond

Suggestions:
  • Try again (will use a different model)
  • Use --model to specify a faster model
  • Example: whichmodel "..." --model openai/gpt-4o-mini
```

**Recovery:** Retry with backoff, then use fallback

---

#### E041: LLM Rate Limited

**Trigger:** OpenRouter returns 429 Too Many Requests

**Exit Code:** 1 (after retries exhausted)

**Message:**
```
Error: Rate limited by OpenRouter.

You've made too many requests too quickly.

Waiting 60 seconds before retry...
```

**Recovery:** Wait 60s, retry with exponential backoff

---

#### E042: LLM Invalid JSON

**Trigger:** LLM returns invalid JSON

**Exit Code:** 5 (after retries exhausted)

**Message:**
```
Warning: LLM returned invalid JSON. Retrying with stricter prompt...
```

**Recovery:** Retry once, then use fallback mode

---

#### E043: LLM Recommended Invalid Model

**Trigger:** LLM recommends model ID not in catalog

**Exit Code:** 0 (warning only, auto-corrected)

**Message:**
```
Warning: LLM recommended invalid model ID 'claude-3-opus'.
Using closest match: openrouter::anthropic/claude-3-opus
```

**Recovery:** Find closest match or retry

---

### Fallback Mode

When LLM fails completely, use deterministic fallback:

#### Fallback Output

```
⚠️  LLM recommendation failed. Showing price-sorted models instead.

Detected modality: TEXT (based on keywords)

Cheapest text models:
  1. openrouter::deepseek/deepseek-v3.2  — $0.26 / $0.38 per 1M tokens
  2. openrouter::google/gemini-2.0-flash — $0.10 / $0.40 per 1M tokens
  3. openrouter::meta-llama/llama-3.1-8b — $0.00 / $0.00 per 1M tokens

Note: These are not task-specific recommendations.
To use a different recommender model:
  whichmodel "<task>" --model openai/gpt-4o-mini
```

---

## Error Message Guidelines

### Tone

- **Helpful:** Always suggest how to fix the problem
- **Specific:** Include actual values where relevant
- **Concise:** Get to the point quickly
- **Professional:** No jokes or sarcasm

### Structure

1. **Error line:** What happened (one line)
2. **Explanation:** Why it happened (if not obvious)
3. **Suggestions:** How to fix it (bullet list)
4. **Links:** Where to get more help (URLs)

### Example Good Message

```
Error: Invalid modality 'foo'.

Valid modalities:
  text, image, video, audio_tts, audio_stt, audio_generation, vision, embedding

Example: whichmodel "generate images" --modality image
```

### Example Bad Message

```
Error: Invalid modality.
```

---

## Retry Strategy

### Catalog Fetch

| Attempt | Delay | Action |
|---------|-------|--------|
| 1 | Immediate | Try request |
| 2 | 1 second | Retry |
| 3 | 2 seconds | Retry |
| 4 | Fail | Use cache or exit code 4 |

### LLM Call

| Attempt | Delay | Action |
|---------|-------|--------|
| 1 | Immediate | Try request |
| 2 | 1 second | Retry with correction context |
| 3 | 2 seconds | Retry |
| 4 | Fail | Use fallback mode |

---

## Logging

### What to Log

- All errors with context
- Retry attempts
- Fallback triggers
- API response times

### Log Format

```
[ERROR] code=E020 source=openrouter latency=12s timeout=10s
[RETRY] attempt=2 delay=1s error="Timeout"
[FALLBACK] reason="llm_failed" attempts=3
```

### Verbose Mode Output

```bash
whichmodel "summarize docs" --verbose

[10:30:01.234] Fetching catalog from openrouter...
[10:30:02.345] Catalog fetched: 312 models in 1.111s
[10:30:02.346] Compressing catalog for LLM...
[10:30:02.350] Catalog compressed: 25,430 tokens
[10:30:02.351] Calling recommender LLM (deepseek/deepseek-v3.2)...
[10:30:05.512] LLM responded in 3.161s
[10:30:05.513] Token usage: 25,430 prompt + 412 completion = 25,842 total
[10:30:05.514] Cost: $0.00681 + $0.00016 = $0.00697
[10:30:05.515] Total time: 4.281s
```

---

## Error Code Reference

| Code | Constant | Category |
|------|----------|----------|
| 0 | SUCCESS | - |
| 1 | GENERAL_ERROR | Unknown |
| 2 | INVALID_ARGUMENTS | Input |
| 3 | NO_API_KEY | Config |
| 4 | NO_MODELS_FOUND | Data |
| 5 | LLM_FAILED | LLM |
| 6 | NETWORK_ERROR | Network |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-02-23 | Initial error handling specification |
