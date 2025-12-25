/**
 * Application-wide constants and configuration values.
 * Extracted from inline "magic numbers" for maintainability.
 */

/**
 * Maximum input sizes to prevent abuse and excessive API costs
 */
export const INPUT_LIMITS = {
	/** Maximum code length in characters (100KB) */
	MAX_CODE_LENGTH: 100_000,
	/** Maximum context length in characters */
	MAX_CONTEXT_LENGTH: 5_000,
	/** Maximum language name length */
	MAX_LANGUAGE_LENGTH: 50,
	/** Maximum plan length in characters */
	MAX_PLAN_LENGTH: 50_000,
	/** Maximum number of models to run in parallel */
	MAX_MODELS: 10,
} as const;

/**
 * OpenRouter API configuration
 */
export const LLM_CONFIG = {
	/** Default temperature for model responses (can override with TEMPERATURE env var) */
	DEFAULT_TEMPERATURE: Number(process.env.TEMPERATURE) || 0.3,
	/** Default max tokens for responses (can override with MAX_TOKENS env var) */
	DEFAULT_MAX_TOKENS: Number(process.env.MAX_TOKENS) || 16384,
} as const;

/**
 * Default models if not configured via environment variables
 */
export const DEFAULT_MODELS: string[] = [
	"minimax/minimax-m2.1",
	"x-ai/grok-code-fast-1",
];
