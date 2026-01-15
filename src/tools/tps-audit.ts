/**
 * TPS Audit tool - Toyota Production System analysis for codebases
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { logger } from "../logger";
import type { TpsAnalysis } from "../prompts/tps-audit";
import type { ModelReviewResult, ReviewClient } from "../review-client";
import {
	aggregateFiles,
	createFileBatches,
	type ScanResult,
	scanRepository,
} from "../utils/repo-scanner";
import {
	formatResultsAsHtml,
	getTemplatesDir,
	type OutputFormat,
} from "./factory";

/**
 * Schema for TPS audit tool input
 */
const tpsAuditSchemaObj = z.object({
	path: z
		.string()
		.optional()
		.describe(
			"Path to repo root (auto-detects current directory if not provided)",
		),
	focus_areas: z
		.array(z.string())
		.optional()
		.describe("Specific areas to focus on (e.g., 'performance', 'security')"),
	max_files: z
		.number()
		.optional()
		.describe("Maximum files to analyze (default: 50)"),
	file_types: z
		.array(z.string())
		.optional()
		.describe("File extensions to include (e.g., ['.ts', '.js'])"),
	include_sensitive: z
		.boolean()
		.optional()
		.describe(
			"Include potentially sensitive files (default: false, use with caution)",
		),
	output_format: z
		.enum(["html", "markdown", "json"])
		.optional()
		.describe("Output format (default: html)"),
});

export const tpsAuditSchema = tpsAuditSchemaObj.shape;

type TpsAuditInput = z.infer<typeof tpsAuditSchemaObj>;

/**
 * Result type for TPS audit
 */
export interface TpsAuditResult {
	results: ModelReviewResult[];
	models: string[];
	scanResult: ScanResult;
	analysis: TpsAnalysis | null;
	outputFormat: OutputFormat;
}

/**
 * Token threshold for batching - use batching when content exceeds this
 */
const BATCH_TOKEN_THRESHOLD = 60000;

/**
 * Handle TPS audit request
 */
export async function handleTpsAudit(
	client: ReviewClient,
	models: string[],
	input: TpsAuditInput,
): Promise<TpsAuditResult> {
	const startPath = input.path || process.cwd();
	const outputFormat: OutputFormat = input.output_format || "html";

	logger.info("Starting TPS audit", {
		startPath,
		maxFiles: input.max_files,
		focusAreas: input.focus_areas,
		outputFormat,
		modelCount: models.length,
	});

	// Scan repository
	const scanResult = await scanRepository(startPath, {
		maxFiles: input.max_files,
		fileTypes: input.file_types,
		skipSensitive: !input.include_sensitive,
		detectSecrets: !input.include_sensitive,
	});

	// Check if we have files to analyze
	if (scanResult.files.length === 0) {
		logger.warn("No files found to analyze", {
			totalFilesFound: scanResult.stats.totalFilesFound,
			skipped: scanResult.skipped.length,
		});

		return {
			results: [
				{
					model: "system",
					review:
						"No files found to analyze. Check that the repository contains supported file types and that files are not excluded by .gitignore or security filters.",
				},
			],
			models: ["system"],
			scanResult,
			analysis: null,
			outputFormat,
		};
	}

	// Log warnings about sensitive files
	if (scanResult.warnings.length > 0) {
		logger.warn("Security warnings during scan", {
			warnings: scanResult.warnings,
		});
	}

	logger.info("Repository scanned", {
		filesIncluded: scanResult.files.length,
		totalSize: scanResult.stats.totalSize,
		tokenEstimate: scanResult.stats.tokenEstimate,
	});

	const repoName = scanResult.repoRoot.split("/").pop();

	// Decide whether to use batching based on token count
	const needsBatching = scanResult.stats.tokenEstimate > BATCH_TOKEN_THRESHOLD;

	let results: ModelReviewResult[];
	let analysis: TpsAnalysis | null = null;

	if (needsBatching) {
		// Use batch processing for large codebases
		logger.info("Using batch processing", {
			tokenEstimate: scanResult.stats.tokenEstimate,
			threshold: BATCH_TOKEN_THRESHOLD,
		});

		const batchResults = await handleBatchedTpsAudit(
			client,
			models,
			scanResult,
			input.focus_areas,
		);

		results = batchResults.results;
		analysis = batchResults.analysis;
	} else {
		// Single-pass processing for smaller codebases
		const aggregatedContent = aggregateFiles(scanResult.files);

		results = await client.tpsAudit(aggregatedContent, models, {
			focusAreas: input.focus_areas,
			repoName,
		});

		// Try to parse the first successful result for structured analysis
		for (const result of results) {
			if (!result.error && result.review) {
				const { parseTpsAnalysis } = await import("../prompts/tps-audit");
				analysis = parseTpsAnalysis(result.review);
				if (analysis) break;
			}
		}
	}

	return {
		results,
		models,
		scanResult,
		analysis,
		outputFormat,
	};
}

