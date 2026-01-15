/**
 * TPS Audit tool - Toyota Production System analysis for codebases
 */

import { join } from "node:path";
import { z } from "zod";
import { logger } from "../logger";
import type { TpsAnalysis } from "../prompts/tps-audit";
import type { ModelReviewResult, ReviewClient } from "../review-client";
import {
	aggregateFiles,
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
		.max(100)
		.optional()
		.describe("Maximum files to analyze (default: 50, max: 100)"),
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

	// Aggregate files into single content string
	const aggregatedContent = aggregateFiles(scanResult.files);

	logger.info("Repository scanned", {
		filesIncluded: scanResult.files.length,
		totalSize: scanResult.stats.totalSize,
		tokenEstimate: scanResult.stats.tokenEstimate,
	});

	// Check token budget
	if (scanResult.stats.tokenEstimate > 100000) {
		logger.warn("Large token count", {
			estimate: scanResult.stats.tokenEstimate,
		});
	}

	// Call ReviewClient for TPS analysis
	const results = await client.tpsAudit(aggregatedContent, models, {
		focusAreas: input.focus_areas,
		repoName: scanResult.repoRoot.split("/").pop(),
	});

	// Try to parse the first successful result for structured analysis
	let analysis: TpsAnalysis | null = null;
	for (const result of results) {
		if (!result.error && result.review) {
			// Import parseTpsAnalysis dynamically to avoid circular deps
			const { parseTpsAnalysis } = await import("../prompts/tps-audit");
			analysis = parseTpsAnalysis(result.review);
			if (analysis) break;
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
 * Format TPS audit results based on output format
 */
export function formatTpsAuditResults(auditResult: TpsAuditResult): string {
	const { results, scanResult, analysis, outputFormat } = auditResult;

	switch (outputFormat) {
		case "html": {
			const templatePath = join(getTemplatesDir(), "tps-report.html");
			return formatResultsAsHtml(results, templatePath, {
				analysis,
				repoName: scanResult.repoRoot.split("/").pop(),
			});
		}

		case "json": {
			return JSON.stringify(
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
			results.forEach((r) => {
				if (r.error) {
					parts.push(`\n### ${r.model}\n\n**Error:** ${r.error}\n`);
				} else {
					parts.push(`\n### ${r.model}\n\n${r.review}\n`);
				}
				parts.push("\n---\n");
			});

			return parts.join("");
		}
	}
}
