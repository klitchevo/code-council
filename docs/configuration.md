# Configuration Guide

Code Council supports two configuration methods:
1. **Config file** (recommended) - TypeScript/JavaScript config file with full type support
2. **Environment variables** - Quick setup via MCP client config

## MCP Client Setup

### Claude Desktop

Add to your `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**Linux:** `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "code-council": {
      "command": "npx",
      "args": ["-y", "@klitchevo/code-council"],
      "env": {
        "OPENROUTER_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "code-council": {
      "command": "npx",
      "args": ["-y", "@klitchevo/code-council"],
      "env": {
        "OPENROUTER_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Other MCP Clients

For any MCP client that supports environment variables:

```json
{
  "command": "npx",
  "args": ["-y", "@klitchevo/code-council"],
  "env": {
    "OPENROUTER_API_KEY": "your-openrouter-api-key"
  }
}
```

### Global Installation (Alternative)

If you prefer to install globally:

```bash
npm install -g @klitchevo/code-council
```

Then configure without npx:

```json
{
  "mcpServers": {
    "code-council": {
      "command": "@klitchevo/code-council",
      "env": {
        "OPENROUTER_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Config File (Recommended)

Create a config file in your project for full type support and autocompletion.

### Option 1: `.code-council/config.ts` (recommended)

```typescript
import { defineConfig } from "@klitchevo/code-council/config";

export default defineConfig({
  models: {
    codeReview: ["anthropic/claude-sonnet-4", "openai/gpt-4o"],
    frontendReview: ["anthropic/claude-sonnet-4"],
    backendReview: ["openai/gpt-4o", "google/gemini-2.0-flash-exp"],
  },
  llm: {
    temperature: 0.3,
    maxTokens: 16384,
  },
});
```

### Option 2: `code-council.config.ts` (project root)

```typescript
import { defineConfig } from "@klitchevo/code-council/config";

export default defineConfig({
  // Same options as above
});
```

### Generate via CLI

```bash
npx @klitchevo/code-council init
```

**CLI Options:**

```bash
npx @klitchevo/code-council init [options]

Options:
  --ts, --typescript   Generate TypeScript config (default)
  --js, --javascript   Generate JavaScript config
  --root               Create config in project root (code-council.config.ts)
  --dir, --directory   Create config in .code-council/ directory (default)
  --no-comments        Generate config without explanatory comments
  --force, -f          Overwrite existing config file

Examples:
  npx @klitchevo/code-council init              # Creates .code-council/config.ts
  npx @klitchevo/code-council init --js --root  # Creates code-council.config.js
  npx @klitchevo/code-council init --force      # Overwrite existing config
```

Or use the MCP tool: `Use init_config to generate a configuration file`

### Complete Config Options

```typescript
import { defineConfig } from "@klitchevo/code-council/config";

export default defineConfig({
  // Models for each review type
  models: {
    defaultModels: ["model1", "model2"],    // Fallback for all types
    codeReview: ["model1", "model2"],       // General code reviews
    frontendReview: ["model1"],             // Frontend reviews
    backendReview: ["model1", "model2"],    // Backend reviews
    planReview: ["model1"],                 // Plan reviews
    discussion: ["model1", "model2"],       // Council discussions
    tpsAudit: ["model1", "model2"],         // TPS audits
  },

  // Consensus analysis settings (all reviews use consensus by default)
  consensus: {
    modelWeights: {                         // Weight models differently
      "anthropic/claude-sonnet-4": 1.2,     // Higher = more influence
      "openai/gpt-4o": 1.0,
    },
    highConfidenceThreshold: 0.8,           // Threshold for high confidence
    moderateConfidenceThreshold: 0.5,       // Threshold for moderate confidence
  },

  // LLM behavior
  llm: {
    temperature: 0.3,                       // 0.0-2.0, lower = more focused
    maxTokens: 16384,                       // Max response length
  },

  // Session settings for council discussions
  session: {
    maxSessions: 100,                       // Max concurrent sessions
    maxMessagesPerModel: 20,                // Messages before context windowing
    ttlMs: 1800000,                         // Session timeout (30 min default)
    rateLimitPerMinute: 10,                 // Rate limit per session
  },

  // Input limits
  inputLimits: {
    maxCodeLength: 100000,                  // Max code input length
    maxContextLength: 50000,                // Max context length
    maxModels: 10,                          // Max models per review
  },
});
```

## Environment Variables

For quick setup without a config file, use environment variables in your MCP client configuration.

### Available Variables

| Variable | Description |
|----------|-------------|
| `OPENROUTER_API_KEY` | **Required.** Your OpenRouter API key |
| `CODE_REVIEW_MODELS` | Models for general code reviews |
| `FRONTEND_REVIEW_MODELS` | Models for frontend reviews |
| `BACKEND_REVIEW_MODELS` | Models for backend reviews |
| `PLAN_REVIEW_MODELS` | Models for plan reviews |
| `DISCUSSION_MODELS` | Models for council discussions |
| `TPS_AUDIT_MODELS` | Models for TPS codebase audits |
| `TEMPERATURE` | Response randomness (0.0-2.0, default: 0.3) |
| `MAX_TOKENS` | Maximum response tokens (default: 16384) |

### Format

Model arrays use JSON array format:

```json
{
  "env": {
    "OPENROUTER_API_KEY": "your-api-key",
    "CODE_REVIEW_MODELS": ["anthropic/claude-sonnet-4.5", "openai/gpt-4o"],
    "TEMPERATURE": "0.5",
    "MAX_TOKENS": "32000"
  }
}
```

### Full Example

```json
{
  "mcpServers": {
    "code-council": {
      "command": "npx",
      "args": ["-y", "@klitchevo/code-council"],
      "env": {
        "OPENROUTER_API_KEY": "your-api-key",
        "CODE_REVIEW_MODELS": ["anthropic/claude-sonnet-4.5", "openai/gpt-4o", "google/gemini-2.0-flash-exp"],
        "FRONTEND_REVIEW_MODELS": ["anthropic/claude-sonnet-4.5"],
        "BACKEND_REVIEW_MODELS": ["openai/gpt-4o", "anthropic/claude-sonnet-4.5"],
        "TEMPERATURE": "0.5",
        "MAX_TOKENS": "32000"
      }
    }
  }
}
```

## Configuration Priority

Config file settings take priority over environment variables:

1. Config file value (if set)
2. Environment variable (if set)
3. Default value

## Security Best Practices

**Never commit your OpenRouter API key to git.**

### Safe Locations

MCP client configurations are stored **outside your project directory**:

- **Claude Desktop**: User config directories (see paths above)
- **Cursor**: Global settings (not in project)
- **Other MCP Clients**: Typically in user config directories

### Do

- Put API keys in MCP client config files (they're outside git)
- Use system environment variables
- Keep configs in user directories (`~/.config/`, `~/Library/`, etc.)

### Don't

- Create `.mcp.json` or config files **inside your project directory**
- Commit any file containing your API key to git
- Share config files containing API keys
- Hardcode API keys in code

### Extra Security: Shell Environment

Store the key in your shell environment:

```bash
# Add to ~/.zshrc or ~/.bashrc
export OPENROUTER_API_KEY="sk-or-v1-..."
```

Then reference it in your MCP config:

```json
{
  "env": {
    "OPENROUTER_API_KEY": "${OPENROUTER_API_KEY}"
  }
}
```

## Local Development

1. Clone the repository:
```bash
git clone https://github.com/klitchevo/code-council.git
cd code-council
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```bash
cp .env.example .env
# Edit .env and add your OPENROUTER_API_KEY
```

4. Build:
```bash
npm run build
```

5. Run:
```bash
npm start
# or use the convenience script:
./run.sh
```

6. For development with auto-rebuild:
```bash
npm run dev
```
