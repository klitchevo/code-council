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
 *     "CODE_REVIEW_MODELS": ["anthropic/claude-sonnet-4.5", "openai/gpt-4o"]
 *   }
 * }
 *
 * Single model:
 * {
 *   "env": {
 *     "CODE_REVIEW_MODELS": ["anthropic/claude-sonnet-4.5"]
 *   }
 * }
 *
 * If not configured, defaults to minimax-m2.1, glm-4.7, kimi-k2-thinking, and deepseek-v3.2
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

/**
 * Models to use for council discussions (runs in parallel)
 * Multi-turn conversations with the AI council
 */
export const DISCUSSION_MODELS: string[] = parseModels(
	process.env.DISCUSSION_MODELS as string | string[] | undefined,
	DEFAULT_MODELS,
);

/**
 * Models to use for TPS (Toyota Production System) audits (runs in parallel)
 * Analyzes codebases for flow, waste, bottlenecks using TPS principles
 */
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
 * Set ENABLE_CONSENSUS=true to enable
 */
export const ENABLE_CONSENSUS: boolean =
	process.env.ENABLE_CONSENSUS?.toLowerCase() === "true";

/**
 * Custom model weights for consensus scoring
 * Higher weight = more influence on consensus
 */
export const MODEL_WEIGHTS: Record<string, number> = parseModelWeights(
	process.env.MODEL_WEIGHTS,
);

/**
 * High confidence threshold (default: 0.8)
 * Findings with >= this confidence are marked as high confidence
 */
export const HIGH_CONFIDENCE_THRESHOLD: number = Math.min(
	1,
	Math.max(
		0,
		Number.parseFloat(process.env.HIGH_CONFIDENCE_THRESHOLD ?? "0.8"),
	),
);

/**
 * Moderate confidence threshold (default: 0.5)
 * Findings with >= this confidence but < high are marked as moderate
 */
export const MODERATE_CONFIDENCE_THRESHOLD: number = Math.min(
	1,
	Math.max(
		0,
		Number.parseFloat(process.env.MODERATE_CONFIDENCE_THRESHOLD ?? "0.5"),
	),
);

/**
 * Model to use for finding extraction in consensus analysis
 * Should be fast and cost-effective
 */
export const CONSENSUS_EXTRACTION_MODEL: string =
	process.env.CONSENSUS_EXTRACTION_MODEL ?? "anthropic/claude-3-haiku";

/**
 * Whether to fall back to raw reviews if consensus analysis fails
 */
export const CONSENSUS_FALLBACK_ON_ERROR: boolean =
	process.env.CONSENSUS_FALLBACK_ON_ERROR?.toLowerCase() !== "false";

/**
 * Complete consensus configuration object
 */
export const CONSENSUS_CONFIG = {
	enabled: ENABLE_CONSENSUS,
	modelWeights: MODEL_WEIGHTS,
	highConfidenceThreshold: HIGH_CONFIDENCE_THRESHOLD,
	moderateConfidenceThreshold: MODERATE_CONFIDENCE_THRESHOLD,
	extractionModel: CONSENSUS_EXTRACTION_MODEL,
	fallbackOnError: CONSENSUS_FALLBACK_ON_ERROR,
} as const;
