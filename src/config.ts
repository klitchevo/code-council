/**
 * Configuration for Code Council MCP Server
 *
 * Configuration sources (in order of priority):
 * 1. Config file - .code-council/config.ts or code-council.config.ts (highest)
 * 2. Environment variables
 * 3. Default values (lowest)
 *
 * Find models at: https://openrouter.ai/models
 *
 * Example config file:
 * ```typescript
 * // .code-council/config.ts
 * import { defineConfig } from "@klitchevo/code-council/config";
 *
 * export default defineConfig({
 *   models: {
 *     codeReview: ["anthropic/claude-sonnet-4", "openai/gpt-4o"],
 *   },
 *   consensus: {
 *     enabled: true,
 *   },
 * });
 * ```
 *
 * Example MCP config (env vars):
 * {
 *   "env": {
 *     "OPENROUTER_API_KEY": "your-key",
 *     "CODE_REVIEW_MODELS": ["anthropic/claude-sonnet-4.5", "openai/gpt-4o"]
 *   }
 * }
 */

import type { CodeCouncilConfig } from "./config/types";
import { DEFAULT_MODELS } from "./constants";

/**
 * Loaded configuration from file (if any)
 * This gets populated by initializeConfig()
 */
let fileConfig: CodeCouncilConfig = {};
let configPath: string | null = null;
let configInitialized = false;

/**
 * Initialize configuration by loading from file
 * Must be called before accessing config values
 */
export async function initializeConfig(
	cwd: string = process.cwd(),
): Promise<void> {
	if (configInitialized) return;

	try {
		// Dynamic import to avoid circular dependencies
		const { loadConfig } = await import("./config/loader");
		const result = await loadConfig(cwd);
		fileConfig = result.config;
		configPath = result.configPath;
	} catch (error) {
		// Log error but continue with env vars only
		console.error("Warning: Failed to load config file:", error);
		fileConfig = {};
		configPath = null;
	}

	configInitialized = true;
}

/**
 * Get the path to the loaded config file
 */
export function getConfigPath(): string | null {
	return configPath;
}

/**
 * Check if config has been initialized
 */
export function isConfigInitialized(): boolean {
	return configInitialized;
}

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

	// Already an array
	if (Array.isArray(envVar)) {
		const filtered = envVar.filter((m) => m && m.trim().length > 0);
		return filtered.length > 0 ? filtered : defaults;
	}

	// String - try to parse as JSON array
	try {
		const parsed = JSON.parse(envVar);
		if (Array.isArray(parsed)) {
			const filtered = parsed.filter(
				(m) => typeof m === "string" && m.trim().length > 0,
			);
			return filtered.length > 0 ? filtered : defaults;
		}
	} catch {
		// Not valid JSON, fall through to error
	}

	// Invalid format
	throw new Error(
		`Model configuration must be an array of strings, got: ${typeof envVar}. Example: ["anthropic/claude-sonnet-4.5", "openai/gpt-4o"]`,
	);
}

/**
 * Get models for a specific review type
 * Priority: specific config > defaultModels > env var > defaults
 */
function getModels(
	fileConfigKey: keyof Omit<
		NonNullable<CodeCouncilConfig["models"]>,
		"defaultModels"
	>,
	envVarName: string,
): string[] {
	// Check specific file config first
	const fromFile = fileConfig.models?.[fileConfigKey];
	if (fromFile && fromFile.length > 0) {
		return fromFile;
	}

	// Check defaultModels from file config
	const defaultModels = fileConfig.models?.defaultModels;
	if (defaultModels && defaultModels.length > 0) {
		return defaultModels;
	}

	// Fall back to env var
	return parseModels(
		process.env[envVarName] as string | string[] | undefined,
		DEFAULT_MODELS,
	);
}

/**
 * Models to use for code review (runs in parallel)
 */
export function getCodeReviewModels(): string[] {
	return getModels("codeReview", "CODE_REVIEW_MODELS");
}

/**
 * Models to use for frontend review (runs in parallel)
 */
export function getFrontendReviewModels(): string[] {
	return getModels("frontendReview", "FRONTEND_REVIEW_MODELS");
}

/**
 * Models to use for backend review (runs in parallel)
 */
export function getBackendReviewModels(): string[] {
	return getModels("backendReview", "BACKEND_REVIEW_MODELS");
}

