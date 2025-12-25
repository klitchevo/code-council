# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2025-12-25

### Added
- Initial release of OpenRouter Review MCP server
- Multi-model code review using OpenRouter API
- Support for 4 review types:
  - General code review (`review_code`)
  - Frontend-specific review (`review_frontend`)
  - Backend-specific review (`review_backend`)
  - Implementation plan review (`review_plan`)
- Parallel execution across multiple AI models
- Configurable models via environment variables:
  - `CODE_REVIEW_MODELS`
  - `FRONTEND_REVIEW_MODELS`
  - `BACKEND_REVIEW_MODELS`
  - `PLAN_REVIEW_MODELS`
- Default models: minimax/minimax-m2.1, x-ai/grok-code-fast-1
- MCP (Model Context Protocol) integration for Claude Desktop, Cline, etc.
- Comprehensive README with security best practices
- MIT License

### Security
- Secure API key handling via environment variables
- Clear documentation on avoiding key leaks
- Input validation using Zod schemas

### Developer Experience
- TypeScript with strict mode enabled
- ES modules support
- Source maps for debugging
- Type declarations included
- npx support for easy installation

[1.0.0]: https://github.com/YOUR_USERNAME/openrouter-review-mcp/releases/tag/v1.0.0
