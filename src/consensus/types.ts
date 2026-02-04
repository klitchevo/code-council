/**
 * Type definitions for consensus analysis of multi-model reviews.
 * Uses branded types for type-safe IDs and const assertions for enums.
 */

/**
 * Branded type utilities (matching session/types.ts pattern)
 */
declare const __brand: unique symbol;
type Brand<T, B> = T & { readonly [__brand]: B };

/**
 * Branded types for unique identifiers
 */
export type FindingId = Brand<string, "FindingId">;
export type ClusterId = Brand<string, "ClusterId">;
export type DisagreementId = Brand<string, "DisagreementId">;

/**
 * Helper functions to create branded IDs (use after validation)
 */
export function toFindingId(id: string): FindingId {
	return id as FindingId;
}

export function toClusterId(id: string): ClusterId {
	return id as ClusterId;
}

export function toDisagreementId(id: string): DisagreementId {
	return id as DisagreementId;
}

/**
 * Finding categories - const assertion for type safety and reuse in Zod
 */
export const FINDING_CATEGORIES = [
	"security",
	"performance",
	"bug",
	"maintainability",
	"accessibility",
	"architecture",
	"style",
	"documentation",
	"testing",
	"other",
] as const;
export type FindingCategory = (typeof FINDING_CATEGORIES)[number];

/**
 * Finding severities - const assertion for type safety and reuse in Zod
 */
export const FINDING_SEVERITIES = [
	"critical",
	"high",
	"medium",
	"low",
	"info",
] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

/**
 * Consensus types based on agreement level
 */
export const CONSENSUS_TYPES = [
	"unanimous",
	"majority",
	"minority",
	"single",
] as const;
export type ConsensusType = (typeof CONSENSUS_TYPES)[number];

/**
 * Output format options for consensus reports
 */
export const OUTPUT_FORMATS = [
	"markdown",
	"json",
	"html",
	"pr-comments",
] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

/**
 * Location in source code
 */
export interface CodeLocation {
	readonly file: string;
	readonly line?: number;
	readonly endLine?: number;
}

/**
 * A single finding extracted from a model's review
 */
export interface Finding {
	readonly id: FindingId;
	readonly sourceModel: string;
	readonly category: FindingCategory;
	readonly severity: FindingSeverity;
	readonly title: string;
	readonly description: string;
	readonly location?: CodeLocation;
	readonly suggestion?: string;
	/** Actual code to replace the problematic code (for GitHub suggestion blocks) */
	readonly suggestedCode?: string;
	/** Original text from the review that this finding was extracted from (optional) */
	readonly rawExcerpt?: string;
	/** ISO timestamp when the finding was extracted */
	readonly extractedAt: string;
	/** Confidence in the extraction accuracy (0-1) */
	readonly confidence?: number;
}

/**
 * A position taken by a model in a disagreement
 */
export interface DisagreementPosition {
	readonly model: string;
	readonly stance: string;
	readonly reasoning?: string;
}

/**
 * A cluster of similar findings from multiple models
 */
export interface FindingCluster {
	readonly id: ClusterId;
	readonly title: string;
	readonly category: FindingCategory;
	readonly severity: FindingSeverity;
	readonly canonicalLocation?: CodeLocation;
	readonly findings: readonly Finding[];
	/** Models that agree with this finding */
	readonly agreeingModels: readonly string[];
	/** Models that did not mention this finding */
	readonly silentModels: readonly string[];
	/** Models that have contradictory views */
	readonly disagreingModels: readonly string[];
	/** Confidence score based on model agreement (0-1) */
	readonly confidence: number;
	readonly consensusType: ConsensusType;
}

/**
 * A disagreement between models on a specific topic
 */
export interface Disagreement {
	readonly id: DisagreementId;
	readonly clusterId: ClusterId;
	readonly topic: string;
	readonly category: FindingCategory;
	readonly location?: CodeLocation;
	readonly positions: readonly DisagreementPosition[];
	/** Explanation of why this needs human review */
	readonly humanActionRequired: string;
}

/**
 * Statistics about the consensus analysis
 */
export interface ConsensusStats {
	readonly unanimous: number;
	readonly majority: number;
	readonly minority: number;
	readonly single: number;
	readonly disagreements: number;
}

/**
 * Metadata about the extraction process
 */
export interface ExtractionMetadata {
	readonly extractionModel: string;
	readonly extractionErrors: number;
}

/**
 * Thresholds for confidence classification
 */
export interface ConfidenceThresholds {
	readonly high: number;
	readonly moderate: number;
}

/**
 * Complete consensus report
 */
export interface ConsensusReport {
	readonly version: "1.0";
	readonly generatedAt: string;
	readonly executionTimeMs: number;
	readonly participatingModels: readonly string[];
	readonly modelWeights: Record<string, number>;
	readonly thresholds: ConfidenceThresholds;
	readonly totalFindings: number;
	readonly stats: ConsensusStats;
	readonly highConfidence: readonly FindingCluster[];
	readonly moderateConfidence: readonly FindingCluster[];
	readonly lowConfidence: readonly FindingCluster[];
	readonly disagreements: readonly Disagreement[];
	readonly metadata?: ExtractionMetadata;
}

/**
 * Configuration for consensus analysis
 */
export interface ConsensusConfig {
	/** Enable consensus analysis */
	readonly enabled: boolean;
	/** Model weights for confidence calculation */
	readonly modelWeights: Record<string, number>;
	/** High confidence threshold (default: 0.8) */
	readonly highConfidenceThreshold: number;
	/** Moderate confidence threshold (default: 0.5) */
	readonly moderateConfidenceThreshold: number;
	/** Model to use for extraction (default: anthropic/claude-3-haiku) */
	readonly extractionModel: string;
	/** Fall back to raw reviews if consensus fails */
	readonly fallbackOnError: boolean;
	/** Line proximity for location matching (default: 5) */
	readonly lineProximity: number;
	/** Similarity threshold for clustering (default: 0.7) */
	readonly similarityThreshold: number;
	/**
	 * Let the MCP host model do extraction instead of making API calls.
	 * When true, returns raw reviews formatted for host analysis.
	 * Recommended for MCP servers. (default: false)
	 */
	readonly hostExtraction: boolean;
}

/**
 * Options passed to consensus builder
 */
export interface ConsensusOptions {
	readonly modelWeights?: Record<string, number>;
	readonly highConfidenceThreshold?: number;
	readonly moderateConfidenceThreshold?: number;
	readonly extractionModel?: string;
	readonly outputFormat?: OutputFormat;
	/**
	 * When true, skip extraction API calls and return raw reviews
	 * formatted for the MCP host model to analyze.
	 * This is the recommended approach for MCP servers since the
	 * host model (e.g., Claude) can do the extraction work itself.
	 */
	readonly hostExtraction?: boolean;
}

/**
 * Default consensus configuration values
 */
export const DEFAULT_CONSENSUS_CONFIG: ConsensusConfig = {
	enabled: false,
	modelWeights: {},
	highConfidenceThreshold: 0.7, // 4+ models for high (was 0.8)
	moderateConfidenceThreshold: 0.33, // 2+ models for moderate (was 0.5)
	extractionModel: "anthropic/claude-3-haiku",
	fallbackOnError: true,
	lineProximity: 5,
	similarityThreshold: 0.5, // Allow more clustering (was 0.7)
	hostExtraction: true, // Recommended: let MCP host model do extraction
};
