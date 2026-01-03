import { execSync } from "node:child_process";
import { z } from "zod";
import { logger } from "../logger";
import type { ReviewClient } from "../review-client";

const gitReviewSchemaObj = z.object({
	review_type: z
		.enum(["staged", "unstaged", "diff", "commit"])
		.optional()
		.describe(
			"Type of changes to review: 'staged' (git diff --cached), 'unstaged' (git diff), 'diff' (git diff main..HEAD), 'commit' (specific commit). Default: staged",
		),
	commit_hash: z
		.string()
		.optional()
		.describe("Commit hash to review (only used when review_type is 'commit')"),
	context: z
		.string()
		.optional()
		.describe("Additional context about the changes"),
});

export const gitReviewSchema = gitReviewSchemaObj.shape;

type GitReviewInput = z.infer<typeof gitReviewSchemaObj>;

/**
 * Get git diff output based on review type
 */
function getGitDiff(
	reviewType: string = "staged",
	commitHash?: string,
): string {
	try {
		let command: string;

		switch (reviewType) {
			case "staged":
				command = "git diff --cached";
				break;
			case "unstaged":
				command = "git diff";
				break;
			case "diff":
				command = "git diff main..HEAD";
				break;
			case "commit":
				if (!commitHash) {
					throw new Error(
						"commit_hash is required when review_type is 'commit'",
					);
				}
				command = `git show ${commitHash}`;
				break;
			default:
				command = "git diff --cached";
		}

		logger.debug("Executing git command", { command });
		const diff = execSync(command, {
			encoding: "utf-8",
			maxBuffer: 10 * 1024 * 1024, // 10MB
		});

		if (!diff || diff.trim().length === 0) {
			throw new Error(`No changes found for review type: ${reviewType}`);
		}

		return diff;
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		logger.error("Failed to get git diff", error);
		throw new Error(`Git command failed: ${message}`);
	}
}

/**
 * Review git changes using multiple AI models
 */
export async function handleGitReview(
	client: ReviewClient,
	models: string[],
	input: GitReviewInput,
): Promise<{
	results: ReturnType<ReviewClient["reviewCode"]> extends Promise<infer R>
		? R
		: never;
	models: string[];
	reviewType: string;
}> {
	const reviewType = input.review_type || "staged";

	logger.info("Running git review", {
		reviewType,
		commitHash: input.commit_hash,
		modelCount: models.length,
		models,
	});

	// Get git diff
	const diff = getGitDiff(reviewType, input.commit_hash);

	// Review the diff
	const results = await client.reviewCode(diff, models, input.context);

	return {
		results,
		models,
		reviewType,
	};
}
