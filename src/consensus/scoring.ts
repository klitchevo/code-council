/**
 * Scoring and disagreement detection for consensus analysis.
 * Calculates confidence scores and identifies conflicting opinions.
 */

import { logger } from "../logger";
import type {
	ConsensusStats,
	ConsensusType,
	Disagreement,
	DisagreementId,
	DisagreementPosition,
	Finding,
	FindingCluster,
} from "./types";
import { toDisagreementId } from "./types";

/**
 * Configuration for scoring
 */
export interface ScoringConfig {
	/** Model weights for confidence calculation (model ID -> weight) */
	modelWeights: Record<string, number>;
	/** Default weight for models not in the weights map */
	defaultWeight: number;
	/** Threshold for detecting severity disagreement */
	severityDisagreementThreshold: number;
}

const DEFAULT_SCORING_CONFIG: ScoringConfig = {
	modelWeights: {},
	defaultWeight: 1.0,
	severityDisagreementThreshold: 2, // 2+ severity levels apart
};

/**
 * Generate a unique disagreement ID
 */
function generateDisagreementId(): DisagreementId {
	const timestamp = Date.now().toString(36);
	const random = Math.random().toString(36).substring(2, 8);
	return toDisagreementId(`disagreement-${timestamp}-${random}`);
}

/**
 * Get the weight for a model
 */
function getModelWeight(model: string, config: ScoringConfig): number {
	return config.modelWeights[model] ?? config.defaultWeight;
}

/**
 * Calculate weighted confidence score for a cluster
 * @param agreeingModels - Models that agree on this finding
 * @param allModels - All participating models
 * @param config - Scoring configuration
 * @returns Confidence score between 0 and 1
 */
export function calculateConfidence(
	agreeingModels: string[],
	allModels: string[],
	config: Partial<ScoringConfig> = {},
): number {
	const fullConfig: ScoringConfig = {
		...DEFAULT_SCORING_CONFIG,
		...config,
	};

	if (allModels.length === 0) {
		return 0;
	}

	// Calculate total weight
	let totalWeight = 0;
	for (const model of allModels) {
		totalWeight += getModelWeight(model, fullConfig);
	}

	// Calculate agreeing weight
	let agreeingWeight = 0;
	for (const model of agreeingModels) {
		agreeingWeight += getModelWeight(model, fullConfig);
	}

	return totalWeight > 0 ? agreeingWeight / totalWeight : 0;
}

/**
 * Determine consensus type based on confidence and model count
 */
export function determineConsensusType(
	confidence: number,
	agreeingCount: number,
	totalCount: number,
): ConsensusType {
	if (agreeingCount === 1) {
		return "single";
	}
	if (confidence >= 0.95 || agreeingCount === totalCount) {
		return "unanimous";
	}
	if (confidence > 0.5) {
		return "majority";
	}
	return "minority";
}

/**
 * Severity order for comparison (lower index = more severe)
 */
const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"] as const;

/**
 * Get severity index (0 = most severe)
 */
function getSeverityIndex(severity: string): number {
	const index = SEVERITY_ORDER.indexOf(
		severity as (typeof SEVERITY_ORDER)[number],
	);
	return index >= 0 ? index : SEVERITY_ORDER.length - 1;
}

/**
 * Check if findings in a cluster have significant severity disagreement
 */
function hasSeverityDisagreement(
	findings: readonly Finding[],
	threshold: number,
): boolean {
	if (findings.length < 2) {
		return false;
	}

	const severities = findings.map((f) => getSeverityIndex(f.severity));
	const minSeverity = Math.min(...severities);
	const maxSeverity = Math.max(...severities);

	return maxSeverity - minSeverity >= threshold;
}

/**
 * Check if findings have contradictory suggestions
 */
function hasContradictorySuggestions(findings: readonly Finding[]): boolean {
	const suggestions = findings
		.map((f) => (f.suggestion ?? "").toLowerCase())
		.filter((s) => s.length > 0);

	if (suggestions.length < 2) {
		return false;
	}

	// Check for explicit contradictions
	const contradictoryPairs = [
		["remove", "keep"],
		["add", "remove"],
		["increase", "decrease"],
		["enable", "disable"],
		["use", "avoid"],
		["should", "should not"],
		["don't", "do"],
	];

	for (const pair of contradictoryPairs) {
		const word1 = pair[0];
		const word2 = pair[1];
		if (!word1 || !word2) continue;
		const hasWord1 = suggestions.some((s) => s.includes(word1));
		const hasWord2 = suggestions.some((s) => s.includes(word2));
		if (hasWord1 && hasWord2) {
			return true;
		}
	}

	return false;
}

