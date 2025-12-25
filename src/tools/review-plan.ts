/**
 * Plan review tool - reviews implementation plans before coding
 */

import { z } from "zod";
import { PLAN_REVIEW_MODELS } from "../config";
import { logger } from "../logger";
import type { ReviewClient } from "../review-client";

export const planReviewSchema = {
	plan: z.string().describe("The implementation plan to review"),
	review_type: z
		.enum(["feasibility", "completeness", "risks", "timeline", "full"])
		.optional()
		.describe("Type of review to perform (default: full)"),
	context: z
		.string()
		.optional()
		.describe("Additional context about the project or constraints"),
};

export async function handlePlanReview(
	client: ReviewClient,
	input: Record<string, unknown>,
) {
	const { plan, review_type, context } = input as {
		plan: string;
		review_type?:
			| "feasibility"
			| "completeness"
			| "risks"
			| "timeline"
			| "full";
		context?: string;
	};

	logger.info("Running plan review", {
		modelCount: PLAN_REVIEW_MODELS.length,
		models: PLAN_REVIEW_MODELS,
		reviewType: review_type || "full",
	});

	const results = await client.reviewPlan(plan, PLAN_REVIEW_MODELS, {
		reviewType: review_type,
		context,
	});

	return {
		results,
		models: PLAN_REVIEW_MODELS,
		reviewType: review_type || "full",
	};
}
