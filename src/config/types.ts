/**
 * TypeScript configuration interfaces for Code Council
 *
 * These types provide full autocompletion support when using defineConfig()
 */

/**
 * Known OpenRouter model IDs for autocomplete.
 * This is not exhaustive - any valid OpenRouter model ID string will work.
 *
 * Find all models at: https://openrouter.ai/models
 */
export type KnownModel =
	// Anthropic
	| "anthropic/claude-opus-4"
	| "anthropic/claude-opus-4.5"
	| "anthropic/claude-sonnet-4"
	| "anthropic/claude-sonnet-4.5"
	| "anthropic/claude-haiku-4"
	| "anthropic/claude-haiku-4.5"
	| "anthropic/claude-3.5-sonnet"
	| "anthropic/claude-3.5-haiku"
	| "anthropic/claude-3-opus"
	| "anthropic/claude-3-sonnet"
	| "anthropic/claude-3-haiku"
	// OpenAI
	| "openai/gpt-4o"
	| "openai/gpt-4o-mini"
	| "openai/gpt-4-turbo"
	| "openai/gpt-4"
	| "openai/gpt-3.5-turbo"
	| "openai/o1"
	| "openai/o1-mini"
	| "openai/o1-preview"
	| "openai/o3"
	| "openai/o3-mini"
	| "openai/gpt-5"
	| "openai/gpt-5.1"
	| "openai/gpt-5.2"
	// Google
	| "google/gemini-2.5-pro"
	| "google/gemini-2.5-flash"
	| "google/gemini-2.0-pro"
	| "google/gemini-2.0-flash"
	| "google/gemini-2.0-flash-001"
	| "google/gemini-pro"
	| "google/gemini-pro-vision"
	| "google/gemini-3-pro-preview"
	| "google/gemini-3-flash-preview"
	// Meta
	| "meta-llama/llama-3.3-70b-instruct"
	| "meta-llama/llama-3.2-90b-vision-instruct"
	| "meta-llama/llama-3.2-11b-vision-instruct"
	| "meta-llama/llama-3.1-405b-instruct"
	| "meta-llama/llama-3.1-70b-instruct"
	| "meta-llama/llama-3.1-8b-instruct"
	| "meta-llama/llama-4-maverick"
	| "meta-llama/llama-4-scout"
	// Mistral
	| "mistralai/mistral-large"
	| "mistralai/mistral-large-2512"
	| "mistralai/mistral-medium"
	| "mistralai/mistral-small"
	| "mistralai/mistral-small-creative"
	| "mistralai/mixtral-8x7b-instruct"
	| "mistralai/mixtral-8x22b-instruct"
	| "mistralai/codestral"
	| "mistralai/devstral-2512"
	// DeepSeek
	| "deepseek/deepseek-chat"
	| "deepseek/deepseek-coder"
	| "deepseek/deepseek-r1"
	| "deepseek/deepseek-v3"
	| "deepseek/deepseek-v3.1"
	| "deepseek/deepseek-v3.2"
	// Qwen
	| "qwen/qwen-2.5-72b-instruct"
	| "qwen/qwen-2.5-coder-32b-instruct"
	| "qwen/qwen-2-72b-instruct"
	| "qwen/qwq-32b"
	| "qwen/qwen3-vl-32b-instruct"
	// xAI
	| "x-ai/grok-2"
	| "x-ai/grok-2-vision"
	| "x-ai/grok-3"
	| "x-ai/grok-4"
	| "x-ai/grok-4.1-fast"
	// Amazon
	| "amazon/nova-pro-v1"
	| "amazon/nova-lite-v1"
	| "amazon/nova-micro-v1"
	| "amazon/nova-premier-v1"
	| "amazon/nova-2-lite-v1"
	// Cohere
	| "cohere/command-r-plus"
	| "cohere/command-r"
	| "cohere/command"
	// Other popular models
	| "minimax/minimax-m2"
	| "minimax/minimax-m2.1"
	| "z-ai/glm-4.7"
	| "moonshotai/kimi-k2-thinking"
	| "perplexity/sonar-pro"
	| "perplexity/sonar-pro-search"
	| "nvidia/nemotron-3-nano-30b-a3b";

/**
 * Model identifier - accepts known models for autocomplete, but any string is valid
 */
export type ModelId = KnownModel | (string & {});

