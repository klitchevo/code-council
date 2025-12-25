/**
 * Code review tool - reviews code for quality, bugs, performance, and security
 */

import { z } from "zod";
import { CODE_REVIEW_MODELS } from "../config";
import { logger } from "../logger";
import type { ReviewClient } from "../review-client";

export const codeReviewSchema = {
	code: z.string().describe("The code to review"),
	language: z.string().optional().describe("Programming language of the code"),
	context: z.string().optional().describe("Additional context about the code"),
};

export async function handleCodeReview(
	client: ReviewClient,
	input: Record<string, unknown>,
) {
	const { code, language, context } = input as {
		code: string;
		language?: string;
		context?: string;
	};

	const fullContext = language
		? `Language: ${language}${context ? `\n${context}` : ""}`
		: context;

	logger.info("Running code review", {
		modelCount: CODE_REVIEW_MODELS.length,
		models: CODE_REVIEW_MODELS,
		hasLanguage: !!language,
		hasContext: !!context,
	});

	const results = await client.reviewCode(
		code,
		CODE_REVIEW_MODELS,
		fullContext,
	);

	return {
		results,
		models: CODE_REVIEW_MODELS,
	};
}
