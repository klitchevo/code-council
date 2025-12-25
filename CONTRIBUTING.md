# Contributing to Code Council

Thank you for your interest in contributing! This document provides guidelines for contributing to this project.

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/klitchevo/code-council.git
   cd code-council
   ```
3. **Install dependencies**:
   ```bash
   npm install
   ```
4. **Set up your environment**:
   ```bash
   cp .env.example .env
   # Add your OPENROUTER_API_KEY to .env
   ```

## Development Workflow

### Building

```bash
npm run build
```

### Development Mode

```bash
npm run dev  # Watch mode - rebuilds on changes
```

### Testing Locally

```bash
npm start
```

Or configure in your MCP client to test with Claude Desktop/Cline.

## Code Quality

We use **Biome** for linting and formatting, and **Lefthook** for Git hooks.

### Linting & Formatting

```bash
npm run check        # Check code quality
npm run check:fix    # Auto-fix issues
npm run lint         # Lint only
npm run format       # Format only
```

### Type Checking

```bash
npm run typecheck
```

### Git Hooks

Lefthook automatically runs on commit:
- **pre-commit**: Biome check + typecheck on staged files
- **commit-msg**: Validates commit message length
- **pre-push**: Runs full build

## Pull Request Process

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**:
   - Write clear, concise commit messages
   - Follow existing code style (enforced by Biome)
   - Add JSDoc comments for public APIs
   - Update tests if applicable

3. **Test your changes**:
   ```bash
   npm run build
   npm run check
   npm run typecheck
   ```

4. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Open a Pull Request**:
   - Describe what changes you made and why
   - Reference any related issues
   - Ensure CI checks pass

## Code Style Guidelines

### TypeScript

- Use TypeScript's strict mode
- Avoid `any` types - use proper typing
- Export types for public APIs
- Add JSDoc comments for exported functions

### Naming Conventions

- Files: `kebab-case.ts`
- Classes: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE`
- Types/Interfaces: `PascalCase`

### Project Structure

```
src/
├── index.ts              # Main entry point
├── config.ts             # Model configuration
├── constants.ts          # App-wide constants
├── errors.ts             # Custom error classes
├── logger.ts             # Structured logging
├── schemas.ts            # Zod validation schemas
├── openrouter.ts         # OpenRouter API client
├── prompts/              # Review prompt templates
│   ├── code-review.ts
│   ├── frontend-review.ts
│   ├── backend-review.ts
│   └── plan-review.ts
├── tools/                # MCP tool handlers
│   ├── factory.ts
│   ├── review-code.ts
│   ├── review-frontend.ts
│   ├── review-backend.ts
│   ├── review-plan.ts
│   └── list-config.ts
└── utils/                # Shared utilities
    └── parallel-executor.ts
```

## Adding New Review Types

To add a new review type:

1. **Create prompt template** in `src/prompts/your-review.ts`:
   ```typescript
   export const SYSTEM_PROMPT = `Your system prompt...`;
   export function buildUserMessage(code: string, options?: {...}): string {
     // Build user message
   }
   ```

2. **Add review method** to `OpenRouterClient` in `src/openrouter.ts`:
   ```typescript
   async reviewYourType(code: string, models: string[], options?: {...}): Promise<ModelReviewResult[]> {
     const userMessage = yourReviewPrompts.buildUserMessage(code, options);
     return executeInParallel(models, (model) =>
       this.chat(model, yourReviewPrompts.SYSTEM_PROMPT, userMessage)
     );
   }
   ```

3. **Create tool handler** in `src/tools/review-your-type.ts`:
   ```typescript
   export const yourTypeReviewSchema = {
     code: z.string().describe("Code to review"),
     // ... other fields
   };

   export async function handleYourTypeReview(
     client: OpenRouterClient,
     input: Record<string, unknown>,
   ) {
     // Extract and call client.reviewYourType()
   }
   ```

4. **Register tool** in `src/index.ts`:
   ```typescript
   createReviewTool(server, {
     name: "review_your_type",
     description: "...",
     inputSchema: yourTypeReviewSchema,
     handler: (input) => handleYourTypeReview(client, input),
   });
   ```

5. **Add environment variable** support in `src/config.ts`:
   ```typescript
   export const YOUR_TYPE_REVIEW_MODELS: string[] = parseModels(
     process.env.YOUR_TYPE_REVIEW_MODELS,
     DEFAULT_MODELS,
   );
   ```

6. **Update documentation**:
   - Add to README.md
   - Add to CHANGELOG.md

## Architecture Principles

### No Duplication
We use the **tool factory pattern** and **parallel executor utility** to eliminate code duplication. Never copy-paste tool registration or parallel execution code.

### Separation of Concerns
- **Prompts** live in `src/prompts/`
- **Tools** live in `src/tools/`
- **Utilities** live in `src/utils/`
- **Business logic** stays in `src/openrouter.ts`

### User-First Validation
- Validate **structure** (types, enums), not arbitrary limits
- Users are paying for API usage - let them use it however they want
- No max code length or restrictive validations

## Reporting Bugs

- Use GitHub Issues: https://github.com/klitchevo/code-council/issues
- Include:
  - Clear description of the bug
  - Steps to reproduce
  - Expected vs actual behavior
  - Environment (Node version, OS, etc.)
  - Relevant logs (with API keys redacted!)

## Feature Requests

- Use GitHub Issues with "enhancement" label
- Describe:
  - The problem you're trying to solve
  - Your proposed solution
  - Alternative solutions considered
  - Additional context

## Questions?

- Open a GitHub Discussion
- Check existing issues first
- Review README.md and documentation

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Code of Conduct

Be respectful, inclusive, and constructive. We're all here to build something useful together.