/**
 * Models to use for plan review (runs in parallel)
 */
export function getPlanReviewModels(): string[] {
	return getModels("planReview", "PLAN_REVIEW_MODELS");
}

/**
 * Models to use for council discussions (runs in parallel)
 */
export function getDiscussionModels(): string[] {
	return getModels("discussion", "DISCUSSION_MODELS");
}

/**
 * Models to use for TPS audits (runs in parallel)
 */
export function getTpsAuditModels(): string[] {
	return getModels("tpsAudit", "TPS_AUDIT_MODELS");
}

// Legacy exports for backwards compatibility (initialized at startup)
// These use getters to defer access until after initialization
export const CODE_REVIEW_MODELS: string[] = parseModels(
	process.env.CODE_REVIEW_MODELS as string | string[] | undefined,
	DEFAULT_MODELS,
);

export const FRONTEND_REVIEW_MODELS: string[] = parseModels(
	process.env.FRONTEND_REVIEW_MODELS as string | string[] | undefined,
	DEFAULT_MODELS,
);

export const BACKEND_REVIEW_MODELS: string[] = parseModels(
	process.env.BACKEND_REVIEW_MODELS as string | string[] | undefined,
	DEFAULT_MODELS,
);

export const PLAN_REVIEW_MODELS: string[] = parseModels(
	process.env.PLAN_REVIEW_MODELS as string | string[] | undefined,
	DEFAULT_MODELS,
);

export const DISCUSSION_MODELS: string[] = parseModels(
	process.env.DISCUSSION_MODELS as string | string[] | undefined,
	DEFAULT_MODELS,
);

export const TPS_AUDIT_MODELS: string[] = parseModels(
	process.env.TPS_AUDIT_MODELS as string | string[] | undefined,
	DEFAULT_MODELS,
);

// ============================================================================
// Consensus Configuration
// ============================================================================

/**
 * Parse model weights from environment variable
 * Accepts JSON object: {"model-id": weight, "default": 1.0}
 */
export function parseModelWeights(
	envVar: string | undefined,
): Record<string, number> {
	if (!envVar) {
		return {};
	}

	try {
		const parsed = JSON.parse(envVar);
		if (typeof parsed === "object" && parsed !== null) {
			const weights: Record<string, number> = {};
			for (const [key, value] of Object.entries(parsed)) {
				if (typeof value === "number" && value > 0) {
					weights[key] = value;
				}
			}
			return weights;
		}
	} catch {
		// Invalid JSON, return empty
	}

	return {};
}

/**
 * Whether consensus analysis is enabled
 *
 * @deprecated All review tools now use host extraction by default.
 * This setting is ignored - consensus formatting is always applied.
 * The setting is kept for backwards compatibility but will be removed in a future version.
 */
export function getEnableConsensus(): boolean {
	// Log deprecation warning once
	if (
		(fileConfig.consensus?.enabled !== undefined ||
			process.env.ENABLE_CONSENSUS !== undefined) &&
		!consensusDeprecationWarned
	) {
		console.warn(
			"[code-council] Warning: consensus.enabled is deprecated. " +
				"All review tools now use host extraction mode by default. " +
				"This setting will be removed in a future version.",
		);
		consensusDeprecationWarned = true;
	}

	// Always return true - consensus is now always enabled via host extraction
	return true;
}

// Track whether we've shown the deprecation warning
let consensusDeprecationWarned = false;

/**
 * Custom model weights for consensus scoring
 * Priority: file config > env var > default ({})
 */
export function getModelWeights(): Record<string, number> {
	if (
		fileConfig.consensus?.modelWeights &&
		Object.keys(fileConfig.consensus.modelWeights).length > 0
	) {
		return fileConfig.consensus.modelWeights;
	}
	return parseModelWeights(process.env.MODEL_WEIGHTS);
}

/**
 * High confidence threshold
 * Priority: file config > env var > default (0.8)
 */
export function getHighConfidenceThreshold(): number {
	if (fileConfig.consensus?.highConfidenceThreshold !== undefined) {
		return fileConfig.consensus.highConfidenceThreshold;
	}
	return Math.min(
		1,
		Math.max(
			0,
			Number.parseFloat(process.env.HIGH_CONFIDENCE_THRESHOLD ?? "0.8"),
		),
	);
}

