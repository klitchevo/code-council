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
	output_format: z
		.enum(["markdown", "json", "html", "pr-comments"])
		.optional()
		.describe("Output format for the review (default: markdown)"),
});

export const gitReviewSchema = gitReviewSchemaObj.shape;

type GitReviewInput = z.infer<typeof gitReviewSchemaObj>;

/**
 * Get the base ref for diff comparison
 * In GitHub Actions PR context, uses GITHUB_BASE_REF
 * Falls back to trying main, then origin/main
 */
function getBaseRef(): string {
	// GitHub Actions sets GITHUB_BASE_REF for pull requests
	const githubBaseRef = process.env.GITHUB_BASE_REF;
	if (githubBaseRef) {
		logger.debug("Using GITHUB_BASE_REF", { ref: githubBaseRef });
		return `origin/${githubBaseRef}`;
	}

	// Try local main first
	try {
		execSync("git rev-parse --verify main", {
			encoding: "utf-8",
			stdio: "pipe",
		});
		return "main";
	} catch {
		// Try origin/main
		try {
			execSync("git rev-parse --verify origin/main", {
				encoding: "utf-8",
				stdio: "pipe",
			});
			return "origin/main";
		} catch {
			// Fall back to main and let it fail with a clear error
			return "main";
		}
	}
}

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
			case "diff": {
				const baseRef = getBaseRef();
				command = `git diff ${baseRef}..HEAD`;
				break;
			}
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
	diffText: string;
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
		diffText: diff,
	};
}
