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
// PR comment mapping
export type { MappedComment, MappingResult } from "./comment-mapper";
export {
	countMappedComments,
	countUnmappedFindings,
	filterCommentsBySeverity,
	groupCommentsByFile,
	mapClustersToComments,
} from "./comment-mapper";
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
// PR comment formatting
export type {
	FormatOptions as PrCommentFormatOptions,
	GitHubPrComment,
	GitHubPrReview,
} from "./pr-comment-formatter";
export { formatPrComments, serializePrReview } from "./pr-comment-formatter";
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
