# AGENTS.md

> Universal instructions for AI coding agents (Codex, Cursor, Windsurf, Cline, Aider, etc.) working in this repository.

## Project Summary

`whichmodel` is a CLI tool that recommends AI models based on natural language task descriptions.

**What it does:**
1. Takes a task description (e.g., "summarize legal contracts")
2. Fetches live model catalogs from providers
3. Uses an LLM to analyze the task and recommend 3 models: cheapest, balanced, best
4. Outputs recommendations with reasoning and cost estimates

**Supported modalities:** Text, Image, Video, Audio (TTS/STT), Vision, Embedding, Multimodal

## Quick Start

```bash
# Install dependencies (when package.json exists)
npm install

# Run in development
npm run dev -- "generate product photos" --json

# Run tests
npm test

# Build
npm run build
```

## Tech Stack

| Category | Technology |
|----------|------------|
| Language | TypeScript (strict) |
| Runtime | Node.js 20+ |
| CLI | Commander |
| Output | Chalk, Ora |
| Testing | Vitest |
| Build | tsup |

## Repository Structure

```
whichmodel/
├── CLAUDE.md           # Claude Code specific instructions
├── AGENTS.md           # This file
├── docs/               # Specifications (READ FIRST)
│   ├── PRD.md          # Product requirements
│   ├── roadmap.md      # Implementation phases
│   ├── cli-specification.md
│   ├── prompts.md      # LLM prompts (LOCKED)
│   ├── error-handling.md
│   └── ...
├── src/
│   ├── types.ts        # All type definitions
│   ├── cli.ts          # Entry point
│   ├── catalog/        # Fetching & normalization
│   ├── recommender/    # LLM recommendation
│   └── formatter/      # Output formatting
├── fixtures/           # Test data
└── dist/               # Built output
```

## Key Files for Different Tasks

| Task | Files to Reference |
|------|-------------------|
| Understanding the product | `docs/PRD.md` |
| Knowing what to implement next | `docs/roadmap.md` |
| Adding CLI commands/flags | `docs/cli-specification.md` |
| Understanding data types | `src/types.ts` |
| Modifying prompts | **DO NOT MODIFY** `docs/prompts.md` (locked) |
| Handling errors | `docs/error-handling.md` |
| Adding test fixtures | `fixtures/` |

## Implementation Phases

| Phase | Focus | Priority |
|-------|-------|----------|
| 0 | Foundation: types, catalog fetch, normalization | Current |
| 1 | MVP: text recommendations, CLI output | Next |
| 1.5 | Polish: security, documentation, npm publish | After MVP |
| 2 | Multi-modal: image, video, audio | Future |
| 3 | Advanced: caching, compare, MCP server | Future |

## Code Conventions

### File Naming
- Source files: `kebab-case.ts`
- Test files: `*.test.ts` (co-located with source)

### TypeScript
- Strict mode enabled
- Types in `src/types.ts`
- Interfaces for object shapes
- Discriminated unions for variant types

### Errors
Must include:
- Error code (see `docs/error-handling.md`)
- Message
- Recovery hint

Example:
```typescript
throw new CLIError({
  code: 3,
  message: "OPENROUTER_API_KEY is not set",
  recoveryHint: "Set the OPENROUTER_API_KEY environment variable"
});
```

## Testing Requirements

- Framework: Vitest
- Coverage: >80% for new modules
- Pattern: Tests co-located with source files

```bash
npm test                    # Run all tests
npm test -- --grep "catalog" # Run specific tests
npm run test:coverage       # With coverage report
```

## Environment Variables

```bash
# Required for recommendations
OPENROUTER_API_KEY=sk-or-...

# Optional (Phase 2+)
FAL_API_KEY=fal_...
REPLICATE_API_TOKEN=r8_...
```

## Data Sources (Catalogs)

| Provider | Priority | Status |
|----------|----------|--------|
| OpenRouter | P0 | Phase 0-1 |
| fal.ai | P1 | Phase 2 |
| Replicate | P1 | Phase 2 |
| Together AI | P2 | Phase 3 |

## Supported Modalities

The tool handles these AI modalities:

- **text**: LLMs for text generation
- **image**: Image generation models
- **video**: Video generation
- **audio_tts**: Text-to-speech
- **audio_stt**: Speech-to-text (transcription)
- **audio_generation**: Music/sound generation
- **vision**: Image understanding/analysis
- **embedding**: Text embeddings
- **multimodal**: Models handling multiple input/output types

## Default Recommender Model

The tool uses this model to generate recommendations:

- **ID:** `deepseek/deepseek-v3.2`
- **Cost:** $0.25/1M prompt, $0.38/1M completion
- **Provider:** OpenRouter

## Output Format

### Terminal (default)
```
For: summarize legal contracts and flag risks

💰 Cheapest: deepseek/deepseek-v3.2
   $0.25/1M prompt, $0.38/1M completion
   Strong reasoning at lowest price

⚖️ Balanced: google/gemini-2.5-flash
   $0.30/1M prompt, $2.50/1M completion
   Million-token context

🏆 Best: anthropic/claude-sonnet-4
   $3.00/1M prompt, $15.00/1M completion
   Best document comprehension
```

### JSON (with `--json` flag)
```json
{
  "taskAnalysis": { ... },
  "recommendations": {
    "cheapest": { "id": "...", "reason": "..." },
    "balanced": { "id": "...", "reason": "..." },
    "best": { "id": "...", "reason": "..." }
  },
  "meta": { ... }
}
```

## Important Constraints

1. **Prompts are locked** - Do not modify `docs/prompts.md` without explicit approval
2. **Test coverage required** - New modules must have >80% coverage
3. **Error codes** - Use codes from `docs/error-handling.md`
4. **Type safety** - No `any` types, use strict TypeScript

## Common Implementation Tasks

### Adding a CLI flag
1. Check `docs/cli-specification.md` for spec
2. Add to Commander setup in `src/cli.ts`
3. Update formatters if needed
4. Add tests

### Adding a catalog source
1. Read `docs/api-integration/<provider>.md`
2. Create `src/catalog/sources/<provider>.ts`
3. Add normalization rules
4. Add test fixtures to `fixtures/`

### Fixing a bug
1. Check `docs/error-handling.md` for error context
2. Write a failing test first
3. Fix the bug
4. Ensure coverage maintained
