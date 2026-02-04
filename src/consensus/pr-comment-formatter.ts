/**
 * Formats consensus findings as GitHub PR review comments.
 * Outputs JSON compatible with the GitHub Reviews API.
 */

import type { MappingResult } from "./comment-mapper";
import type { ConsensusReport, FindingCluster } from "./types";

/**
 * A single inline comment for the GitHub API
 */
export interface GitHubPrComment {
	readonly path: string;
	readonly line: number;
	readonly body: string;
}

/**
 * Complete PR review payload for GitHub API
 * POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews
 */
export interface GitHubPrReview {
	/** Summary body with overall review and unmapped findings */
	readonly body: string;
	/** Review action: COMMENT, APPROVE, REQUEST_CHANGES */
	readonly event: "COMMENT" | "APPROVE" | "REQUEST_CHANGES";
	/** Inline comments on specific lines */
	readonly comments: readonly GitHubPrComment[];
}

/**
 * Format options for PR comments
 */
export interface FormatOptions {
	/** Maximum number of inline comments (GitHub limits to ~60 per review) */
	readonly maxComments?: number;
	/** Include low/info severity findings as inline comments */
	readonly includeLowSeverity?: boolean;
	/** Add model agreement info to comments */
	readonly showModelAgreement?: boolean;
	/** Minimum confidence threshold for inline comments (0-1, default 0.5 = 50%) */
	readonly minConfidence?: number;
}

const DEFAULT_OPTIONS: Required<FormatOptions> = {
	maxComments: 30,
	includeLowSeverity: false,
	showModelAgreement: true,
	minConfidence: 0.5,
};

/**
 * Format severity as a badge/label
 */
function formatSeverity(severity: string): string {
	const badges: Record<string, string> = {
		critical: "CRITICAL",
		high: "HIGH",
		medium: "MEDIUM",
		low: "LOW",
		info: "INFO",
	};
	return badges[severity] ?? severity.toUpperCase();
}

/**
 * Format category for display
 */
function formatCategory(category: string): string {
	return category
		.split("_")
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ");
}

/**
 * Extract model name from full path (strips provider prefix)
 * e.g., "google/gemini-3-pro-preview" → "gemini-3-pro-preview"
 */
function formatModelName(fullName: string): string {
	const slashIndex = fullName.indexOf("/");
	if (slashIndex !== -1) {
		return fullName.slice(slashIndex + 1);
	}
	return fullName;
}

/**
 * Format model agreement as a string with model names
 */
function formatModelAgreement(
	cluster: FindingCluster,
	totalModels: number,
): string {
	const agreeing = cluster.agreeingModels.length;
	const confidence = Math.round(cluster.confidence * 100);
	const modelNames = cluster.agreeingModels.map(formatModelName).join(", ");

	return `Found by: ${modelNames} (${agreeing}/${totalModels}) | ${confidence}% confidence`;
}

/**
 * Format a single cluster as a comment body
 */
function formatCommentBody(
	cluster: FindingCluster,
	showModelAgreement: boolean,
	totalModels: number,
): string {
	const lines: string[] = [];

	// Title with severity and category
	lines.push(
		`**[${formatSeverity(cluster.severity)}] ${cluster.title}** (${formatCategory(cluster.category)})`,
	);
	lines.push("");

	// Model agreement info
	if (showModelAgreement) {
		lines.push(formatModelAgreement(cluster, totalModels));
		lines.push("");
	}

	// Description from first finding
	const firstFinding = cluster.findings[0];
	if (firstFinding?.description) {
		lines.push(firstFinding.description);
		lines.push("");
	}

	// Suggestion from first finding - prefer suggestedCode for GitHub apply button
	if (firstFinding?.suggestedCode) {
		lines.push("```suggestion");
		lines.push(firstFinding.suggestedCode);
		lines.push("```");
	} else if (firstFinding?.suggestion) {
		lines.push(`**Suggestion:** ${firstFinding.suggestion}`);
	}

	return lines.join("\n").trim();
}

/**
 * Format unmapped findings for the summary body
 */
function formatUnmappedFindings(clusters: readonly FindingCluster[]): string {
	if (clusters.length === 0) {
		return "";
	}

	const lines: string[] = [];
	lines.push("### Additional Findings");
	lines.push("");
	lines.push(
		"The following findings could not be mapped to specific changed lines:",
	);
	lines.push("");

	for (const cluster of clusters) {
		const location = cluster.canonicalLocation
			? ` (${cluster.canonicalLocation.file}${cluster.canonicalLocation.line ? `:${cluster.canonicalLocation.line}` : ""})`
			: "";

		lines.push(
			`- **[${formatSeverity(cluster.severity)}]** ${cluster.title}${location}`,
		);

		const clusterFirstFinding = cluster.findings[0];
		if (clusterFirstFinding?.description) {
			lines.push(`  ${clusterFirstFinding.description}`);
		}
	}

	return lines.join("\n");
}

