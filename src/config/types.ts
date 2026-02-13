/**
 * TypeScript configuration interfaces for Code Council
 *
 * These types provide full autocompletion support when using defineConfig()
 */

// --- GENERATED:KnownModel:START ---
/**
 * Known OpenRouter model IDs for autocomplete.
 * This is not exhaustive - any valid OpenRouter model ID string will work.
 *
 * Find all models at: https://openrouter.ai/models
 * Auto-generated on 2026-02-13T19:10:45.531Z - run `bun run update-models` to regenerate.
 */
export type KnownModel =
	// ai21
	| "ai21/jamba-large-1.7"
	// aion-labs
	| "aion-labs/aion-1.0"
	| "aion-labs/aion-1.0-mini"
	| "aion-labs/aion-rp-llama-3.1-8b"
	// alfredpros
	| "alfredpros/codellama-7b-instruct-solidity"
	// alibaba
	| "alibaba/tongyi-deepresearch-30b-a3b"
	// allenai
	| "allenai/olmo-2-0325-32b-instruct"
	| "allenai/olmo-3-32b-think"
	| "allenai/olmo-3-7b-instruct"
	| "allenai/olmo-3-7b-think"
	| "allenai/olmo-3.1-32b-instruct"
	| "allenai/olmo-3.1-32b-think"
	// alpindale
	| "alpindale/goliath-120b"
	// amazon
	| "amazon/nova-2-lite-v1"
	| "amazon/nova-lite-v1"
	| "amazon/nova-micro-v1"
	| "amazon/nova-premier-v1"
	| "amazon/nova-pro-v1"
	// anthracite-org
	| "anthracite-org/magnum-v4-72b"
	// anthropic
	| "anthropic/claude-3-haiku"
	| "anthropic/claude-3.5-haiku"
	| "anthropic/claude-3.5-sonnet"
	| "anthropic/claude-3.7-sonnet"
	| "anthropic/claude-3.7-sonnet:thinking"
	| "anthropic/claude-haiku-4.5"
	| "anthropic/claude-opus-4"
	| "anthropic/claude-opus-4.1"
	| "anthropic/claude-opus-4.5"
	| "anthropic/claude-opus-4.6"
	| "anthropic/claude-sonnet-4"
	| "anthropic/claude-sonnet-4.5"
	// arcee-ai
	| "arcee-ai/coder-large"
	| "arcee-ai/maestro-reasoning"
	| "arcee-ai/spotlight"
	| "arcee-ai/trinity-mini"
	| "arcee-ai/virtuoso-large"
	// baidu
	| "baidu/ernie-4.5-21b-a3b"
	| "baidu/ernie-4.5-21b-a3b-thinking"
	| "baidu/ernie-4.5-300b-a47b"
	| "baidu/ernie-4.5-vl-28b-a3b"
	| "baidu/ernie-4.5-vl-424b-a47b"
	// bytedance
	| "bytedance/ui-tars-1.5-7b"
	// bytedance-seed
	| "bytedance-seed/seed-1.6"
	| "bytedance-seed/seed-1.6-flash"
	// cohere
	| "cohere/command-a"
	| "cohere/command-r-08-2024"
	| "cohere/command-r-plus-08-2024"
	| "cohere/command-r7b-12-2024"
	// deepcogito
	| "deepcogito/cogito-v2.1-671b"
	// deepseek
	| "deepseek/deepseek-chat"
	| "deepseek/deepseek-chat-v3-0324"
	| "deepseek/deepseek-chat-v3.1"
	| "deepseek/deepseek-r1"
	| "deepseek/deepseek-r1-0528"
	| "deepseek/deepseek-r1-distill-llama-70b"
	| "deepseek/deepseek-r1-distill-qwen-32b"
	| "deepseek/deepseek-v3.1-terminus"
	| "deepseek/deepseek-v3.1-terminus:exacto"
	| "deepseek/deepseek-v3.2"
	| "deepseek/deepseek-v3.2-exp"
	| "deepseek/deepseek-v3.2-speciale"
	// eleutherai
	| "eleutherai/llemma_7b"
	// essentialai
	| "essentialai/rnj-1-instruct"
	// google
	| "google/gemini-2.0-flash-001"
	| "google/gemini-2.0-flash-lite-001"
	| "google/gemini-2.5-flash"
	| "google/gemini-2.5-flash-image"
	| "google/gemini-2.5-flash-lite"
	| "google/gemini-2.5-flash-lite-preview-09-2025"
	| "google/gemini-2.5-flash-preview-09-2025"
	| "google/gemini-2.5-pro"
	| "google/gemini-2.5-pro-preview"
	| "google/gemini-2.5-pro-preview-05-06"
	| "google/gemini-3-flash-preview"
	| "google/gemini-3-pro-image-preview"
	| "google/gemini-3-pro-preview"
	| "google/gemma-2-27b-it"
	| "google/gemma-2-9b-it"
	| "google/gemma-3-12b-it"
	| "google/gemma-3-27b-it"
	| "google/gemma-3-4b-it"
	| "google/gemma-3n-e4b-it"
	// gryphe
	| "gryphe/mythomax-l2-13b"
	// ibm-granite
	| "ibm-granite/granite-4.0-h-micro"
	// inception
	| "inception/mercury"
	| "inception/mercury-coder"
	// inflection
	| "inflection/inflection-3-pi"
	| "inflection/inflection-3-productivity"
	// kwaipilot
	| "kwaipilot/kat-coder-pro"
	// liquid
	| "liquid/lfm-2.2-6b"
	| "liquid/lfm2-8b-a1b"
	// mancer
	| "mancer/weaver"
	// meituan
	| "meituan/longcat-flash-chat"
	// meta-llama
	| "meta-llama/llama-3-70b-instruct"
	| "meta-llama/llama-3-8b-instruct"
	| "meta-llama/llama-3.1-405b"
	| "meta-llama/llama-3.1-405b-instruct"
	| "meta-llama/llama-3.1-70b-instruct"
	| "meta-llama/llama-3.1-8b-instruct"
	| "meta-llama/llama-3.2-11b-vision-instruct"
	| "meta-llama/llama-3.2-1b-instruct"
	| "meta-llama/llama-3.2-3b-instruct"
	| "meta-llama/llama-3.3-70b-instruct"
	| "meta-llama/llama-4-maverick"
	| "meta-llama/llama-4-scout"
	| "meta-llama/llama-guard-2-8b"
	| "meta-llama/llama-guard-3-8b"
	| "meta-llama/llama-guard-4-12b"
	// microsoft
	| "microsoft/phi-4"
	| "microsoft/wizardlm-2-8x22b"
	// minimax
	| "minimax/minimax-01"
	| "minimax/minimax-m1"
	| "minimax/minimax-m2"
	| "minimax/minimax-m2-her"
	| "minimax/minimax-m2.1"
	| "minimax/minimax-m2.5"
	// mistralai
	| "mistralai/codestral-2508"
	| "mistralai/devstral-2512"
	| "mistralai/devstral-medium"
	| "mistralai/devstral-small"
	| "mistralai/ministral-14b-2512"
	| "mistralai/ministral-3b-2512"
	| "mistralai/ministral-8b-2512"
	| "mistralai/mistral-7b-instruct"
	| "mistralai/mistral-7b-instruct-v0.1"
	| "mistralai/mistral-7b-instruct-v0.2"
	| "mistralai/mistral-7b-instruct-v0.3"
	| "mistralai/mistral-large"
	| "mistralai/mistral-large-2407"
	| "mistralai/mistral-large-2411"
	| "mistralai/mistral-large-2512"
	| "mistralai/mistral-medium-3"
	| "mistralai/mistral-medium-3.1"
	| "mistralai/mistral-nemo"
	| "mistralai/mistral-saba"
	| "mistralai/mistral-small-24b-instruct-2501"
	| "mistralai/mistral-small-3.1-24b-instruct"
	| "mistralai/mistral-small-3.2-24b-instruct"
	| "mistralai/mistral-small-creative"
	| "mistralai/mixtral-8x22b-instruct"
	| "mistralai/mixtral-8x7b-instruct"
	| "mistralai/pixtral-large-2411"
	| "mistralai/voxtral-small-24b-2507"
	// moonshotai
	| "moonshotai/kimi-k2"
	| "moonshotai/kimi-k2-0905"
	| "moonshotai/kimi-k2-0905:exacto"
	| "moonshotai/kimi-k2-thinking"
	| "moonshotai/kimi-k2.5"
	// morph
	| "morph/morph-v3-fast"
	| "morph/morph-v3-large"
	// neversleep
	| "neversleep/llama-3.1-lumimaid-8b"
	| "neversleep/noromaid-20b"
	// nex-agi
	| "nex-agi/deepseek-v3.1-nex-n1"
	// nousresearch
	| "nousresearch/deephermes-3-mistral-24b-preview"
	| "nousresearch/hermes-2-pro-llama-3-8b"
	| "nousresearch/hermes-3-llama-3.1-405b"
	| "nousresearch/hermes-3-llama-3.1-70b"
	| "nousresearch/hermes-4-405b"
	| "nousresearch/hermes-4-70b"
	// nvidia
	| "nvidia/llama-3.1-nemotron-70b-instruct"
	| "nvidia/llama-3.1-nemotron-ultra-253b-v1"
	| "nvidia/llama-3.3-nemotron-super-49b-v1.5"
	| "nvidia/nemotron-3-nano-30b-a3b"
	| "nvidia/nemotron-nano-12b-v2-vl"
	| "nvidia/nemotron-nano-9b-v2"
	// openai
	| "openai/chatgpt-4o-latest"
	| "openai/gpt-3.5-turbo"
	| "openai/gpt-3.5-turbo-0613"
	| "openai/gpt-3.5-turbo-16k"
	| "openai/gpt-3.5-turbo-instruct"
	| "openai/gpt-4"
	| "openai/gpt-4-0314"
	| "openai/gpt-4-1106-preview"
	| "openai/gpt-4-turbo"
	| "openai/gpt-4-turbo-preview"
	| "openai/gpt-4.1"
	| "openai/gpt-4.1-mini"
	| "openai/gpt-4.1-nano"
	| "openai/gpt-4o"
	| "openai/gpt-4o-2024-05-13"
	| "openai/gpt-4o-2024-08-06"
	| "openai/gpt-4o-2024-11-20"
	| "openai/gpt-4o-audio-preview"
	| "openai/gpt-4o-mini"
	| "openai/gpt-4o-mini-2024-07-18"
	| "openai/gpt-4o-mini-search-preview"
	| "openai/gpt-4o-search-preview"
	| "openai/gpt-5"
	| "openai/gpt-5-chat"
	| "openai/gpt-5-codex"
	| "openai/gpt-5-image"
	| "openai/gpt-5-image-mini"
	| "openai/gpt-5-mini"
	| "openai/gpt-5-nano"
	| "openai/gpt-5-pro"
	| "openai/gpt-5.1"
	| "openai/gpt-5.1-chat"
	| "openai/gpt-5.1-codex"
	| "openai/gpt-5.1-codex-max"
	| "openai/gpt-5.1-codex-mini"
	| "openai/gpt-5.2"
	| "openai/gpt-5.2-chat"
	| "openai/gpt-5.2-codex"
	| "openai/gpt-5.2-pro"
	| "openai/gpt-audio"
	| "openai/gpt-audio-mini"
	| "openai/gpt-oss-120b"
	| "openai/gpt-oss-120b:exacto"
	| "openai/gpt-oss-20b"
	| "openai/gpt-oss-safeguard-20b"
	| "openai/o1"
	| "openai/o1-pro"
	| "openai/o3"
	| "openai/o3-deep-research"
	| "openai/o3-mini"
	| "openai/o3-mini-high"
	| "openai/o3-pro"
	| "openai/o4-mini"
	| "openai/o4-mini-deep-research"
	| "openai/o4-mini-high"
	// opengvlab
	| "opengvlab/internvl3-78b"
	// openrouter
	| "openrouter/aurora-alpha"
	| "openrouter/auto"
	| "openrouter/bodybuilder"
	| "openrouter/free"
	// perplexity
	| "perplexity/sonar"
	| "perplexity/sonar-deep-research"
	| "perplexity/sonar-pro"
	| "perplexity/sonar-pro-search"
	| "perplexity/sonar-reasoning-pro"
	// prime-intellect
	| "prime-intellect/intellect-3"
	// qwen
	| "qwen/qwen-2.5-72b-instruct"
	| "qwen/qwen-2.5-7b-instruct"
	| "qwen/qwen-2.5-coder-32b-instruct"
	| "qwen/qwen-2.5-vl-7b-instruct"
	| "qwen/qwen-max"
	| "qwen/qwen-plus"
	| "qwen/qwen-plus-2025-07-28"
	| "qwen/qwen-plus-2025-07-28:thinking"
	| "qwen/qwen-turbo"
	| "qwen/qwen-vl-max"
	| "qwen/qwen-vl-plus"
	| "qwen/qwen2.5-coder-7b-instruct"
	| "qwen/qwen2.5-vl-32b-instruct"
	| "qwen/qwen2.5-vl-72b-instruct"
	| "qwen/qwen3-14b"
	| "qwen/qwen3-235b-a22b"
	| "qwen/qwen3-235b-a22b-2507"
	| "qwen/qwen3-235b-a22b-thinking-2507"
	| "qwen/qwen3-30b-a3b"
	| "qwen/qwen3-30b-a3b-instruct-2507"
	| "qwen/qwen3-30b-a3b-thinking-2507"
	| "qwen/qwen3-32b"
	| "qwen/qwen3-4b"
	| "qwen/qwen3-8b"
	| "qwen/qwen3-coder"
	| "qwen/qwen3-coder-30b-a3b-instruct"
	| "qwen/qwen3-coder-flash"
	| "qwen/qwen3-coder-next"
	| "qwen/qwen3-coder-plus"
	| "qwen/qwen3-coder:exacto"
	| "qwen/qwen3-max"
	| "qwen/qwen3-max-thinking"
	| "qwen/qwen3-next-80b-a3b-instruct"
	| "qwen/qwen3-next-80b-a3b-thinking"
	| "qwen/qwen3-vl-235b-a22b-instruct"
	| "qwen/qwen3-vl-235b-a22b-thinking"
	| "qwen/qwen3-vl-30b-a3b-instruct"
	| "qwen/qwen3-vl-30b-a3b-thinking"
	| "qwen/qwen3-vl-32b-instruct"
	| "qwen/qwen3-vl-8b-instruct"
	| "qwen/qwen3-vl-8b-thinking"
	| "qwen/qwq-32b"
	// raifle
	| "raifle/sorcererlm-8x22b"
	// relace
	| "relace/relace-apply-3"
	| "relace/relace-search"
	// sao10k
	| "sao10k/l3-euryale-70b"
	| "sao10k/l3-lunaris-8b"
	| "sao10k/l3.1-70b-hanami-x1"
	| "sao10k/l3.1-euryale-70b"
	| "sao10k/l3.3-euryale-70b"
	// stepfun
	| "stepfun/step-3.5-flash"
	// switchpoint
	| "switchpoint/router"
	// tencent
	| "tencent/hunyuan-a13b-instruct"
	// thedrummer
	| "thedrummer/cydonia-24b-v4.1"
	| "thedrummer/rocinante-12b"
	| "thedrummer/skyfall-36b-v2"
	| "thedrummer/unslopnemo-12b"
	// tngtech
	| "tngtech/deepseek-r1t-chimera"
	| "tngtech/deepseek-r1t2-chimera"
	| "tngtech/tng-r1t-chimera"
	// undi95
	| "undi95/remm-slerp-l2-13b"
	// writer
	| "writer/palmyra-x5"
	// x-ai
	| "x-ai/grok-3"
	| "x-ai/grok-3-beta"
	| "x-ai/grok-3-mini"
	| "x-ai/grok-3-mini-beta"
	| "x-ai/grok-4"
	| "x-ai/grok-4-fast"
	| "x-ai/grok-4.1-fast"
	| "x-ai/grok-code-fast-1"
	// xiaomi
	| "xiaomi/mimo-v2-flash"
	// z-ai
	| "z-ai/glm-4-32b"
	| "z-ai/glm-4.5"
	| "z-ai/glm-4.5-air"
	| "z-ai/glm-4.5v"
	| "z-ai/glm-4.6"
	| "z-ai/glm-4.6:exacto"
	| "z-ai/glm-4.6v"
	| "z-ai/glm-4.7"
	| "z-ai/glm-4.7-flash"
	| "z-ai/glm-5";
// --- GENERATED:KnownModel:END ---

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
