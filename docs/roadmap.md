# Implementation Roadmap

> **Version:** 1.0
> **Last Updated:** 2026-02-23
> **Status:** Phase 0 Complete, Phase 1 Complete, Phase 2 Complete

---

## Overview

This roadmap defines the implementation phases, milestones, and verification criteria for `whichmodel`. Each phase has clear deliverables and success criteria.

---

## Phase 0: Foundation (Week 1)

### Goals
- Set up project infrastructure
- Implement core types and catalog fetching
- Verify catalog normalization works correctly

### Milestones

| Milestone | Deliverable | Verification |
|-----------|-------------|--------------|
| M0.1 | Project scaffold (tsconfig, package.json, vitest) | `npm test` passes with placeholder test |
| M0.2 | TypeScript types (`src/types.ts`) | TypeScript compiles without errors |
| M0.3 | OpenRouter catalog fetcher | Live API returns 300+ models |
| M0.4 | Catalog normalization | All models have valid modality classification |
| M0.5 | Test fixtures | 10+ unit tests passing |

### Verification Commands

```bash
# M0.1 - Project compiles
npm run build
echo $?  # Should output 0

# M0.3 - Catalog fetch works
npm run catalog:fetch 2>&1 | grep "models fetched"

# M0.4 - Normalization test
npm test -- --grep "normalization"

# M0.5 - All tests pass
npm test
npm run test:coverage
# Coverage should be >80% for catalog module
```

### Exit Criteria
- [x] TypeScript compiles with no errors
- [x] All unit tests pass
- [x] Catalog fetch returns 300+ models from live API
- [x] All models have valid modality (no "unknown" classifications)
- [x] Code coverage >80% for `src/catalog/`

---

## Phase 1: MVP - Text Recommendations (Weeks 2-3)

### Goals
- Implement recommender LLM integration
- Generate text-only recommendations
- Terminal and JSON output

### Milestones

| Milestone | Deliverable | Verification |
|-----------|-------------|--------------|
| M1.1 | LLM prompt templates | Prompts match locked prompts in docs |
| M1.2 | OpenRouter LLM client | API call returns valid JSON |
| M1.3 | JSON response parser | Parser handles valid/invalid JSON |
| M1.4 | Recommendation validator | Catches invalid model IDs |
| M1.5 | Fallback mode | Price-sorted fallback works |
| M1.6 | Terminal formatter | Output matches examples in docs |
| M1.7 | JSON formatter | Output matches JSON schema |
| M1.8 | CLI entry point | `whichmodel "task"` works end-to-end |
| M1.9 | Error handling | All errors have recovery hints |
| M1.10 | Configuration | API key validation works |

### Verification Commands

```bash
# M1.2 - LLM call works
export OPENROUTER_API_KEY=sk-or-...
npm run dev -- "summarize documents" --json | jq '.recommendations.cheapest.id'

# M1.3 - Invalid JSON handling
# Manually test with mock returning invalid JSON

# M1.4 - Validation catches bad IDs
npm test -- --grep "validator"

# M1.5 - Fallback mode
# Temporarily use invalid API key, verify fallback triggers

# M1.8 - End-to-end test
npm run dev -- "write blog posts about AI"
# Should show cheapest/balanced/best recommendations

# M1.9 - Error messages
npm run dev  # Missing task
npm run dev -- ""  # Empty task
unset OPENROUTER_API_KEY && npm run dev -- "test"  # No API key

# M1.10 - Config validation
npm run dev -- "test" --verbose
# Should show API key status
```

### Exit Criteria
- [x] `whichmodel "summarize documents"` returns 3 recommendations
- [x] All recommendations have valid model IDs
- [x] JSON output matches schema
- [x] Terminal output matches examples
- [x] Fallback mode works when LLM fails
- [x] All error cases have helpful messages
- [x] Cost per recommendation <$0.01
- [x] All 20+ modality detection tests pass

### Current Phase 1 Milestone Status (2026-02-23)
- [x] M1.1 LLM prompt templates
- [x] M1.2 OpenRouter LLM client
- [x] M1.3 JSON response parser
- [x] M1.4 Recommendation validator
- [x] M1.5 Fallback mode
- [x] M1.6 Terminal formatter
- [x] M1.7 JSON formatter
- [x] M1.8 CLI entry point
- [x] M1.9 Error handling
- [x] M1.10 Configuration (basic env/config support implemented)

---

## Phase 1.5: Polish & Security (Week 4)

### Goals
- Add verbose mode
- Add cost tracking
- Security review

### Milestones

