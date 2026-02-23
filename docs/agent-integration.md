# AI Agent Integration

> **Version:** 1.0
> **Last Updated:** 2025-08-11
> **Status:** Phase 1

---

## Overview

`whichmodel` can be used by AI coding agents like **Claude Code** and **OpenAI Codex** to get model recommendations programmatically. This document describes how to integrate `whichmodel` into agent workflows.

---

## Supported Agents

| Agent | Integration Method | Status |
|-------|-------------------|--------|
| Claude Code | CLI + MCP | Phase 1 |
| OpenAI Codex | CLI | Phase 1 |
| Cursor | CLI | Phase 1 |
| Windsurf | CLI | Phase 2 |
| Aider | CLI | Phase 2 |
| Cline | CLI + MCP | Phase 2 |

---

## CLI Integration

### Basic Usage

Agents can invoke `whichmodel` via the CLI:

```bash
whichmodel "summarize legal contracts and flag risks" --json
```

### JSON Output for Agents

The `--json` flag outputs machine-readable JSON:

```json
{
  "taskAnalysis": {
    "summary": "Legal document summarization with risk identification",
    "detectedModality": "text",
    "keyRequirements": ["long context", "reasoning", "accuracy"],
    "costFactors": "Input-heavy, documents can be 50-100 pages"
  },
  "recommendations": {
    "cheapest": {
      "id": "openrouter::deepseek/deepseek-v3.2",
      "reason": "Strong reasoning at lowest price...",
      "pricingSummary": "$0.25 / $0.38 per 1M tokens",
      "estimatedCost": "~$8/mo for 200 contracts"
    },
    "balanced": {
      "id": "openrouter::google/gemini-2.5-flash",
      "reason": "Million-token context...",
      "pricingSummary": "$0.30 / $2.50 per 1M tokens",
      "estimatedCost": "~$18/mo for 200 contracts"
    },
    "best": {
      "id": "openrouter::anthropic/claude-sonnet-4",
      "reason": "Best-in-class document comprehension...",
      "pricingSummary": "$3.00 / $15.00 per 1M tokens",
      "estimatedCost": "~$420/mo for 200 contracts"
    }
  },
  "meta": {
    "recommenderModel": "deepseek/deepseek-v3.2",
    "recommendationCostUsd": 0.00697,
    "timestamp": "2025-08-11T10:30:00Z",
    "version": "0.1.0"
  }
}
```

### Parsing Recommendations

Agents should extract:

```javascript
const result = JSON.parse(output);

// Get recommended model IDs
const cheapest = result.recommendations.cheapest.id;    // "openrouter::deepseek/deepseek-v3.2"
const balanced = result.recommendations.balanced.id;     // "openrouter::google/gemini-2.5-flash"
const best = result.recommendations.best.id;             // "openrouter::anthropic/claude-sonnet-4"

// Get reasoning
const reason = result.recommendations.balanced.reason;

// Get cost estimate
const cost = result.recommendations.balanced.estimatedCost;
```

---

## Claude Code Integration

### CLI Usage

Claude Code can invoke `whichmodel` directly:

```bash
# Claude Code asks: "What model should I use for summarizing legal contracts?"
whichmodel "summarize legal contracts and flag risks" --json
```

### MCP Server (Phase 2)

For deeper integration, `whichmodel` provides an MCP (Model Context Protocol) server:

```json
{
  "mcpServers": {
    "whichmodel": {
      "command": "whichmodel-mcp",
      "args": []
    }
  }
}
```

#### MCP Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `recommend_model` | Get model recommendations | `task`, `constraints?` |
| `list_models` | List available models | `modality?`, `sort?`, `limit?` |
| `compare_models` | Compare two models | `modelA`, `modelB`, `task` |

#### Example MCP Call

```json
{
  "tool": "recommend_model",
  "arguments": {
    "task": "summarize legal contracts and flag risks",
    "constraints": {
      "maxPrice": 1.0,
      "minContext": 50000
    }
  }
}
```

#### MCP Response

```json
{
  "content": [
    {
      "type": "text",
      "text": "For summarizing legal contracts with risk flagging:\n\n💰 **Cheapest**: deepseek/deepseek-v3.2\n   $0.25/1M prompt, $0.38/1M completion\n   164K context, strong reasoning\n\n⚖️ **Balanced**: google/gemini-2.5-flash\n   $0.30/1M prompt, $2.50/1M completion\n   1M context, excellent analysis\n\n🏆 **Best**: anthropic/claude-sonnet-4\n   $3.00/1M prompt, $15.00/1M completion\n   Best document comprehension"
    }
  ]
}
```

### Claude Code Configuration

Add to Claude Code settings:

```json
{
  "mcpServers": {
    "whichmodel": {
      "command": "npx",
      "args": ["-y", "whichmodel-mcp"]
    }
  }
}
```

---

## OpenAI Codex Integration

### CLI Usage

Codex can invoke `whichmodel` for recommendations:

```bash
whichmodel "generate product descriptions for ecommerce" --json
```

### Programmatic Usage

Codex should:

1. **Call `whichmodel`** with the task description
2. **Parse JSON output**
3. **Select appropriate model** based on requirements
4. **Use selected model** for the actual task

### Example Codex Workflow

