/**
 * Frontend review tool - reviews frontend code for accessibility, performance, UX
 */

import { z } from "zod";
import { getFrontendReviewModels } from "../config";
import { logger } from "../logger";
import type { ReviewClient } from "../review-client";

export const frontendReviewSchema = {
	code: z.string().describe("The frontend code to review"),
	framework: z
		.string()
		.optional()
		.describe("Frontend framework (e.g., react, vue, svelte)"),
	review_type: z
		.enum(["accessibility", "performance", "ux", "full"])
		.optional()
		.describe("Type of review to perform (default: full)"),
	context: z.string().optional().describe("Additional context"),
	output_format: z
		.enum(["markdown", "json", "html"])
		.optional()
		.describe("Output format for the review (default: markdown)"),
};

export async function handleFrontendReview(
	client: ReviewClient,
	input: Record<string, unknown>,
) {
	const { code, framework, review_type, context } = input as {
		code: string;
		framework?: string;
		review_type?: "accessibility" | "performance" | "ux" | "full";
		context?: string;
	};

	logger.info("Running frontend review", {
		modelCount: getFrontendReviewModels().length,
		models: getFrontendReviewModels(),
		framework,
		reviewType: review_type || "full",
	});

	const results = await client.reviewFrontend(code, getFrontendReviewModels(), {
		framework,
		reviewType: review_type,
		context,
	});

	return {
		results,
		models: getFrontendReviewModels(),
		reviewType: review_type || "full",
	};
}
