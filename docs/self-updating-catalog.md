# Self-Updating Model Catalog

This document describes how to generate an accurate, always up-to-date model catalog by fetching live data from OpenRouter's API.

## Quick Start

```bash
# Generate catalog from live OpenRouter API
npm run catalog:fetch

# Or manually:
curl -s "https://openrouter.ai/api/v1/models" | npx tsx scripts/fetch-catalog.ts
```

## How It Works

1. **Fetch**: Queries `https://openrouter.ai/api/v1/models` for all available models
2. **Parse**: Extracts pricing, context length, capabilities, and modalities
3. **Validate**: Cross-references with provider documentation
4. **Generate**: Outputs JSON catalog compatible with WhichModel

## Generated Catalog Structure

```json
{
  "lastUpdated": "2025-08-11T10:30:00Z",
  "source": "openrouter_live",
  "models": [
    {
      "id": "deepseek/deepseek-v3.2",
      "name": "DeepSeek: DeepSeek V3.2",
      "pricing": {
        "input": 0.25,
        "output": 0.38
      },
      "contextWindow": 163840,
      "capabilities": ["text", "reasoning"]
    }
  ]
}
```

## Automation Options

### Option 1: CI/CD Pipeline (Recommended)

Add to `.github/workflows/update-catalog.yml`:

```yaml
name: Update Model Catalog
on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday
  workflow_dispatch:  # Manual trigger

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run catalog:fetch
      - name: Create PR if changed
        run: |
          git config --local user.email "action@github.com"
          git config --local user.name "GitHub Action"
          git add src/catalog/openrouter.json
          git diff --quiet && exit 0
          git commit -m "chore: update model catalog [skip ci]"
          git push
```

### Option 2: Pre-build Hook

Add to `package.json`:

```json
{
  "scripts": {
    "prebuild": "npm run catalog:fetch",
    "catalog:fetch": "tsx scripts/fetch-catalog.ts"
  }
}
```

### Option 3: Runtime Fetch (No Build)

```typescript
// src/lib/runtime-catalog.ts
export async function fetchLiveCatalog() {
  const res = await fetch('https://openrouter.ai/api/v1/models');
  const data = await res.json();
  return parseOpenRouterModels(data.data);
}
```

## Data Verification

After fetching, verify critical fields:

| Field | Verification Method |
|-------|-------------------|
| Model ID | Must match OpenRouter slug exactly |
| Pricing | Compare with provider's official pricing page |
| Context Window | Check model documentation |
| Capabilities | Verify with test API call |

## Handling Edge Cases

### New Models Not Yet in Catalog

```typescript
// Flag models not in known list for review
const KNOWN_PROVIDERS = ['openai', 'anthropic', 'google', 'deepseek', 'meta-llama'];
const newModels = models.filter(m =>
  !KNOWN_PROVIDERS.some(p => m.id.startsWith(p))
);
if (newModels.length > 0) {
  console.warn('New providers detected:', newModels);
}
```

### Pricing Discrepancies

```typescript
// Alert if pricing differs significantly from expected
const EXPECTED_RANGES = {
  'openai/gpt-4': { min: 0.02, max: 0.04 },
  'anthropic/claude-3-opus': { min: 0.01, max: 0.02 }
};
```

### Deprecated Models

```typescript
// Mark models with expiration dates
const deprecated = models.filter(m => m.expiration_date);
```

## Sources

- OpenRouter API: `https://openrouter.ai/api/v1/models`
- OpenRouter Docs: `https://openrouter.ai/docs`
- Provider-specific APIs (when needed for verification)

## Last Catalog Update

| Source | Models | Last Updated |
|--------|--------|--------------|
| OpenRouter Live | 500+ | Auto-fetched |

---

**Note**: This replaces static, manually-maintained model data with always-current information from the live API.
