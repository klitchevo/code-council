/**
 * Extracts structured findings from free-form model reviews.
 * Uses LLM to parse review text into Finding objects.
 * Supports both YAML (preferred) and JSON output formats.
 */

import { ConsensusExtractionError } from "../errors";
import { logger } from "../logger";
import * as consensusPrompts from "../prompts/consensus";
import { ExtractionResponseSchema } from "../schemas/consensus";
import type { Finding, FindingId } from "./types";
import { toFindingId } from "./types";
import { parseExtractionYaml } from "./yaml-parser";

/**
 * Result of extracting findings from a single review
 */
export interface ExtractionResult {
	/** The model that produced the original review */
	sourceModel: string;
	/** Successfully extracted findings */
	findings: Finding[];
	/** Error message if extraction failed */
	error?: string;
}

/**
 * Generate a unique finding ID
 */
function generateFindingId(): FindingId {
	const timestamp = Date.now().toString(36);
	const random = Math.random().toString(36).substring(2, 8);
	return toFindingId(`finding-${timestamp}-${random}`);
}

/**
 * Attempt to repair common JSON issues from LLM output
 */
function repairJson(jsonStr: string): string {
	let repaired = jsonStr;

	// Fix bad escape sequences (e.g., \' which is invalid in JSON)
	// Replace invalid escapes with their unescaped version or valid alternatives
	repaired = repaired.replace(/\\'/g, "'");
	repaired = repaired.replace(/\\`/g, "`");

	// Fix unescaped control characters in strings
	// Replace literal newlines/tabs inside strings with escaped versions
	repaired = repaired.replace(/"([^"]*?)"/g, (_, content) => {
		const fixed = content
			.replace(/\n/g, "\\n")
			.replace(/\r/g, "\\r")
			.replace(/\t/g, "\\t");
		return `"${fixed}"`;
	});

	// Remove trailing commas before } or ]
	repaired = repaired.replace(/,(\s*[}\]])/g, "$1");

	// Strip suggestedCode fields entirely - they cause too many JSON issues
	// Match "suggestedCode": "..." or "suggestedCode": null
	repaired = repaired.replace(
		/"suggestedCode"\s*:\s*(?:"(?:[^"\\]|\\.)*"|null)\s*,?/g,
		"",
	);

	// Clean up any double commas or trailing commas we may have created
	repaired = repaired.replace(/,\s*,/g, ",");
	repaired = repaired.replace(/,(\s*[}\]])/g, "$1");

	return repaired;
}

/**
 * Parse the LLM extraction response into findings.
 * Uses YAML-first parsing with progressive fallbacks, then JSON as final fallback.
 */
export function parseExtractionResponse(
	responseText: string,
	sourceModel: string,
): Finding[] {
	// Try YAML parsing first (with all fallback strategies)
	let raw: unknown;
	try {
		raw = parseExtractionYaml(responseText);
		logger.debug("Parsed extraction response via YAML parser", { sourceModel });
	} catch (yamlError) {
		// YAML failed, try legacy JSON repair as last resort
		logger.debug("YAML parsing failed, trying JSON repair", {
			sourceModel,
			error: yamlError instanceof Error ? yamlError.message : "Unknown",
		});

		let jsonStr = responseText.trim();

		// Strip markdown
		if (jsonStr.startsWith("```json")) {
			jsonStr = jsonStr.slice(7);
		} else if (jsonStr.startsWith("```yaml")) {
			jsonStr = jsonStr.slice(7);
		} else if (jsonStr.startsWith("```")) {
			jsonStr = jsonStr.slice(3);
		}
		if (jsonStr.endsWith("```")) {
			jsonStr = jsonStr.slice(0, -3);
		}
		jsonStr = jsonStr.trim();

		// Try JSON repair
		jsonStr = repairJson(jsonStr);
		raw = JSON.parse(jsonStr);
	}

	// Validate with Zod
	const parsed = ExtractionResponseSchema.parse(raw);

	// Transform to Finding objects (convert nulls to undefined)
	const now = new Date().toISOString();
	return parsed.findings.map(
		(f): Finding => ({
			id: generateFindingId(),
			sourceModel,
			category: f.category,
			severity: f.severity,
			title: f.title,
			description: f.description,
			location: f.location
				? {
						file: f.location.file,
						line: f.location.line ?? undefined,
						endLine: f.location.endLine ?? undefined,
					}
				: undefined,
			suggestion: f.suggestion ?? undefined,
			suggestedCode: f.suggestedCode ?? undefined,
			rawExcerpt: f.rawExcerpt ?? undefined,
			extractedAt: now,
			confidence: f.confidence ?? undefined,
		}),
	);
}