| Milestone | Deliverable | Verification |
|-----------|-------------|--------------|
| M1.11 | Verbose output | Shows tokens, cost, timing |
| M1.12 | Cost tracking | Cost displayed per recommendation |
| M1.13 | Input validation | Max length, no injection |
| M1.14 | Security audit | No secrets in logs |
| M1.15 | Documentation | README matches implementation |
| M1.16 | npm package | `npm install -g whichmodel` works |

### Verification Commands

```bash
# M1.11 - Verbose mode
npm run dev -- "summarize docs" --verbose
# Should show: prompt tokens, completion tokens, latency, cost

# M1.12 - Cost tracking
npm run dev -- "summarize docs" --json | jq '.meta.recommendationCostUsd'

# M1.13 - Input validation
npm run dev -- "$(python3 -c 'print("A" * 5000)')"
# Should show error about task too long

# M1.14 - No secrets in logs
npm run dev -- "test" --verbose 2>&1 | grep -i "sk-or"
# Should return nothing

# M1.16 - npm install
npm pack
npm install -g whichmodel-*.tgz
whichmodel "test"
npm uninstall -g whichmodel
```

### Exit Criteria
- [ ] Verbose mode shows all metadata
- [ ] Cost is accurate (±10%)
- [ ] Long inputs are rejected
- [ ] No API keys in any logs
- [ ] README is complete and accurate
- [ ] Can install globally via npm

---

## Phase 2: Multi-Modal Recommendations (Weeks 5-6)

### Goals
- Support image, video, audio modalities
- Add fal.ai catalog integration
- Add Replicate catalog integration (optional)

### Milestones

| Milestone | Deliverable | Verification |
|-----------|-------------|--------------|
| M2.1 | Modality detection tests | 30+ tests for edge cases |
| M2.2 | fal.ai catalog adapter | Fetches image/video models |
| M2.3 | Multi-source catalog merging | Duplicates handled correctly |
| M2.4 | Image recommendation | "generate images" works |
| M2.5 | Video recommendation | "create video ads" works |
| M2.6 | Audio recommendation | "transcribe podcasts" works |
| M2.7 | Replicate adapter (optional) | Additional models available |

### Verification Commands

```bash
# M2.1 - Modality detection
npm test -- --grep "modality"
# All 30+ tests pass

# M2.2 - fal.ai catalog
export FAL_API_KEY=...
npm run catalog:fetch -- --sources fal
# Should show fal models

# M2.4 - Image recommendation
npm run dev -- "generate product photos for ecommerce"
# Should recommend image models (flux, dalle, etc.)

# M2.5 - Video recommendation
npm run dev -- "create 15-second product demo videos"
# Should recommend video models (runway, kling, etc.)

# M2.6 - Audio recommendation
npm run dev -- "transcribe my podcast episodes"
# Should recommend whisper or similar

# Multi-source
npm run dev -- "test" --sources openrouter,fal
# Should show models from both sources
```

### Exit Criteria
- [x] All 30+ modality detection tests pass
- [x] Image tasks recommend image models
- [x] Video tasks recommend video models
- [x] Audio tasks recommend audio models
- [x] Multi-source catalog works
- [x] No regressions in text recommendations

### Current Phase 2 Milestone Status (2026-02-23)
- [x] M2.1 Modality detection tests (30+)
- [x] M2.2 fal.ai catalog adapter
- [x] M2.3 Multi-source catalog merging
- [x] M2.4 Image recommendation
- [x] M2.5 Video recommendation
- [x] M2.6 Audio recommendation
- [x] M2.7 Replicate adapter (optional)

---

## Phase 3: Advanced Features (Weeks 7-8)

### Goals
- Model comparison feature
- Cost estimation feature
- Caching layer
- Self-updating default model

### Milestones

| Milestone | Deliverable | Verification |
|-----------|-------------|--------------|
| M3.1 | File-based cache | Cache persists across runs |
| M3.2 | Cache invalidation | `--no-cache` works |
| M3.3 | Compare command | `whichmodel compare A B --task "..."` works |
| M3.4 | Cost estimation | `--estimate "1000 images/month"` works |
| M3.5 | Self-updating model | Tool can update its default recommender |
| M3.6 | Stats command | `whichmodel stats` shows catalog stats |
| M3.7 | List command | `whichmodel list` shows all models |

### Verification Commands

```bash
# M3.1 - Cache persists
npm run dev -- "summarize docs"
# Second run should be faster (cache hit)
npm run dev -- "summarize docs" --verbose
# Should show "cache hit"

# M3.2 - Cache bypass
npm run dev -- "summarize docs" --no-cache
# Should fetch fresh catalog

# M3.3 - Compare
npm run dev -- compare "openrouter::anthropic/claude-sonnet-4" "openrouter::openai/gpt-4o" --task "write code"
# Should show side-by-side comparison

# M3.4 - Cost estimation
npm run dev -- "generate images" --estimate "500 images/month at 1024x1024"
# Should show monthly cost estimate

# M3.5 - Self-updating
npm run dev -- --update-recommender
# Should query live models and pick best value recommender

# M3.6 - Stats
npm run dev -- stats
# Should show: model counts by modality, price ranges, sources

# M3.7 - List
npm run dev -- list --modality image --sort price
# Should show image models sorted by price
```

