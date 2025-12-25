/**
 * Configuration for Code Council MCP Server
 *
 * Models are configured via environment variables as arrays of strings.
 *
 * Find models at: https://openrouter.ai/models
 *
 * Example MCP config:
 * {
 *   "env": {
 *     "OPENROUTER_API_KEY": "your-key",
 *     "CODE_REVIEW_MODELS": ["anthropic/claude-3.5-sonnet", "openai/gpt-4-turbo"]
 *   }
 * }
 *
 * Single model:
 * {
 *   "env": {
 *     "CODE_REVIEW_MODELS": ["anthropic/claude-3.5-sonnet"]
 *   }
 * }
 *
 * If not configured, defaults to minimax/minimax-m2.1 and x-ai/grok-code-fast-1
 */

import { DEFAULT_MODELS } from "./constants";

/**
 * Parse model list from environment variable
 * Accepts: array of strings only
 * Exported for testing
 */
export function parseModels(
	envVar: string | string[] | undefined,
	defaults: string[],
): string[] {
	// Not configured - use defaults
	if (envVar === undefined || envVar === null) {
		return defaults;
	}

	// Must be an array
	if (Array.isArray(envVar)) {
		const filtered = envVar.filter((m) => m && m.trim().length > 0);
		return filtered.length > 0 ? filtered : defaults;
	}

	// String provided - invalid format - throw error
	throw new Error(
		`Model configuration must be an array of strings, got: ${typeof envVar}. Example: ["anthropic/claude-3.5-sonnet", "openai/gpt-4-turbo"]`,
	);
}

/**
 * Models to use for code review (runs in parallel)
 */
export const CODE_REVIEW_MODELS: string[] = parseModels(
	process.env.CODE_REVIEW_MODELS as string | string[] | undefined,
	DEFAULT_MODELS,
);

/**
 * Models to use for frontend review (runs in parallel)
 */
export const FRONTEND_REVIEW_MODELS: string[] = parseModels(
	process.env.FRONTEND_REVIEW_MODELS as string | string[] | undefined,
	DEFAULT_MODELS,
);

/**
 * Models to use for backend review (runs in parallel)
 */
export const BACKEND_REVIEW_MODELS: string[] = parseModels(
	process.env.BACKEND_REVIEW_MODELS as string | string[] | undefined,
	DEFAULT_MODELS,
);

/**
 * Models to use for plan review (runs in parallel)
 * Reviews implementation plans before code is written
 */
export const PLAN_REVIEW_MODELS: string[] = parseModels(
	process.env.PLAN_REVIEW_MODELS as string | string[] | undefined,
	DEFAULT_MODELS,
);