/**
 * Extract findings from a single review using the provided chat function
 * @param reviewText - The raw review text from a model
 * @param sourceModel - The model that produced the review
 * @param chatFn - Function to send chat requests (from ConsensusClient)
 * @returns Array of extracted findings
 */
export async function extractFindings(
	reviewText: string,
	sourceModel: string,
	chatFn: (systemPrompt: string, userMessage: string) => Promise<string>,
): Promise<Finding[]> {
	// Skip empty reviews or reviews with only whitespace
	if (!reviewText || !reviewText.trim()) {
		logger.debug("Skipping empty review", { sourceModel });
		return [];
	}

	// Skip reviews that are just praise with no issues
	const lowerText = reviewText.toLowerCase();
	const isPraiseOnly =
		(lowerText.includes("looks good") ||
			lowerText.includes("no issues") ||
			lowerText.includes("well done") ||
			lowerText.includes("clean code")) &&
		!lowerText.includes("critical") &&
		!lowerText.includes("high") &&
		!lowerText.includes("medium") &&
		!lowerText.includes("bug") &&
		!lowerText.includes("security") &&
		!lowerText.includes("vulnerability");

	if (isPraiseOnly && reviewText.length < 200) {
		logger.debug("Skipping praise-only review", { sourceModel });
		return [];
	}

	const userMessage = consensusPrompts.buildExtractionUserMessage(
		reviewText,
		sourceModel,
	);

	try {
		logger.debug("Extracting findings", {
			sourceModel,
			reviewLength: reviewText.length,
		});

		const response = await chatFn(
			consensusPrompts.EXTRACTION_SYSTEM_PROMPT,
			userMessage,
		);

		const findings = parseExtractionResponse(response, sourceModel);

		logger.debug("Extracted findings", {
			sourceModel,
			count: findings.length,
		});

		return findings;
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		logger.error("Finding extraction failed", error, { sourceModel });
		throw new ConsensusExtractionError(message, sourceModel, true);
	}
}

/**
 * Extract findings from multiple reviews in parallel
 * @param reviews - Array of review results to extract from
 * @param chatFn - Function to send chat requests
 * @returns Map of model name to extracted findings
 */
export async function extractAllFindings(
	reviews: Array<{ model: string; review: string; error?: string }>,
	chatFn: (systemPrompt: string, userMessage: string) => Promise<string>,
): Promise<{
	results: Map<string, Finding[]>;
	errors: Array<{ model: string; error: string }>;
}> {
	const results = new Map<string, Finding[]>();
	const errors: Array<{ model: string; error: string }> = [];

	// Filter out reviews with errors
	const validReviews = reviews.filter((r) => !r.error && r.review);

	// Process in parallel
	const promises = validReviews.map(async (review) => {
		try {
			const findings = await extractFindings(
				review.review,
				review.model,
				chatFn,
			);
			return { model: review.model, findings, error: undefined };
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			return { model: review.model, findings: [] as Finding[], error: message };
		}
	});

	const extractionResults = await Promise.all(promises);

	// Separate successes and failures
	for (const result of extractionResults) {
		if (result.error) {
			errors.push({ model: result.model, error: result.error });
		}
		results.set(result.model, result.findings);
	}

	// Also record reviews that had errors from the original call
	for (const review of reviews) {
		if (review.error) {
			errors.push({ model: review.model, error: review.error });
			results.set(review.model, []);
		}
	}

	logger.debug("Extraction complete", {
		totalModels: reviews.length,
		successful: results.size - errors.length,
		failed: errors.length,
	});

	return { results, errors };
}
