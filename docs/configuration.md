# Configuration Specification

> **Version:** 1.0
> **Last Updated:** 2025-02-23
> **Status:** Production (Phase 1)

---

## Overview

`whichmodel` supports multiple configuration sources with a clear priority order. This document defines how configuration is loaded and merged.

---

## Configuration Sources (Priority Order)

| Priority | Source | Location |
|----------|--------|----------|
| 1 (highest) | CLI flags | Command-line arguments |
| 2 | Environment variables | Shell environment |
| 3 | Config file | `~/.config/whichmodel/config.json` |
| 4 (lowest) | Defaults | Hardcoded in code |

---

## Environment Variables

### Required

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `OPENROUTER_API_KEY` | string | - | OpenRouter API key (required for all operations) |

### Optional (Catalog Sources)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `FAL_API_KEY` | string | - | fal.ai API key (enables image/video models) |
| `REPLICATE_API_TOKEN` | string | - | Replicate API token (broad model coverage) |
| `ELEVENLABS_API_KEY` | string | - | ElevenLabs API key (audio models) |
| `TOGETHER_API_KEY` | string | - | Together AI API key |

### Optional (Behavior)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `WHICHMODEL_MODEL` | string | `deepseek/deepseek-v3.2` | Default recommender model |
| `WHICHMODEL_CACHE_TTL` | number | `3600` | Cache TTL in seconds |
| `WHICHMODEL_CONFIG` | string | - | Custom config file path |
| `NO_COLOR` | any | - | Disable colored output (standard) |

---

## Config File

### Location

| OS | Location |
|----|----------|
| macOS/Linux | `~/.config/whichmodel/config.json` |
| Windows | `%APPDATA%\whichmodel\config.json` |
| Custom | Set via `WHICHMODEL_CONFIG` env var |

### Schema

```typescript
interface ConfigFile {
  /** OpenRouter API key (alternative to env var) */
  apiKey?: string;

  /** Default recommender model */
  recommenderModel?: string;

  /** Additional API keys */
  falApiKey?: string;
  replicateApiToken?: string;
  elevenLabsApiKey?: string;
  togetherApiKey?: string;

  /** Default catalog sources */
  defaultSources?: string[];

  /** Models to always exclude */
  excludeModels?: string[];

  /** Default output format */
  outputFormat?: "terminal" | "json";

  /** Enable colored output */
  colorOutput?: boolean;

  /** Cache settings */
  cache?: {
    enabled?: boolean;
    ttlSeconds?: number;
    directory?: string;
  };
}
```

### Example

```json
{
  "apiKey": "sk-or-v1-...",
  "recommenderModel": "deepseek/deepseek-v3.2",
  "defaultSources": ["openrouter"],
  "excludeModels": [
    "openrouter::meta-llama/llama-2-7b-chat"
  ],
  "outputFormat": "terminal",
  "colorOutput": true,
  "cache": {
    "enabled": true,
    "ttlSeconds": 3600,
    "directory": "~/.cache/whichmodel"
  }
}
```

---

## Configuration Loading

### Algorithm

```typescript
function loadConfig(): Config {
  // Start with defaults
  let config: Config = {
    apiKey: "",
    recommenderModel: "deepseek/deepseek-v3.2",
    cacheTtl: 3600,
  };

  // 1. Load config file (if exists)
  const configFile = loadConfigFile();
  if (configFile) {
    config = { ...config, ...configFile };
  }

  // 2. Override with environment variables
  if (process.env.OPENROUTER_API_KEY) {
    config.apiKey = process.env.OPENROUTER_API_KEY;
  }
  if (process.env.WHICHMODEL_MODEL) {
    config.recommenderModel = process.env.WHICHMODEL_MODEL;
  }
  if (process.env.WHICHMODEL_CACHE_TTL) {
    config.cacheTtl = parseInt(process.env.WHICHMODEL_CACHE_TTL, 10);
  }
  if (process.env.FAL_API_KEY) {
    config.falApiKey = process.env.FAL_API_KEY;
  }
  if (process.env.REPLICATE_API_TOKEN) {
    config.replicateApiToken = process.env.REPLICATE_API_TOKEN;
  }

  // 3. CLI flags override everything (handled in CLI layer)

  return config;
}
```

### Config File Loading