/**
 * Models configuration - arrays of OpenRouter model IDs
 *
 * Use `defaultModels` to set models for all review types at once,
 * or specify individual arrays to override for specific types.
 *
 * Find models at: https://openrouter.ai/models
 *
 * @example
 * ```typescript
 * // Use same models for everything
 * models: {
 *   defaultModels: ["anthropic/claude-sonnet-4", "openai/gpt-4o"],
 * }
 *
 * // Or customize per review type
 * models: {
 *   defaultModels: ["anthropic/claude-sonnet-4"],
 *   frontendReview: ["anthropic/claude-sonnet-4", "openai/gpt-4o"],
 * }
 * ```
 */
export interface ModelsConfig {
	/**
	 * Default models used for all review types.
	 * Individual review type arrays override this for that specific type.
	 */
	defaultModels?: ModelId[];
	/** Models for general code review (overrides defaultModels) */
	codeReview?: ModelId[];
	/** Models for frontend-specific review (overrides defaultModels) */
	frontendReview?: ModelId[];
	/** Models for backend-specific review (overrides defaultModels) */
	backendReview?: ModelId[];
	/** Models for implementation plan review (overrides defaultModels) */
	planReview?: ModelId[];
	/** Models for council discussions (overrides defaultModels) */
	discussion?: ModelId[];
	/** Models for TPS audits (overrides defaultModels) */
	tpsAudit?: ModelId[];
}

/**
 * Consensus analysis configuration
 */
export interface ConsensusConfig {
	/**
	 * @deprecated This option is ignored. All review tools now use host extraction
	 * by default, which provides consensus-formatted output without additional API calls.
	 * This setting is kept for backwards compatibility but will be removed in a future version.
	 */
	enabled?: boolean;
	/** Custom model weights for scoring (default: equal weights) */
	modelWeights?: Record<string, number>;
	/** High confidence threshold (default: 0.8) */
	highConfidenceThreshold?: number;
	/** Moderate confidence threshold (default: 0.5) */
	moderateConfidenceThreshold?: number;
	/**
	 * Model used for finding extraction when hostExtraction is false.
	 * @deprecated Host extraction is now the default. This is only used if you explicitly
	 * disable host extraction, which is not recommended.
	 */
	extractionModel?: ModelId;
	/** Fall back to raw reviews if consensus fails (default: true) */
	fallbackOnError?: boolean;
	/**
	 * Let the MCP host model do extraction instead of making API calls.
	 * When true (default), returns raw reviews formatted for the host
	 * model to analyze. This is the recommended approach since the host
	 * model (e.g., Claude) can do the extraction work itself without
	 * additional API calls.
	 *
	 * This is now always true by default for all review tools.
	 */
	hostExtraction?: boolean;
}

/**
 * LLM behavior configuration
 */
export interface LLMConfig {
	/** Temperature for responses (default: 0.3) */
	temperature?: number;
	/** Maximum tokens for responses (default: 16384) */
	maxTokens?: number;
}

/**
 * Session limits for multi-turn discussions
 */
export interface SessionConfig {
	/** Maximum concurrent sessions (default: 100) */
	maxSessions?: number;
	/** Maximum messages per model (default: 50) */
	maxMessagesPerModel?: number;
	/** Session TTL in milliseconds (default: 30 min) */
	ttlMs?: number;
	/** Rate limit per minute (default: 10) */
	rateLimitPerMinute?: number;
}

/**
 * Input limits for safety
 */
export interface InputLimitsConfig {
	/** Maximum code length in characters (default: 100KB) */
	maxCodeLength?: number;
	/** Maximum context length (default: 5KB) */
	maxContextLength?: number;
	/** Maximum number of parallel models (default: 10) */
	maxModels?: number;
}

/**
 * Complete code-council configuration
 *
 * @example
 * ```typescript
 * import { defineConfig } from "@klitchevo/code-council/config";
 *
 * // Simple: use same models for all review types
 * export default defineConfig({
 *   models: {
 *     defaultModels: ["anthropic/claude-sonnet-4", "openai/gpt-4o"],
 *   },
 * });
 *
 * // Advanced: customize models per review type
 * export default defineConfig({
 *   models: {
 *     defaultModels: ["anthropic/claude-sonnet-4"],
 *     frontendReview: ["anthropic/claude-sonnet-4", "openai/gpt-4o"],
 *     backendReview: ["deepseek/deepseek-v3.2", "openai/gpt-4o"],
 *   },
 *   consensus: {
 *     enabled: true,
 *     highConfidenceThreshold: 0.8,
 *   },
 * });
 * ```
 */
export interface CodeCouncilConfig {
	/** Model configurations for different review types */
	models?: ModelsConfig;
	/** Consensus analysis settings */
	consensus?: ConsensusConfig;
	/** LLM behavior settings */
	llm?: LLMConfig;
	/** Session management settings */
	session?: SessionConfig;
	/** Input limit settings */
	inputLimits?: InputLimitsConfig;
}