/**
 * Moderate confidence threshold
 * Priority: file config > env var > default (0.5)
 */
export function getModerateConfidenceThreshold(): number {
	if (fileConfig.consensus?.moderateConfidenceThreshold !== undefined) {
		return fileConfig.consensus.moderateConfidenceThreshold;
	}
	return Math.min(
		1,
		Math.max(
			0,
			Number.parseFloat(process.env.MODERATE_CONFIDENCE_THRESHOLD ?? "0.5"),
		),
	);
}

/**
 * Model to use for finding extraction in consensus analysis
 * Priority: file config > env var > default
 */
export function getConsensusExtractionModel(): string {
	if (fileConfig.consensus?.extractionModel) {
		return fileConfig.consensus.extractionModel;
	}
	return process.env.CONSENSUS_EXTRACTION_MODEL ?? "anthropic/claude-3-haiku";
}

/**
 * Whether to fall back to raw reviews if consensus analysis fails
 * Priority: file config > env var > default (true)
 */
export function getConsensusFallbackOnError(): boolean {
	if (fileConfig.consensus?.fallbackOnError !== undefined) {
		return fileConfig.consensus.fallbackOnError;
	}
	return process.env.CONSENSUS_FALLBACK_ON_ERROR?.toLowerCase() !== "false";
}

/**
 * Whether to let the MCP host model do extraction
 * Priority: file config > env var > default (true)
 */
export function getHostExtraction(): boolean {
	if (fileConfig.consensus?.hostExtraction !== undefined) {
		return fileConfig.consensus.hostExtraction;
	}
	return process.env.CONSENSUS_HOST_EXTRACTION?.toLowerCase() !== "false";
}

/**
 * @deprecated All review tools now use host extraction by default.
 * This constant is kept for backwards compatibility but is always true.
 */
export const ENABLE_CONSENSUS: boolean = true;

export const MODEL_WEIGHTS: Record<string, number> = parseModelWeights(
	process.env.MODEL_WEIGHTS,
);

export const HIGH_CONFIDENCE_THRESHOLD: number = Math.min(
	1,
	Math.max(
		0,
		Number.parseFloat(process.env.HIGH_CONFIDENCE_THRESHOLD ?? "0.8"),
	),
);

export const MODERATE_CONFIDENCE_THRESHOLD: number = Math.min(
	1,
	Math.max(
		0,
		Number.parseFloat(process.env.MODERATE_CONFIDENCE_THRESHOLD ?? "0.5"),
	),
);

export const CONSENSUS_EXTRACTION_MODEL: string =
	process.env.CONSENSUS_EXTRACTION_MODEL ?? "anthropic/claude-3-haiku";

export const CONSENSUS_FALLBACK_ON_ERROR: boolean =
	process.env.CONSENSUS_FALLBACK_ON_ERROR?.toLowerCase() !== "false";

/**
 * Get complete consensus configuration
 * Uses file config if available, otherwise falls back to env vars
 */
export function getConsensusConfig() {
	return {
		enabled: getEnableConsensus(),
		modelWeights: getModelWeights(),
		highConfidenceThreshold: getHighConfidenceThreshold(),
		moderateConfidenceThreshold: getModerateConfidenceThreshold(),
		extractionModel: getConsensusExtractionModel(),
		fallbackOnError: getConsensusFallbackOnError(),
		hostExtraction: getHostExtraction(),
	} as const;
}

// Default for host extraction (env var)
export const HOST_EXTRACTION: boolean =
	process.env.CONSENSUS_HOST_EXTRACTION?.toLowerCase() !== "false";

/**
 * Complete consensus configuration object (legacy)
 *
 * @deprecated Use getConsensusConfig() instead.
 * All review tools now use host extraction by default.
 */
export const CONSENSUS_CONFIG = {
	enabled: true, // Always enabled via host extraction
	modelWeights: MODEL_WEIGHTS,
	highConfidenceThreshold: HIGH_CONFIDENCE_THRESHOLD,
	moderateConfidenceThreshold: MODERATE_CONFIDENCE_THRESHOLD,
	extractionModel: CONSENSUS_EXTRACTION_MODEL,
	fallbackOnError: CONSENSUS_FALLBACK_ON_ERROR,
	hostExtraction: true, // Always use host extraction
} as const;
