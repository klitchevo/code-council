/**
 * Builder that orchestrates the full consensus analysis pipeline.
 * Extract -> Normalize -> Cluster -> Score -> Format
 */

import { logger } from "../logger";
import type { ModelReviewResult } from "../review-client";
import { clusterFindings, groupByConfidence } from "./clustering";
import { ConsensusClient } from "./consensus-client";
import {
	calculateStats,
	detectAllDisagreements,
	scoreClusters,
} from "./scoring";
import type {
	ConfidenceThresholds,
	ConsensusOptions,
	ConsensusReport,
	ExtractionMetadata,
	OutputFormat,
} from "./types";
import { DEFAULT_CONSENSUS_CONFIG } from "./types";

/**
 * Result from building a consensus report
 */
export interface BuildResult {
	/** The complete consensus report */
	report: ConsensusReport;
	/** Formatted output in the requested format */
	formatted: string;
}

/**
 * Build a complete consensus report from model reviews
 *
 * @param reviews - The raw review results from multiple models
 * @param consensusClient - Client for extracting findings
 * @param options - Configuration options
 * @returns Complete consensus report with formatted output
 */
export async function buildConsensusReport(
	reviews: ModelReviewResult[],
	consensusClient: ConsensusClient,
	options: ConsensusOptions = {},
): Promise<BuildResult> {
	const startTime = Date.now();

	// Get all participating models (including those with errors)
	const participatingModels = reviews.map((r) => r.model);

	// Resolve options with defaults
	const modelWeights =
		options.modelWeights ?? DEFAULT_CONSENSUS_CONFIG.modelWeights;
	const highThreshold =
		options.highConfidenceThreshold ??
		DEFAULT_CONSENSUS_CONFIG.highConfidenceThreshold;
	const moderateThreshold =
		options.moderateConfidenceThreshold ??
		DEFAULT_CONSENSUS_CONFIG.moderateConfidenceThreshold;
	const outputFormat = options.outputFormat ?? "markdown";

	const thresholds: ConfidenceThresholds = {
		high: highThreshold,
		moderate: moderateThreshold,
	};

	logger.debug("Starting consensus build", {
		modelCount: reviews.length,
		outputFormat,
	});

	// Step 1: Extract findings from all reviews
	const { findings: allFindings, errors: extractionErrors } =
		await consensusClient.getAllFindingsFlat(reviews);

	// If all extractions failed, return empty report
	if (allFindings.length === 0 && extractionErrors.length === reviews.length) {
		logger.warn("All extractions failed", { errors: extractionErrors });
		return createEmptyReport(
			participatingModels,
			modelWeights,
			thresholds,
			startTime,
			extractionErrors.length,
			consensusClient.getExtractionModel(),
			outputFormat,
		);
	}

	// Step 2: Cluster similar findings
	let clusters = clusterFindings(allFindings, participatingModels, {
		lineProximity: DEFAULT_CONSENSUS_CONFIG.lineProximity,
		similarityThreshold: DEFAULT_CONSENSUS_CONFIG.similarityThreshold,
	});

	// Step 3: Score clusters with weights
	clusters = scoreClusters(clusters, participatingModels, {
		modelWeights,
		defaultWeight: 1.0,
	});

	// Step 4: Detect disagreements
	const disagreements = detectAllDisagreements(clusters, {
		modelWeights,
		defaultWeight: 1.0,
	});

	// Step 5: Group by confidence
	const { highConfidence, moderateConfidence, lowConfidence } =
		groupByConfidence(clusters, thresholds);

	// Step 6: Calculate stats
	const stats = calculateStats(clusters, disagreements);

	// Step 7: Build the report
	const metadata: ExtractionMetadata = {
		extractionModel: consensusClient.getExtractionModel(),
		extractionErrors: extractionErrors.length,
	};

	const report: ConsensusReport = {
		version: "1.0",
		generatedAt: new Date().toISOString(),
		executionTimeMs: Date.now() - startTime,
		participatingModels,
		modelWeights,
		thresholds,
		totalFindings: allFindings.length,
		stats,
		highConfidence,
		moderateConfidence,
		lowConfidence,
		disagreements,
		metadata,
	};

	logger.debug("Consensus report built", {
		totalFindings: allFindings.length,
		clusters: clusters.length,
		disagreements: disagreements.length,
		executionMs: report.executionTimeMs,
	});

	// Step 8: Format output
	const { formatReport } = await import("./formatter");
	const formatted = formatReport(report, outputFormat);

	return { report, formatted };
}

/**
 * Create an empty report when no findings could be extracted
 */
function createEmptyReport(
	participatingModels: string[],
	modelWeights: Record<string, number>,
	thresholds: ConfidenceThresholds,
	startTime: number,
	extractionErrors: number,
	extractionModel: string,
	outputFormat: OutputFormat,
): BuildResult {
	const report: ConsensusReport = {
		version: "1.0",
		generatedAt: new Date().toISOString(),
		executionTimeMs: Date.now() - startTime,
		participatingModels,
		modelWeights,
		thresholds,
		totalFindings: 0,
		stats: {
			unanimous: 0,
			majority: 0,
			minority: 0,
			single: 0,
			disagreements: 0,
		},
		highConfidence: [],
		moderateConfidence: [],
		lowConfidence: [],
		disagreements: [],
		metadata: {
			extractionModel,
			extractionErrors,
		},
	};

	// Import formatter dynamically to avoid circular dependency
	const formatReport = require("./formatter").formatReport;
	const formatted = formatReport(report, outputFormat);

	return { report, formatted };
}

/**
 * Convenience function to build consensus from reviews in one call
 * Creates a ConsensusClient internally
 */
export async function buildConsensus(
	reviews: ModelReviewResult[],
	reviewClient: import("../review-client").ReviewClient,
	options: ConsensusOptions = {},
): Promise<BuildResult> {
	const extractionModel =
		options.extractionModel ?? DEFAULT_CONSENSUS_CONFIG.extractionModel;

	const consensusClient = new ConsensusClient(reviewClient, extractionModel);
	return buildConsensusReport(reviews, consensusClient, options);
}