```typescript
function loadConfigFile(): Partial<ConfigFile> | null {
  const configPath = process.env.WHICHMODEL_CONFIG
    || getDefaultConfigPath();

  try {
    const content = fs.readFileSync(configPath, "utf-8");
    return JSON.parse(content);
  } catch {
    // Config file doesn't exist or is invalid
    return null;
  }
}

function getDefaultConfigPath(): string {
  const home = process.env.HOME || process.env.USERPROFILE;
  const platform = process.platform;

  if (platform === "win32") {
    return path.join(process.env.APPDATA || "", "whichmodel", "config.json");
  }

  return path.join(home || "", ".config", "whichmodel", "config.json");
}
```

---

## CLI Flag Overrides

These CLI flags override config file and environment variables:

| Flag | Config Field |
|------|--------------|
| `--model` | `recommenderModel` |
| `--sources` | `defaultSources` |
| `--json` | `outputFormat = "json"` |
| `--no-color` | `colorOutput = false` |
| `--exclude` | Appends to `excludeModels` |

---

## Validation

### Required Fields

```typescript
function validateConfig(config: Config): string | null {
  if (!config.apiKey) {
    return [
      "Error: OPENROUTER_API_KEY is not set.",
      "",
      "Get your API key at: https://openrouter.ai/keys",
      "Then run:",
      "  export OPENROUTER_API_KEY=sk-or-...",
      "",
      "Or add it to your config file:",
      "  ~/.config/whichmodel/config.json",
    ].join("\n");
  }

  // Validate API key format
  if (!config.apiKey.startsWith("sk-or-")) {
    return "Warning: API key doesn't look like an OpenRouter key (should start with sk-or-)";
  }

  return null; // No error
}
```

---

## Cache Directory

### Location

| OS | Location |
|----|----------|
| macOS/Linux | `~/.cache/whichmodel/` |
| Windows | `%LOCALAPPDATA%\whichmodel\cache\` |

### Files

```
~/.cache/whichmodel/
├── openrouter-catalog.json    # OpenRouter catalog cache
├── fal-catalog.json           # fal.ai catalog cache
├── replicate-catalog.json     # Replicate catalog cache
└── metadata.json              # Cache metadata (timestamps, TTLs)
```

### Cache Structure

```typescript
interface CacheMetadata {
  [key: string]: {
    timestamp: number;  // Unix epoch seconds
    ttl: number;        // Seconds
    source: string;
  };
}
```

---

## First-Run Setup

When no config exists:

```
$ whichmodel "summarize documents"

Welcome to whichmodel! Let's set you up.

whichmodel needs an OpenRouter API key to work.

1. Visit https://openrouter.ai/keys
2. Create an account or sign in
3. Generate a new API key

Paste your API key: _

[After entering]

✓ API key validated!

Would you like to:
  1. Save to ~/.config/whichmodel/config.json
  2. Save to ~/.zshrc (as environment variable)
  3. Don't save (set manually each time)

[1-3]: _
```

---

## Security Considerations

### API Key Storage

| Method | Security | Convenience |
|--------|----------|-------------|
| Environment variable | Medium | High |
| Config file | Low-Medium | High |
| Interactive prompt | High | Low |
| Keyring (future) | High | High |

### Config File Permissions

On Unix systems, config file should be readable only by owner:

```bash
chmod 600 ~/.config/whichmodel/config.json
```

The tool should warn if permissions are too open:

```
Warning: Config file has insecure permissions (644).
Run: chmod 600 ~/.config/whichmodel/config.json
```

---

## Debugging Configuration

### `--verbose` Output

```
📋 Configuration:
   API Key: sk-or-...abc123 (from env)
   Recommender: deepseek/deepseek-v3.2 (from config)
   Sources: openrouter (from default)
   Cache: enabled (3600s TTL)
   Config file: ~/.config/whichmodel/config.json
```

### Config Dump Command (Future)

```bash
whichmodel config --show
```

```
Configuration sources (later overrides earlier):
  1. Defaults
  2. Config file: ~/.config/whichmodel/config.json
  3. Environment variables
  4. CLI flags

Current values:
  apiKey: sk-or-...abc123 (from env)
  recommenderModel: deepseek/deepseek-v3.2 (from config)
  defaultSources: ["openrouter"] (from default)
  cache.enabled: true (from default)
  cache.ttlSeconds: 3600 (from env)
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-02-23 | Initial configuration specification |
