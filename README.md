# Code Council

[![npm version](https://img.shields.io/npm/v/@klitchevo/code-council.svg)](https://www.npmjs.com/package/@klitchevo/code-council)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/klitchevo/code-council/workflows/CI/badge.svg)](https://github.com/klitchevo/code-council/actions)
[![codecov](https://codecov.io/gh/klitchevo/code-council/branch/main/graph/badge.svg)](https://codecov.io/gh/klitchevo/code-council)

**Your AI Code Review Council** - Get diverse perspectives from multiple AI models in parallel.

An MCP (Model Context Protocol) server that provides AI-powered code review using multiple models from [OpenRouter](https://openrouter.ai). Think of it as assembling a council of AI experts to review your code, each bringing their unique perspective.

## Features

- 🔍 **Multi-Model Code Review** - Get diverse perspectives by running reviews across multiple AI models simultaneously
- 🎨 **Frontend Review** - Specialized reviews for accessibility, performance, and UX
- 🔒 **Backend Review** - Security, architecture, and performance analysis
- 📋 **Plan Review** - Review implementation plans before writing code
- ⚡ **Parallel Execution** - All models run concurrently for fast results

## Quick Start

### Using with npx (Recommended)

The easiest way to use this MCP server is via npx. Configure your MCP client with environment variable for the API key:

#### Claude Desktop

Add to your `claude_desktop_config.json`:

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

**With custom models:**

```json
{
  "mcpServers": {
    "code-council": {
      "command": "npx",
      "args": ["-y", "@klitchevo/code-council"],
      "env": {
        "OPENROUTER_API_KEY": "your-api-key-here",
        "CODE_REVIEW_MODELS": ["anthropic/claude-sonnet-4.5", "openai/gpt-4o"],
        "FRONTEND_REVIEW_MODELS": ["anthropic/claude-sonnet-4.5"],
        "BACKEND_REVIEW_MODELS": ["openai/gpt-4o", "google/gemini-2.0-flash-exp"]
      }
    }
  }
}
```

#### Cursor

Add to your Cursor MCP settings (`.cursor/mcp.json` or similar):

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

#### Other MCP Clients

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

### Installation (Alternative)

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

## Getting an API Key

1. Sign up at [OpenRouter](https://openrouter.ai)
2. Go to [Keys](https://openrouter.ai/keys) in your dashboard
3. Create a new API key
4. Add credits to your account at [Credits](https://openrouter.ai/credits)

## Security Best Practices

⚠️ **CRITICAL SECURITY WARNING**: Never commit your OpenRouter API key to git!

### MCP Config File Locations (Safe - Not in Git)

MCP client configurations are stored **outside your project directory** and won't be committed:

- **Claude Desktop**:
  - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
  - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
  - Linux: `~/.config/Claude/claude_desktop_config.json`
- **Cursor**: Global settings (not in project)
- **Other MCP Clients**: Typically in user config directories

These files are **safe to put your API key in** because they're not in your git repository.

### ✅ SAFE:
- Putting the API key in MCP client config files (they're outside git)
- Using system environment variables and referencing them
- Keeping configs in user directories (`~/.config/`, `~/Library/`, etc.)

### ❌ NEVER DO:
- Don't create `.mcp.json` or config files **inside your project directory**
- Don't commit any file containing your API key to git
- Don't share config files containing API keys
- Don't hardcode API keys in code

### Using Environment Variables (Extra Security)

For added security, store the key in your shell environment:

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

## Available Tools

### `review_code`

Review code for quality, bugs, performance, and security issues.

**Parameters:**
- `code` (required): The code to review
- `language` (optional): Programming language
- `context` (optional): Additional context about the code

**Example usage in Claude:**
```
Use review_code to check this TypeScript function:
[paste your code]
```

### `review_frontend`

Review frontend code with focus on accessibility, performance, and UX.

**Parameters:**
- `code` (required): The frontend code to review
- `framework` (optional): Framework name (e.g., react, vue, svelte)
- `review_type` (optional): `accessibility`, `performance`, `ux`, or `full` (default)
- `context` (optional): Additional context

**Example usage in Claude:**
```
Use review_frontend with review_type=accessibility to check this React component:
[paste your component]
```

### `review_backend`

Review backend code for security, performance, and architecture.

**Parameters:**
- `code` (required): The backend code to review
- `language` (optional): Language/framework (e.g., node, python, go, rust)
- `review_type` (optional): `security`, `performance`, `architecture`, or `full` (default)
- `context` (optional): Additional context

**Example usage in Claude:**
```
Use review_backend with review_type=security to analyze this API endpoint:
[paste your code]
```

### `review_plan`

Review implementation plans BEFORE coding to catch issues early.

**Parameters:**
- `plan` (required): The implementation plan to review
- `review_type` (optional): `feasibility`, `completeness`, `risks`, `timeline`, or `full` (default)
- `context` (optional): Project constraints or context

**Example usage in Claude:**
```
Use review_plan to analyze this implementation plan:
[paste your plan]
```

### `list_review_config`

Show which AI models are currently configured for each review type.

## Configuration

### Customizing Models

You can customize which AI models are used for reviews by setting environment variables in your MCP client configuration. Each review type can use different models.

**Available Environment Variables:**

**Model Configuration:**
- `CODE_REVIEW_MODELS` - Models for general code reviews
- `FRONTEND_REVIEW_MODELS` - Models for frontend reviews
- `BACKEND_REVIEW_MODELS` - Models for backend reviews
- `PLAN_REVIEW_MODELS` - Models for plan reviews

**LLM Parameters:**
- `TEMPERATURE` - Response temperature (0.0-2.0, default: 0.3)
- `MAX_TOKENS` - Maximum response tokens (default: 16384)

**Format:** Array of strings (JSON array)

**Example:**
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
        "BACKEND_REVIEW_MODELS": ["openai/gpt-4o", "anthropic/claude-sonnet-4.5"]
      }
    }
  }
}
```

**Default Models:**
If you don't specify models, the server uses these defaults:
- `minimax/minimax-m2.1`
- `x-ai/grok-code-fast-1`

**Finding Models:**
Browse all available models at [OpenRouter Models](https://openrouter.ai/models). Popular choices include:
- `anthropic/claude-sonnet-4.5` - Latest Sonnet, excellent for code review
- `anthropic/claude-opus-4.5` - Frontier reasoning model for complex tasks
- `openai/gpt-4o` - Latest GPT-4 Omni model
- `google/gemini-2.0-flash-exp` - Fast and affordable
- `meta-llama/llama-3.3-70b-instruct` - Latest open source option

### Local Development

1. Clone the repository:
```bash
git clone <your-repo-url>
cd multi-agent
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

## How It Works

1. The MCP server exposes tools that Claude (or other MCP clients) can call
2. When you ask Claude to review code, it calls the appropriate tool
3. The server sends your code to multiple AI models via OpenRouter in parallel
4. Results from all models are aggregated and returned
5. Claude presents you with diverse perspectives from different AI models

## Cost Considerations

- Each review runs across multiple models simultaneously
- Costs vary by model - check [OpenRouter pricing](https://openrouter.ai/models)
- You can reduce costs by:
  - Using fewer models (edit `src/config.ts`)
  - Choosing cheaper models
  - Using specific `review_type` options instead of `full` reviews

## Troubleshooting

### "OPENROUTER_API_KEY environment variable is required"

Make sure you've added the API key to the `env` section of your MCP client configuration, not just in a separate `.env` file.

### Reviews are slow

- This is expected when using multiple models in parallel
- Consider using fewer models or faster models
- Check OpenRouter status at [status.openrouter.ai](https://status.openrouter.ai)

### Models returning errors

- Check that you have sufficient credits in your OpenRouter account
- Some models may have rate limits or temporary availability issues
- The server will show which models succeeded and which failed

## Requirements

- Node.js >= 18.0.0
- OpenRouter API key
- MCP-compatible client (Claude Desktop, Cursor, etc.)

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.

## Links

- [OpenRouter](https://openrouter.ai) - Multi-model AI API
- [Model Context Protocol](https://modelcontextprotocol.io) - MCP specification
- [Claude Desktop](https://claude.ai/download) - MCP-compatible AI assistant
