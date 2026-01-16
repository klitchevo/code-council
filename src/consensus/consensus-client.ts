/**
 * ConsensusClient wraps ReviewClient to extract structured findings from reviews.
 * Follows SOLID principles by not modifying ReviewClient directly.
 */

import { ConsensusExtractionError } from "../errors";
import { logger } from "../logger";
import type {
	ChatMessage,
	ModelReviewResult,
	ReviewClient,
} from "../review-client";
import { extractAllFindings, extractFindings } from "./extractor";
import { normalizeFindings } from "./normalizer";
import type { Finding } from "./types";

/**
 * Client for extracting structured findings from multi-model reviews.
 * Uses an extraction model (default: claude-3-haiku) to parse free-form reviews.
 */
export class ConsensusClient {
	private extractionModel: string;

	/**
	 * Create a ConsensusClient
	 * @param reviewClient - The ReviewClient instance to use for LLM calls
	 * @param extractionModel - Model to use for extraction (default: claude-3-haiku)
	 */
	constructor(
		private reviewClient: ReviewClient,
		extractionModel: string = "anthropic/claude-3-haiku",
	) {
		this.extractionModel = extractionModel;
	}

	/**
	 * Send a chat request using the extraction model
	 */
	private async chat(
		systemPrompt: string,
		userMessage: string,
	): Promise<string> {
		const messages: ChatMessage[] = [
			{ role: "system", content: systemPrompt },
			{ role: "user", content: userMessage },
		];

		// Use chatMultiTurn since that's what ReviewClient exposes for arbitrary messages
		return this.reviewClient.chatMultiTurn(this.extractionModel, messages);
	}

	/**
	 * Extract findings from a single model's review
	 * @param review - The review result to extract from
	 * @returns Array of normalized findings
	 */
	async extractFindings(review: ModelReviewResult): Promise<Finding[]> {
		if (review.error || !review.review) {
			logger.debug("Skipping review with error or empty content", {
				model: review.model,
				hasError: !!review.error,
			});
			return [];
		}

		try {
			const findings = await extractFindings(
				review.review,
				review.model,
				(systemPrompt, userMessage) => this.chat(systemPrompt, userMessage),
			);

			return normalizeFindings(findings);
		} catch (error) {
			if (error instanceof ConsensusExtractionError) {
				throw error;
			}
			const message = error instanceof Error ? error.message : "Unknown error";
			throw new ConsensusExtractionError(message, review.model, true);
		}
	}

	/**
	 * Extract findings from multiple reviews in parallel
	 * @param reviews - Array of review results to extract from
	 * @returns Map of model name to extracted findings, plus any errors
	 */
	async extractAllFindings(reviews: ModelReviewResult[]): Promise<{
		findings: Map<string, Finding[]>;
		errors: Array<{ model: string; error: string }>;
		totalFindings: number;
	}> {
		const { results, errors } = await extractAllFindings(
			reviews,
			(systemPrompt, userMessage) => this.chat(systemPrompt, userMessage),
		);

		// Normalize all findings
		const normalizedResults = new Map<string, Finding[]>();
		let totalFindings = 0;

		for (const [model, findings] of results) {
			const normalized = normalizeFindings(findings);
			normalizedResults.set(model, normalized);
			totalFindings += normalized.length;
		}

		logger.debug("Extraction complete", {
			models: reviews.length,
			totalFindings,
			errors: errors.length,
		});

		return {
			findings: normalizedResults,
			errors,
			totalFindings,
		};
	}

	/**
	 * Get all findings as a flat array (for clustering)
	 */
	async getAllFindingsFlat(reviews: ModelReviewResult[]): Promise<{
		findings: Finding[];
		errors: Array<{ model: string; error: string }>;
	}> {
		const { findings: findingsMap, errors } =
			await this.extractAllFindings(reviews);

		const allFindings: Finding[] = [];
		for (const findings of findingsMap.values()) {
			allFindings.push(...findings);
		}

		return { findings: allFindings, errors };
	}

	/**
	 * Get the extraction model being used
	 */
	getExtractionModel(): string {
		return this.extractionModel;
	}

	/**
	 * Set a new extraction model
	 */
	setExtractionModel(model: string): void {
		this.extractionModel = model;
	}
}
