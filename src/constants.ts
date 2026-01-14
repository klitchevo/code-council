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
	"z-ai/glm-4.7",
	"moonshotai/kimi-k2-thinking",
	"deepseek/deepseek-v3.2",
];

/**
 * Session management configuration for multi-turn discussions
 */
export const SESSION_LIMITS = {
	/** Maximum number of concurrent sessions */
	MAX_SESSIONS: 100,
	/** Maximum messages per model in a session (context windowing) */
	MAX_MESSAGES_PER_MODEL: 50,
	/** Maximum message length in bytes (10KB) */
	MAX_MESSAGE_LENGTH: 10 * 1024,
	/** Session TTL in milliseconds (30 minutes) */
	TTL_MS: 30 * 60 * 1000,
	/** Cleanup interval in milliseconds (5 minutes) */
	CLEANUP_INTERVAL_MS: 5 * 60 * 1000,
	/** Rate limit: max requests per session per minute */
	RATE_LIMIT_PER_MINUTE: 10,
	/** Per-model timeout in milliseconds (30 seconds) */
	MODEL_TIMEOUT_MS: 30 * 1000,
} as const;