/**
 * Format the review summary body
 */
function formatSummaryBody(
	report: ConsensusReport,
	mappingResult: MappingResult,
	inlineCommentCount: number,
): string {
	const lines: string[] = [];

	// Header
	lines.push("## Code Council Multi-Model Review");
	lines.push("");

	// Stats
	const totalFindings =
		report.highConfidence.length +
		report.moderateConfidence.length +
		report.lowConfidence.length;

	const modelNames = report.participatingModels.map(formatModelName).join(", ");
	lines.push(
		`**${report.participatingModels.length} models** participated: ${modelNames}`,
	);
	lines.push(`**${totalFindings} findings** total`);
	lines.push(`**${inlineCommentCount} inline comments** on changed lines`);
	lines.push(
		`**${mappingResult.unmapped.length} findings** in summary (not on changed lines)`,
	);
	lines.push("");

	// Confidence breakdown
	if (report.highConfidence.length > 0) {
		lines.push(`- High confidence: ${report.highConfidence.length} findings`);
	}
	if (report.moderateConfidence.length > 0) {
		lines.push(
			`- Moderate confidence: ${report.moderateConfidence.length} findings`,
		);
	}
	if (report.lowConfidence.length > 0) {
		lines.push(`- Low confidence: ${report.lowConfidence.length} findings`);
	}

	// Disagreements
	if (report.disagreements.length > 0) {
		lines.push("");
		lines.push(`### Disagreements (${report.disagreements.length})`);
		lines.push("");
		for (const disagreement of report.disagreements) {
			lines.push(
				`- **${disagreement.topic}** (${formatCategory(disagreement.category)})`,
			);
			for (const position of disagreement.positions) {
				lines.push(`  - ${position.model}: ${position.stance}`);
			}
		}
	}

	// Unmapped findings
	if (mappingResult.unmapped.length > 0) {
		lines.push("");
		lines.push(formatUnmappedFindings(mappingResult.unmapped));
	}

	// Footer
	lines.push("");
	lines.push("---");
	lines.push(
		"*Reviewed by [Code Council](https://github.com/klitchevo/code-council) using multiple AI models*",
	);

	return lines.join("\n");
}

/**
 * Format consensus findings as a GitHub PR review.
 *
 * @param report - The consensus report with findings
 * @param mappingResult - Result from mapping clusters to diff positions
 * @param options - Formatting options
 * @returns GitHub PR review payload ready for the API
 */
export function formatPrComments(
	report: ConsensusReport,
	mappingResult: MappingResult,
	options: FormatOptions = {},
): GitHubPrReview {
	const opts = { ...DEFAULT_OPTIONS, ...options };

	// Filter and limit comments
	let commentsToInclude = [...mappingResult.comments];

	// Filter out low severity if not included
	if (!opts.includeLowSeverity) {
		commentsToInclude = commentsToInclude.filter(
			(c) => c.cluster.severity !== "low" && c.cluster.severity !== "info",
		);
	}

	// Filter by minimum confidence threshold
	if (opts.minConfidence > 0) {
		commentsToInclude = commentsToInclude.filter(
			(c) => c.cluster.confidence >= opts.minConfidence,
		);
	}

	// Sort by severity (critical first), then by line number
	const severityOrder = ["critical", "high", "medium", "low", "info"];
	commentsToInclude.sort((a, b) => {
		const severityDiff =
			severityOrder.indexOf(a.cluster.severity) -
			severityOrder.indexOf(b.cluster.severity);
		if (severityDiff !== 0) return severityDiff;
		return a.line - b.line;
	});

	// Limit to max comments
	if (commentsToInclude.length > opts.maxComments) {
		commentsToInclude = commentsToInclude.slice(0, opts.maxComments);
	}

	// Format inline comments
	const totalModels = report.participatingModels.length;
	const comments: GitHubPrComment[] = commentsToInclude.map((mapped) => ({
		path: mapped.path,
		line: mapped.line,
		body: formatCommentBody(
			mapped.cluster,
			opts.showModelAgreement,
			totalModels,
		),
	}));

	// Format summary body
	const body = formatSummaryBody(report, mappingResult, comments.length);

	return {
		body,
		event: "COMMENT",
		comments,
	};
}

/**
 * Serialize the PR review to JSON string
 */
export function serializePrReview(review: GitHubPrReview): string {
	return JSON.stringify(review, null, 2);
}