### Exit Criteria
- [ ] Cache reduces API calls by >90% for repeated queries
- [ ] Compare command works for any two models
- [ ] Cost estimation is accurate (±20%)
- [ ] Self-updating model works
- [ ] Stats and list commands work
- [ ] No regressions in core functionality

---

## Self-Updating Default Model Feature

### Concept

The tool should be able to recommend its own default recommender model by querying the live catalog and selecting the best value model for recommendation tasks.

### Implementation

```bash
# User runs self-update
whichmodel --update-recommender

# Tool:
# 1. Fetches live catalog
# 2. Filters to text models with reasoning capabilities
# 3. Evaluates price vs capability
# 4. Updates config with new default
# 5. Shows what changed
```

### Selection Criteria

```typescript
interface RecommenderCriteria {
  // Must support text input/output
  modality: "text";

  // Must have reasoning capabilities
  hasReasoning: boolean;

  // Cost targets
  maxPromptPricePer1m: 1.00;    // Max $1/1M prompt tokens
  maxCompletionPricePer1m: 2.00; // Max $2/1M completion tokens

  // Context needs
  minContextLength: 32000;

  // Must support JSON mode
  supportsJsonMode: boolean;
}
```

### Current Recommendation (Live Data)

Based on live OpenRouter API (Aug 2025):

| Tier | Model | Prompt | Completion | Context | Notes |
|------|-------|--------|------------|---------|-------|
| **Default** | `deepseek/deepseek-v3.2` | $0.25/1M | $0.38/1M | 164K | Best value, strong reasoning |
| Fallback | `google/gemini-2.5-flash` | $0.30/1M | $2.50/1M | 1M | Alternative if DeepSeek unavailable |
| Premium | `anthropic/claude-sonnet-4` | $3.00/1M | $15.00/1M | 1M | If user wants higher quality |

### Verification

```bash
# Update recommender
whichmodel --update-recommender

# Expected output:
# 🔍 Analyzing 312 text models for recommender suitability...
#
# ✅ New recommender: deepseek/deepseek-v3.2
#    Previous: deepseek/deepseek-v3.2 (no change)
#
#    Cost: $0.25/1M prompt, $0.38/1M completion
#    Context: 164K tokens
#    Reasoning: Yes
#
# 💰 Estimated cost per recommendation: ~$0.007

# Config file updated: ~/.config/whichmodel/config.json
```

---

## Success Metrics

### Phase 1 Success
- User can get recommendations for any text task
- 95%+ modality detection accuracy
- <$0.01 per recommendation
- <5 second total response time

### Phase 2 Success
- All 9 modalities supported
- Multi-source catalog works
- No accuracy regression

### Phase 3 Success
- Cache hit rate >90%
- Compare command useful for decisions
- Self-updating works

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| OpenRouter API changes | High | Pin API version, add integration tests |
| LLM returns bad JSON | Medium | Retry with correction, fallback mode |
| Modality detection fails | Medium | 30+ edge case tests, `--modality` override |
| Pricing data stale | Low | Cache with short TTL, live fetch option |
| API key leaked | High | Never log keys, env vars only |

---

## Release Checklist

### v0.1.0 (Phase 1)

- [ ] All Phase 1 milestones complete
- [ ] All tests passing
- [ ] Coverage >85%
- [ ] README complete
- [ ] npm package publishes successfully
- [ ] Install globally works
- [ ] Basic error handling works
- [ ] Cost per recommendation verified

### v0.2.0 (Phase 2)

- [ ] All Phase 2 milestones complete
- [ ] Multi-modal recommendations work
- [ ] No regressions in text recommendations
- [ ] Documentation updated

### v1.0.0 (Phase 3)

- [ ] All Phase 3 milestones complete
- [ ] Caching stable
- [ ] Compare command works
- [ ] Self-updating works
- [ ] Full documentation
- [ ] Stable API contract

---

## Timeline Summary

| Phase | Duration | Key Deliverable |
|-------|----------|-----------------|
| Phase 0 | 1 week | Catalog fetch works |
| Phase 1 | 2 weeks | Text recommendations work |
| Phase 1.5 | 1 week | Polished, secure, published |
| Phase 2 | 2 weeks | Multi-modal recommendations |
| Phase 3 | 2 weeks | Advanced features |
| **Total** | **8 weeks** | Full-featured tool |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-08-11 | Initial roadmap with self-updating feature |