/**
 * Detect disagreements within a cluster
 */
export function detectDisagreement(
	cluster: FindingCluster,
	config: Partial<ScoringConfig> = {},
): Disagreement | null {
	const fullConfig: ScoringConfig = {
		...DEFAULT_SCORING_CONFIG,
		...config,
	};

	const findings = cluster.findings;

	// Need multiple findings to have disagreement
	if (findings.length < 2) {
		return null;
	}

	// Check for severity disagreement
	const severityDisagreement = hasSeverityDisagreement(
		findings,
		fullConfig.severityDisagreementThreshold,
	);

	// Check for contradictory suggestions
	const suggestionDisagreement = hasContradictorySuggestions(findings);

	if (!severityDisagreement && !suggestionDisagreement) {
		return null;
	}

	// Build disagreement record
	const positions: DisagreementPosition[] = findings.map((f) => ({
		model: f.sourceModel,
		stance: `${f.severity}: ${f.title}`,
		reasoning: f.suggestion ?? f.description.substring(0, 200),
	}));

	let topic = cluster.title;
	if (severityDisagreement) {
		const severities = [...new Set(findings.map((f) => f.severity))];
		topic = `Severity disagreement: ${severities.join(" vs ")}`;
	} else if (suggestionDisagreement) {
		topic = `Conflicting recommendations for: ${cluster.title}`;
	}

	const humanActionRequired = severityDisagreement
		? `Models disagree on severity (${[...new Set(findings.map((f) => f.severity))].join(", ")}). Review to determine actual impact.`
		: `Models have contradictory suggestions. Review recommendations to choose the appropriate fix.`;

	return {
		id: generateDisagreementId(),
		clusterId: cluster.id,
		topic,
		category: cluster.category,
		location: cluster.canonicalLocation,
		positions,
		humanActionRequired,
	};
}

/**
 * Detect all disagreements across clusters
 */
export function detectAllDisagreements(
	clusters: FindingCluster[],
	config: Partial<ScoringConfig> = {},
): Disagreement[] {
	const disagreements: Disagreement[] = [];

	for (const cluster of clusters) {
		const disagreement = detectDisagreement(cluster, config);
		if (disagreement) {
			disagreements.push(disagreement);
		}
	}

	logger.debug("Disagreement detection complete", {
		clusterCount: clusters.length,
		disagreementCount: disagreements.length,
	});

	return disagreements;
}

/**
 * Update clusters with weighted confidence scores
 */
export function scoreCluster(
	cluster: FindingCluster,
	allModels: string[],
	config: Partial<ScoringConfig> = {},
): FindingCluster {
	const confidence = calculateConfidence(
		[...cluster.agreeingModels],
		allModels,
		config,
	);

	const consensusType = determineConsensusType(
		confidence,
		cluster.agreeingModels.length,
		allModels.length,
	);

	// Check for disagreeing models (models that mentioned the same location/category but with very different assessment)
	const disagreement = detectDisagreement(cluster, config);
	const disagreingModels = disagreement
		? cluster.findings
				.filter((f) => {
					const severityIndex = getSeverityIndex(f.severity);
					const avgSeverity =
						cluster.findings.reduce(
							(sum, cf) => sum + getSeverityIndex(cf.severity),
							0,
						) / cluster.findings.length;
					return Math.abs(severityIndex - avgSeverity) > 1;
				})
				.map((f) => f.sourceModel)
		: [];

	return {
		...cluster,
		confidence,
		consensusType,
		disagreingModels,
	};
}

/**
 * Score all clusters
 */
export function scoreClusters(
	clusters: FindingCluster[],
	allModels: string[],
	config: Partial<ScoringConfig> = {},
): FindingCluster[] {
	return clusters.map((cluster) => scoreCluster(cluster, allModels, config));
}

/**
 * Calculate statistics for a consensus report
 */
export function calculateStats(
	clusters: FindingCluster[],
	disagreements: Disagreement[],
): ConsensusStats {
	let unanimous = 0;
	let majority = 0;
	let minority = 0;
	let single = 0;

	for (const cluster of clusters) {
		switch (cluster.consensusType) {
			case "unanimous":
				unanimous++;
				break;
			case "majority":
				majority++;
				break;
			case "minority":
				minority++;
				break;
			case "single":
				single++;
				break;
		}
	}

	return {
		unanimous,
		majority,
		minority,
		single,
		disagreements: disagreements.length,
	};
}