/**
 * Handle TPS audit with batching for large codebases
 * Each model analyzes ALL batches, then synthesizes their findings
 */
async function handleBatchedTpsAudit(
	client: ReviewClient,
	models: string[],
	scanResult: ScanResult,
	focusAreas?: string[],
): Promise<{ results: ModelReviewResult[]; analysis: TpsAnalysis | null }> {
	const { parseTpsAnalysis } = await import("../prompts/tps-audit");
	const repoName = scanResult.repoRoot.split("/").pop() ?? "unknown";

	// Create batches from files
	const batches = createFileBatches(scanResult.files);
	const batchContents = batches.map((batch) => ({
		content: aggregateFiles(batch.files),
		tokenEstimate: batch.tokenEstimate,
		batchIndex: batch.batchIndex,
	}));

	logger.info("Processing batches with all models", {
		batchCount: batches.length,
		modelCount: models.length,
		totalApiCalls: batches.length * models.length + models.length, // batches + synthesis per model
	});

	// Each model analyzes ALL batches, then synthesizes
	const modelResults = await Promise.all(
		models.map(async (model) => {
			// Analyze all batches with this model
			const batchAnalyses = await Promise.all(
				batchContents.map(async (batch) => {
					try {
						const response = await client.tpsAuditBatch(
							batch.content,
							model,
							batch.batchIndex,
							batches.length,
							{ focusAreas, repoName },
						);
						return {
							batchIndex: batch.batchIndex,
							tokenCount: batch.tokenEstimate,
							rawResponse: response,
							analysis: parseTpsAnalysis(response),
						};
					} catch (error) {
						logger.error("Batch analysis failed", error, {
							model,
							batchIndex: batch.batchIndex,
						});
						return {
							batchIndex: batch.batchIndex,
							tokenCount: batch.tokenEstimate,
							rawResponse:
								error instanceof Error ? error.message : "Unknown error",
							analysis: null,
						};
					}
				}),
			);

			const successfulBatches = batchAnalyses.filter(
				(b) => b.analysis !== null,
			);

			// Synthesize this model's batch results
			let finalAnalysis: TpsAnalysis | null = null;
			let finalResponse = "";

			if (batchAnalyses.length > 1 && successfulBatches.length > 0) {
				try {
					finalResponse = await client.tpsAuditSynthesize(
						batchAnalyses,
						model,
						repoName,
					);
					finalAnalysis = parseTpsAnalysis(finalResponse);
				} catch (error) {
					logger.error("Synthesis failed for model", error, { model });
					const first = successfulBatches[0];
					finalAnalysis = first?.analysis ?? null;
					finalResponse = first?.rawResponse ?? "";
				}
			} else if (successfulBatches.length === 1) {
				const first = successfulBatches[0];
				if (first) {
					finalAnalysis = first.analysis;
					finalResponse = first.rawResponse;
				}
			}

			return {
				model,
				review: finalResponse,
				analysis: finalAnalysis,
				error:
					finalAnalysis === null ? "Failed to produce analysis" : undefined,
			};
		}),
	);

	// Build results from all models
	const results: ModelReviewResult[] = modelResults.map((r) => ({
		model: r.model,
		review: r.review,
		error: r.error,
	}));

	// Use first successful analysis as the primary analysis for the report
	const firstSuccess = modelResults.find((r) => r.analysis !== null);

	logger.info("Batched TPS audit complete", {
		modelsUsed: models.length,
		batchesPerModel: batches.length,
		successfulModels: modelResults.filter((r) => r.analysis !== null).length,
	});

	return {
		results,
		analysis: firstSuccess?.analysis ?? null,
	};
}

