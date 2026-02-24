# Error Handling Specification

> **Version:** 1.1
> **Last Updated:** 2026-02-24
> **Status:** Stable (v1.0.0)

## Exit Codes

- `0` `SUCCESS`
- `1` `GENERAL_ERROR`
- `2` `INVALID_ARGUMENTS`
- `3` `NO_API_KEY`
- `4` `NO_MODELS_FOUND`
- `5` `LLM_FAILED`
- `6` `NETWORK_ERROR`

## Primary Error Cases

### Configuration / auth

- Missing `OPENROUTER_API_KEY` for recommendation/compare/update-recommender (`3`)
- Missing source key when source requires it (`3`)

### Input validation

- Missing task
- Invalid modality
- Invalid number format (`--max-price`, `--min-context`, `--limit`)
- Invalid resolution format
- Invalid/unsupported source value

All input errors use exit code `2` with a recovery hint.

### Catalog failures

- Source fetch timeouts
- Source HTTP failures
- All sources failing
- Empty merged catalog after filtering

These return `4` or `6` depending on where failure occurs.

### Recommender failures

- Invalid OpenRouter key/credits while calling chat completions
- LLM timeout or malformed completion

These return `5`; recommendation flow may fall back to deterministic recommendations when possible.

## Error Output Contract

Errors are written to stderr as:

```text
Error: <message>
<recovery hint, if any>
```

## Security Rules

- Never print API keys in errors or logs.
- Return concise actionable hints (env var name or next command).
- Avoid stack traces in normal CLI output.

## Recovery Hints Policy

Recovery hints should contain one concrete action, for example:
- `Set OPENROUTER_API_KEY and retry.`
- `Use --sources openrouter,fal,replicate`
- `Relax --max-price/--min-context filters or remove exclusions.`
