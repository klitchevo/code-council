/**
 * Builder that orchestrates the full consensus analysis pipeline.
 * Extract -> Normalize -> Cluster -> Score -> Format
 *
 * Supports two modes:
 * 1. Host extraction (recommended for MCP): Returns raw reviews for host model to analyze
 * 2. API extraction: Makes additional API calls to extract findings
 */

import { logger } from "../logger";
import {
	CATEGORY_DESCRIPTIONS,
	SEVERITY_DESCRIPTIONS,
} from "../prompts/consensus";
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
 * Format reviews for host extraction mode.
 * Returns a structured prompt that the MCP host model can use to analyze the reviews.
 */
export function formatForHostExtraction(
	reviews: ModelReviewResult[],
	outputFormat: OutputFormat = "markdown",
): BuildResult {
	const startTime = Date.now();
	const participatingModels = reviews.map((r) => r.model);

	// Build the host extraction prompt
	let formatted: string;

	if (outputFormat === "json") {
		formatted = JSON.stringify(
			{
				mode: "host_extraction",
				instructions:
					"Analyze these code reviews and synthesize the findings. Identify common issues, disagreements, and provide a unified assessment.",
				reviews: reviews.map((r) => ({
					model: r.model,
					review: r.error ? null : r.review,
					error: r.error || null,
				})),
				categories: CATEGORY_DESCRIPTIONS,
				severities: SEVERITY_DESCRIPTIONS,
			},
			null,
			2,
		);
	} else {
		// Markdown format
		const reviewSections = reviews
			.map((r) => {
				if (r.error) {
					return `## Review from \`${r.model}\`\n\n**Error:** ${r.error}`;
				}
				return `## Review from \`${r.model}\`\n\n${r.review}`;
			})
			.join("\n\n---\n\n");

		formatted = `# Multi-Model Code Review Results

${participatingModels.length} models participated in this review.

## Instructions for Analysis

Please analyze these reviews and provide:
1. **High-confidence findings** - Issues identified by multiple models
2. **Medium-confidence findings** - Issues identified by some models
3. **Low-confidence findings** - Issues mentioned by only one model
4. **Disagreements** - Areas where models have conflicting opinions

For each finding, identify:
- **Category**: ${Object.keys(CATEGORY_DESCRIPTIONS).join(", ")}
- **Severity**: ${Object.keys(SEVERITY_DESCRIPTIONS).join(", ")}
- **Location**: File and line numbers if mentioned
- **Description**: What the issue is
- **Suggestion**: How to fix it

---

${reviewSections}

---

## Summary Request

Based on the above reviews, please provide a synthesized consensus analysis.`;
	}

	// Create a minimal report for host extraction mode
	const report: ConsensusReport = {
		version: "1.0",
		generatedAt: new Date().toISOString(),
		executionTimeMs: Date.now() - startTime,
		participatingModels,
		modelWeights: {},
		thresholds: { high: 0.8, moderate: 0.5 },
		totalFindings: 0, // Host will determine
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
			extractionModel: "host", // Indicates host extraction mode
			extractionErrors: 0,
		},
	};

	return { report, formatted };
}

/**
 * Convenience function to build consensus from reviews in one call
 * Creates a ConsensusClient internally
 *
 * @param reviews - Review results from multiple models
 * @param reviewClient - Client for making LLM calls (only used if hostExtraction is false)
 * @param options - Consensus options including hostExtraction flag
 */
export async function buildConsensus(
	reviews: ModelReviewResult[],
	reviewClient: import("../review-client").ReviewClient,
	options: ConsensusOptions = {},
): Promise<BuildResult> {
	// Check if host extraction mode is enabled (default: true)
	const hostExtraction =
		options.hostExtraction ?? DEFAULT_CONSENSUS_CONFIG.hostExtraction;

	if (hostExtraction) {
		logger.debug("Using host extraction mode - returning raw reviews");
		return formatForHostExtraction(reviews, options.outputFormat ?? "markdown");
	}

	// API extraction mode - make additional LLM calls
	const extractionModel =
		options.extractionModel ?? DEFAULT_CONSENSUS_CONFIG.extractionModel;

	const consensusClient = new ConsensusClient(reviewClient, extractionModel);
	return buildConsensusReport(reviews, consensusClient, options);
}
