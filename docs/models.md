# Model Selection Guide

Code Council runs your code through multiple AI models simultaneously. This guide helps you choose the right models for your needs.

## Default Models

Out of the box, Code Council uses these cost-effective models:

| Model | Strengths | Provider |
|-------|-----------|----------|
| `minimax/minimax-m2.1` | Fast, cost-effective reasoning | Minimax |
| `z-ai/glm-4.7` | Strong multilingual capabilities | Z-AI |
| `moonshotai/kimi-k2.5` | Advanced reasoning with thinking | Moonshot AI |
| `deepseek/deepseek-v3.2` | State-of-the-art open model | DeepSeek |

These defaults are chosen for:
- **Low cost** - Typically $0.01-0.05 per review
- **Good quality** - Competitive with premium models on most tasks
- **Fast response** - Lower latency than frontier models
- **Diverse perspectives** - Different architectures catch different issues

## Premium Model Options

For higher quality reviews, swap in frontier models:

| Model | Best For | Cost |
|-------|----------|------|
| `anthropic/claude-sonnet-4.5` | Security, nuanced logic, best overall | Higher |
| `anthropic/claude-opus-4.5` | Complex architectural decisions | Highest |
| `openai/gpt-4o` | Architectural patterns, documentation | Higher |
| `google/gemini-2.0-flash-exp` | Fast, good balance of cost/quality | Medium |
| `meta-llama/llama-3.3-70b-instruct` | Open source, self-hostable | Medium |

## Recommended Configurations

### Budget-Conscious (Default)

```typescript
models: {
  codeReview: [
    "minimax/minimax-m2.1",
    "z-ai/glm-4.7",
    "moonshotai/kimi-k2.5",
    "deepseek/deepseek-v3.2",
  ],
}
```

**Cost:** ~$0.01-0.05 per review

### Balanced Quality

```typescript
models: {
  codeReview: [
    "anthropic/claude-sonnet-4",
    "openai/gpt-4o",
    "google/gemini-2.0-flash-exp",
  ],
}
```

**Cost:** ~$0.10-0.30 per review

### Maximum Quality

```typescript
models: {
  codeReview: [
    "anthropic/claude-opus-4.5",
    "anthropic/claude-sonnet-4.5",
    "openai/gpt-4o",
    "google/gemini-2.0-flash-exp",
  ],
}
```

**Cost:** ~$0.50-1.00 per review

### Security-Focused

```typescript
models: {
  backendReview: [
    "anthropic/claude-sonnet-4.5",  // Excellent at security
    "openai/gpt-4o",
    "deepseek/deepseek-v3.2",
  ],
}
```

### Frontend-Focused

```typescript
models: {
  frontendReview: [
    "anthropic/claude-sonnet-4.5",  // Great at accessibility
    "google/gemini-2.0-flash-exp",  // Fast for iterative work
  ],
}
```

## Cost Optimization Tips

### 1. Use Specific Review Types

Instead of `full` reviews, use targeted types:

```
Use review_backend with review_type=security
```

This reduces token usage by focusing the models.

### 2. Reduce Max Tokens

Lower `MAX_TOKENS` for shorter responses:

```json
{
  "env": {
    "MAX_TOKENS": "8000"
  }
}
```

### 3. Use Fewer Models for Routine Reviews

For quick checks, 2 models provide good coverage:

```typescript
models: {
  codeReview: [
    "anthropic/claude-sonnet-4",
    "deepseek/deepseek-v3.2",
  ],
}
```

### 4. Reserve Premium Models for Important Reviews

Use cheap defaults for daily work, premium for PRs:

```typescript
models: {
  codeReview: ["deepseek/deepseek-v3.2", "minimax/minimax-m2.1"],
  // Override manually for important reviews
}
```

## Model Comparison

| Model | Speed | Quality | Cost | Security | Architecture |
|-------|-------|---------|------|----------|--------------|
| Claude Sonnet 4.5 | Medium | Excellent | High | Excellent | Excellent |
| Claude Opus 4.5 | Slow | Best | Highest | Excellent | Excellent |
| GPT-4o | Medium | Excellent | High | Very Good | Excellent |
| Gemini 2.0 Flash | Fast | Very Good | Medium | Good | Very Good |
| DeepSeek V3.2 | Fast | Very Good | Low | Good | Good |
| Kimi K2.5 | Medium | Good | Low | Good | Good |
| Minimax M2.1 | Fast | Good | Lowest | Moderate | Good |
| GLM 4.7 | Fast | Good | Low | Moderate | Moderate |

## Why Multiple Models Matter

Different models have different blind spots:

- **Claude** excels at nuanced security implications and edge cases
- **GPT-4** catches architectural anti-patterns and design issues
- **Gemini** spots performance problems and optimization opportunities
- **DeepSeek** finds edge cases in complex logic

When they **agree**, you can be confident it's a real issue.
When they **disagree**, you know where to focus your attention.

## Finding More Models

Browse all available models at [OpenRouter Models](https://openrouter.ai/models).

Filter by:
- **Capability** - Code, reasoning, chat
- **Context length** - For reviewing large files
- **Price** - Input/output token costs
- **Speed** - Latency requirements

## Getting an API Key

1. Sign up at [OpenRouter](https://openrouter.ai)
2. Go to [Keys](https://openrouter.ai/keys) in your dashboard
3. Create a new API key
4. Add credits at [Credits](https://openrouter.ai/credits)