```python
import subprocess
import json

def get_model_recommendation(task: str, budget: str = "balanced") -> str:
    """Get model recommendation from whichmodel."""
    result = subprocess.run(
        ["whichmodel", task, "--json"],
        capture_output=True,
        text=True
    )

    if result.returncode != 0:
        # Fallback to default
        return "openrouter::deepseek/deepseek-v3.2"

    data = json.loads(result.stdout)

    # Select based on budget preference
    if budget == "cheapest":
        return data["recommendations"]["cheapest"]["id"]
    elif budget == "best":
        return data["recommendations"]["best"]["id"]
    else:
        return data["recommendations"]["balanced"]["id"]

# Usage
model_id = get_model_recommendation(
    "summarize legal contracts and flag risks",
    budget="balanced"
)
# Returns: "openrouter::google/gemini-2.5-flash"
```

---

## Common Integration Patterns

### Pattern 1: Direct Recommendation

**Use Case:** Agent needs to know which model to use for a task.

```bash
# Agent runs:
whichmodel "transcribe audio files from meetings" --json

# Agent extracts:
# recommendations.balanced.id = "openrouter::openai/whisper-1"
# Agent then uses whisper-1 for transcription
```

### Pattern 2: Batch Recommendations

**Use Case:** Agent needs recommendations for multiple tasks.

```bash
# Agent runs multiple queries:
whichmodel "generate marketing copy" --json
whichmodel "analyze customer feedback sentiment" --json
whichmodel "create social media images" --json

# Agent gets different models for each task
```

### Pattern 3: Cost-Conscious Selection

**Use Case:** Agent has a budget constraint.

```bash
# Agent specifies max price:
whichmodel "write blog posts" --max-price 0.50 --json

# Agent gets only models within budget
```

### Pattern 4: Modality Override

**Use Case:** Agent knows the modality and wants to skip detection.

```bash
# Agent forces image modality:
whichmodel "create product photos" --modality image --json
```

---

## Agent Decision Matrix

| Task Type | Recommended Budget | Why |
|-----------|-------------------|-----|
| Quick prototyping | `cheapest` | Speed over quality |
| Production code | `balanced` | Good quality/cost ratio |
| Critical analysis | `best` | Accuracy is paramount |
| High volume | `cheapest` | Cost adds up at scale |
| One-time complex task | `best` | Worth the premium |

---

## Environment Setup for Agents

### Required Environment Variables

```bash
# All agents need:
export OPENROUTER_API_KEY="sk-or-..."

# Optional for more models:
export FAL_API_KEY="fal_..."
export REPLICATE_API_TOKEN="r8_..."
```

### Installation

```bash
# Install globally:
npm install -g whichmodel

# Or use with npx (no install):
npx whichmodel "task description" --json
```

---

## Error Handling for Agents

### No API Key

```json
{
  "error": {
    "code": 3,
    "message": "OPENROUTER_API_KEY is not set",
    "recoveryHint": "Set the OPENROUTER_API_KEY environment variable"
  }
}
```

**Agent Action:** Prompt user to set API key, or use fallback model.

### No Models Found

```json
{
  "error": {
    "code": 4,
    "message": "No models found from any source",
    "recoveryHint": "Check API keys and network connection"
  }
}
```

**Agent Action:** Use hardcoded fallback model list.

### Network Error

```json
{
  "error": {
    "code": 6,
    "message": "Network timeout",
    "recoveryHint": "Check internet connection"
  }
}
```

**Agent Action:** Retry with exponential backoff, then use fallback.

---

## Fallback Model List

If `whichmodel` is unavailable, agents should use this hardcoded fallback:

```json
{
  "text": {
    "cheapest": "openrouter::deepseek/deepseek-v3.2",
    "balanced": "openrouter::google/gemini-2.5-flash",
    "best": "openrouter::anthropic/claude-sonnet-4"
  },
  "image": {
    "cheapest": "fal::stabilityai/stable-diffusion-xl",
    "balanced": "fal::black-forest-labs/flux-1.1-pro",
    "best": "fal::ideogram/ideogram-v3"
  },
  "audio_stt": {
    "cheapest": "openrouter::openai/whisper-1",
    "balanced": "openrouter::openai/whisper-1",
    "best": "openrouter::openai/whisper-1"
  },
  "audio_tts": {
    "cheapest": "openrouter::openai/tts-1",
    "balanced": "elevenlabs::eleven_multilingual_v2",
    "best": "elevenlabs::eleven_turbo_v2_5"
  }
}
```

---

## Performance Considerations

### Latency

| Operation | Typical Latency |
|-----------|----------------|
| Catalog fetch (cached) | <100ms |
| Catalog fetch (fresh) | 1-2s |
| LLM recommendation | 2-5s |
| Total (fresh) | 3-7s |
| Total (cached) | 2-5s |

### Caching

Agents should cache recommendations for identical tasks:

```python
import hashlib

def get_cached_recommendation(task: str) -> dict | None:
    cache_key = hashlib.md5(task.encode()).hexdigest()
    # Check cache...
```

### Batch Optimization

For multiple tasks, use a single `whichmodel` call with batch mode (Phase 2):

```bash
whichmodel --batch <<EOF
summarize legal contracts
generate marketing copy
transcribe audio files
EOF
```

---

## Version Compatibility

| whichmodel Version | Claude Code | Codex | MCP Support |
|-------------------|-------------|-------|-------------|
| 0.1.x | CLI only | CLI only | No |
| 0.2.x | CLI + MCP | CLI | Yes |
| 1.0.x | Full | Full | Yes |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-08-11 | Initial agent integration documentation |
