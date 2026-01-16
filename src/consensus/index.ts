/**
 * Consensus analysis module for multi-model code reviews.
 * Transforms raw reviews into actionable findings with confidence scores.
 *
 * @module consensus
 */

export type { BuildResult } from "./builder";
export {
	buildConsensus,
	buildConsensusReport,
	formatForHostExtraction,
} from "./builder";
export {
	clusterFindings,
	findingSimilarity,
	groupByConfidence,
} from "./clustering";
// Core classes and functions
export { ConsensusClient } from "./consensus-client";
export {
	extractAllFindings,
	extractFindings,
	parseExtractionResponse,
} from "./extractor";
export { formatReport } from "./formatter";
export {
	getCanonicalLocation,
	locationsMatch,
	normalizeCategory,
	normalizeFilePath,
	normalizeFinding,
	normalizeFindings,
	normalizeLocation,
	normalizeSeverity,
} from "./normalizer";
export {
	calculateConfidence,
	calculateStats,
	detectAllDisagreements,
	detectDisagreement,
	determineConsensusType,
	scoreCluster,
	scoreClusters,
} from "./scoring";
// Types
export type {
	ClusterId,
	CodeLocation,
	ConfidenceThresholds,
	ConsensusConfig,
	ConsensusOptions,
	ConsensusReport,
	ConsensusStats,
	ConsensusType,
	Disagreement,
	DisagreementId,
	DisagreementPosition,
	ExtractionMetadata,
	Finding,
	FindingCategory,
	FindingCluster,
	FindingId,
	FindingSeverity,
	OutputFormat,
} from "./types";
// Constants and helpers
export {
	CONSENSUS_TYPES,
	DEFAULT_CONSENSUS_CONFIG,
	FINDING_CATEGORIES,
	FINDING_SEVERITIES,
	OUTPUT_FORMATS,
	toClusterId,
	toDisagreementId,
	toFindingId,
} from "./types";
