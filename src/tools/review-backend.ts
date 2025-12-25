/**
 * Backend review tool - reviews backend code for security, performance, architecture
 */

import { z } from "zod";
import { BACKEND_REVIEW_MODELS } from "../config";
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
		modelCount: BACKEND_REVIEW_MODELS.length,
		models: BACKEND_REVIEW_MODELS,
		language,
		reviewType: review_type || "full",
	});

	const results = await client.reviewBackend(code, BACKEND_REVIEW_MODELS, {
		language,
		reviewType: review_type,
		context,
	});

	return {
		results,
		models: BACKEND_REVIEW_MODELS,
		reviewType: review_type || "full",
	};
}