/**
 * Write audit report to .code-council folder in the scanned repo
 */
function writeReportToFolder(
	repoRoot: string,
	content: string,
	format: OutputFormat,
): string | null {
	try {
		const outputDir = join(repoRoot, ".code-council");
		if (!existsSync(outputDir)) {
			mkdirSync(outputDir, { recursive: true });
		}

		const ext = format === "json" ? "json" : format === "html" ? "html" : "md";
		const filename = `tps-audit.${ext}`;
		const filepath = join(outputDir, filename);
		writeFileSync(filepath, content);

		logger.info("TPS audit report written", { filepath });
		return filepath;
	} catch (err) {
		logger.warn("Failed to write report to .code-council folder", {
			error: err instanceof Error ? err.message : String(err),
		});
		return null;
	}
}

/**
 * Format TPS audit results based on output format
 */
export function formatTpsAuditResults(auditResult: TpsAuditResult): string {
	const { results, scanResult, analysis, outputFormat } = auditResult;

	let content: string;

	switch (outputFormat) {
		case "html": {
			const templatePath = join(getTemplatesDir(), "tps-report.html");
			content = formatResultsAsHtml(results, templatePath, {
				analysis,
				repoName: scanResult.repoRoot.split("/").pop(),
			});
			break;
		}

		case "json": {
			content = JSON.stringify(
				{
					analysis,
					scanStats: scanResult.stats,
					warnings: scanResult.warnings,
					skipped: scanResult.skipped,
					modelResponses: results.map((r) => ({
						model: r.model,
						hasError: !!r.error,
						content: r.error || r.review,
					})),
				},
				null,
				2,
			);
			break;
		}

		case "markdown":
		default: {
			const parts: string[] = [];

			parts.push("# TPS Audit Report\n");
			parts.push(`**Repository:** ${scanResult.repoRoot}\n`);
			parts.push(`**Files Analyzed:** ${scanResult.files.length}\n`);
			parts.push(`**Token Estimate:** ~${scanResult.stats.tokenEstimate}\n`);

			if (scanResult.warnings.length > 0) {
				parts.push("\n## Warnings\n");
				for (const w of scanResult.warnings) {
					parts.push(`- ${w}\n`);
				}
			}

			if (analysis) {
				parts.push("\n## Scores\n");
				parts.push(`- **Overall:** ${analysis.scores.overall}/100\n`);
				parts.push(`- **Flow:** ${analysis.scores.flow}/100\n`);
				parts.push(`- **Waste Efficiency:** ${analysis.scores.waste}/100\n`);
				parts.push(`- **Quality:** ${analysis.scores.quality}/100\n`);

				parts.push("\n## Summary\n");
				parts.push("\n### Strengths\n");
				for (const s of analysis.summary.strengths) {
					parts.push(`- ${s}\n`);
				}
				parts.push("\n### Concerns\n");
				for (const c of analysis.summary.concerns) {
					parts.push(`- ${c}\n`);
				}
				parts.push("\n### Quick Wins\n");
				for (const q of analysis.summary.quickWins) {
					parts.push(`- ${q}\n`);
				}
			}

			parts.push("\n## Model Perspectives\n");
			for (const r of results) {
				if (r.error) {
					parts.push(`\n### ${r.model}\n\n**Error:** ${r.error}\n`);
				} else {
					parts.push(`\n### ${r.model}\n\n${r.review}\n`);
				}
				parts.push("\n---\n");
			}

			content = parts.join("");
			break;
		}
	}

	// Write report to .code-council folder in the scanned repository
	const filepath = writeReportToFolder(
		scanResult.repoRoot,
		content,
		outputFormat,
	);
	if (filepath) {
		// Prepend filepath info to content for user visibility
		const fileNote = `\n\n---\n**Report saved to:** \`${filepath}\`\n`;
		return content + fileNote;
	}

	return content;
}
