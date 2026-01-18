/**
 * Backend review tool - reviews backend code for security, performance, architecture
 */

import { z } from "zod";
import { getBackendReviewModels } from "../config";
import { logger } from "../logger";
import type { ReviewClient } from "../review-client";

export const backendReviewSchema = {
	code: z.string().describe("The backend code to review"),
	language: z
		.string()
		.optional()
		.describe("Programming language/framework (e.g., node, python, go, rust)"),
	review_type: z
		.enum(["security", "performance", "architecture", "full"])
		.optional()
		.describe("Type of review to perform (default: full)"),
	context: z.string().optional().describe("Additional context"),
	output_format: z
		.enum(["markdown", "json", "html"])
		.optional()
		.describe("Output format for the review (default: markdown)"),
};

export async function handleBackendReview(
	client: ReviewClient,
	input: Record<string, unknown>,
) {
	const { code, language, review_type, context } = input as {
		code: string;
		language?: string;
		review_type?: "security" | "performance" | "architecture" | "full";
		context?: string;
	};

	logger.info("Running backend review", {
		modelCount: getBackendReviewModels().length,
		models: getBackendReviewModels(),
		language,
		reviewType: review_type || "full",
	});

	const results = await client.reviewBackend(code, getBackendReviewModels(), {
		language,
		reviewType: review_type,
		context,
	});

	return {
		results,
		models: getBackendReviewModels(),
		reviewType: review_type || "full",
	};
}
