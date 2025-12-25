# Code Council Examples

This directory contains realistic examples of using Code Council's review tools with sample outputs from multiple AI models.

## Examples

### [Code Review Example](./code-review-example.md)
Learn how to use the `review_code` tool for general code quality, bug detection, and best practices review.

**What you'll learn:**
- How to request a code review in Claude
- What kind of feedback to expect from different models
- Common issues AI models catch (type safety, validation, magic numbers)

### [Frontend Review Example](./frontend-review-example.md)
See how `review_frontend` works with different review types (accessibility, performance, UX).

**What you'll learn:**
- How to request accessibility-focused reviews
- How to request performance-focused reviews
- WCAG compliance checking
- React-specific optimization suggestions

### [Backend Review Example](./backend-review-example.md)
Understand backend security and architecture reviews using `review_backend`.

**What you'll learn:**
- Security vulnerability detection (SQL injection, auth issues)
- OWASP Top 10 identification
- Architecture pattern recommendations
- Layered architecture suggestions

### [Plan Review Example](./plan-review-example.md)
Discover how `review_plan` catches issues BEFORE you write code.

**What you'll learn:**
- How plan reviews identify missing features
- Security issues caught at planning stage
- Realistic timeline estimation
- When to build vs. buy (third-party services)

## How to Use These Examples

1. Read through the examples to understand what kind of feedback each tool provides
2. Try the tools with your own code in Claude Desktop or any MCP-compatible client
3. Use the specialized review types (accessibility, security, etc.) when you need focused feedback
4. Review plans before implementing to catch issues early

## Review Types Summary

| Tool | Default | Available Review Types |
|------|---------|----------------------|
| `review_code` | Full review | N/A (always comprehensive) |
| `review_frontend` | Full | `accessibility`, `performance`, `ux`, `full` |
| `review_backend` | Full | `security`, `performance`, `architecture`, `full` |
| `review_plan` | Full | `feasibility`, `completeness`, `risks`, `timeline`, `full` |

## Tips for Getting Better Reviews

1. **Provide context**: Use the `context` parameter to give models additional information
2. **Specify language/framework**: Help models give more relevant suggestions
3. **Use focused reviews**: When you know what you're looking for, use specific review types
4. **Review early**: Use `review_plan` before coding to catch issues at design stage
5. **Compare perspectives**: Different models may catch different issues

## Model Configuration

These examples use the default models, but you can customize which models review your code by setting environment variables in your MCP client configuration:

```json
{
  "mcpServers": {
    "code-council": {
      "command": "npx",
      "args": ["-y", "@klitchevo/code-council"],
      "env": {
        "OPENROUTER_API_KEY": "your-api-key",
        "CODE_REVIEW_MODELS": ["anthropic/claude-3.5-sonnet", "openai/gpt-4-turbo"],
        "FRONTEND_REVIEW_MODELS": ["anthropic/claude-3.5-sonnet"],
        "BACKEND_REVIEW_MODELS": ["openai/gpt-4-turbo"]
      }
    }
  }
}
```

## Questions?

- Check the main [README](../README.md) for setup instructions
- See [CONTRIBUTING](../CONTRIBUTING.md) for development guidelines
- Open an [issue](https://github.com/klitchevo/code-council/issues) if you find problems
