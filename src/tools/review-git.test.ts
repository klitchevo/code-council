import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewClient } from "../review-client.js";
import { gitReviewSchema, handleGitReview } from "./review-git.js";

vi.mock("node:child_process", () => ({
	execSync: vi.fn(),
}));

vi.mock("../logger", () => ({
	logger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

import { execSync } from "node:child_process";

const mockExecSync = vi.mocked(execSync);

describe("review-git tool", () => {
	let mockClient: Pick<ReviewClient, "reviewCode"> & Partial<ReviewClient>;

	beforeEach(() => {
		vi.clearAllMocks();
		mockClient = {
			reviewCode: vi.fn().mockResolvedValue([
				{ model: "model1", review: "Good changes" },
				{ model: "model2", review: "Looks fine" },
			]),
		} as Pick<ReviewClient, "reviewCode"> & Partial<ReviewClient>;
	});

	describe("gitReviewSchema", () => {
		it("should have optional review_type field", () => {
			expect(gitReviewSchema.review_type).toBeDefined();
		});

		it("should have optional commit_hash field", () => {
			expect(gitReviewSchema.commit_hash).toBeDefined();
		});

		it("should have optional context field", () => {
			expect(gitReviewSchema.context).toBeDefined();
		});
	});

	describe("handleGitReview", () => {
		it("should review staged changes by default", async () => {
			mockExecSync.mockReturnValue("diff --git a/file.ts\n+added line");

			const result = await handleGitReview(
				mockClient as ReviewClient,
				["model1", "model2"],
				{},
			);

			expect(mockExecSync).toHaveBeenCalledWith("git diff --cached", {
				encoding: "utf-8",
				maxBuffer: 10 * 1024 * 1024,
			});
			expect(mockClient.reviewCode).toHaveBeenCalledWith(
				"diff --git a/file.ts\n+added line",
				["model1", "model2"],
				undefined,
			);
			expect(result.results).toHaveLength(2);
			expect(result.models).toEqual(["model1", "model2"]);
			expect(result.reviewType).toBe("staged");
		});

		it("should review staged changes when explicitly specified", async () => {
			mockExecSync.mockReturnValue("diff content");

			await handleGitReview(mockClient as ReviewClient, ["model1"], {
				review_type: "staged",
			});

			expect(mockExecSync).toHaveBeenCalledWith("git diff --cached", {
				encoding: "utf-8",
				maxBuffer: 10 * 1024 * 1024,
			});
		});

		it("should review unstaged changes", async () => {
			mockExecSync.mockReturnValue("unstaged diff content");

			const result = await handleGitReview(
				mockClient as ReviewClient,
				["model1"],
				{
					review_type: "unstaged",
				},
			);

			expect(mockExecSync).toHaveBeenCalledWith("git diff", {
				encoding: "utf-8",
				maxBuffer: 10 * 1024 * 1024,
			});
			expect(result.reviewType).toBe("unstaged");
		});

		it("should review branch diff", async () => {
			mockExecSync.mockReturnValue("branch diff content");

			const result = await handleGitReview(
				mockClient as ReviewClient,
				["model1"],
				{
					review_type: "diff",
				},
			);

			expect(mockExecSync).toHaveBeenCalledWith("git diff main..HEAD", {
				encoding: "utf-8",
				maxBuffer: 10 * 1024 * 1024,
			});
			expect(result.reviewType).toBe("diff");
		});

		it("should review specific commit", async () => {
			mockExecSync.mockReturnValue("commit diff content");

			const result = await handleGitReview(
				mockClient as ReviewClient,
				["model1"],
				{
					review_type: "commit",
					commit_hash: "abc123",
				},
			);

			expect(mockExecSync).toHaveBeenCalledWith("git show abc123", {
				encoding: "utf-8",
				maxBuffer: 10 * 1024 * 1024,
			});
			expect(result.reviewType).toBe("commit");
		});

		it("should throw error when commit review type is used without commit_hash", async () => {
			mockExecSync.mockImplementation(() => {
				throw new Error("commit_hash is required when review_type is 'commit'");
			});

			await expect(
				handleGitReview(mockClient as ReviewClient, ["model1"], {
					review_type: "commit",
				}),
			).rejects.toThrow("Git command failed:");
		});

		it("should throw error when no changes are found", async () => {
			mockExecSync.mockReturnValue("");

			await expect(
				handleGitReview(mockClient as ReviewClient, ["model1"], {}),
			).rejects.toThrow(
				"Git command failed: No changes found for review type: staged",
			);
		});

		it("should throw error when only whitespace is returned", async () => {
			mockExecSync.mockReturnValue("   \n\t  ");

			await expect(
				handleGitReview(mockClient as ReviewClient, ["model1"], {}),
			).rejects.toThrow(
				"Git command failed: No changes found for review type: staged",
			);
		});

		it("should pass context to reviewCode", async () => {
			mockExecSync.mockReturnValue("diff content");

			await handleGitReview(mockClient as ReviewClient, ["model1"], {
				context: "This fixes the login bug",
			});

			expect(mockClient.reviewCode).toHaveBeenCalledWith(
				"diff content",
				["model1"],
				"This fixes the login bug",
			);
		});

		it("should handle git command execution errors", async () => {
			mockExecSync.mockImplementation(() => {
				throw new Error("fatal: not a git repository");
			});

			await expect(
				handleGitReview(mockClient as ReviewClient, ["model1"], {}),
			).rejects.toThrow("Git command failed: fatal: not a git repository");
		});

		it("should handle non-Error exceptions", async () => {
			mockExecSync.mockImplementation(() => {
				throw "string error";
			});

			await expect(
				handleGitReview(mockClient as ReviewClient, ["model1"], {}),
			).rejects.toThrow("Git command failed: Unknown error");
		});

		it("should use default command for unknown review type", async () => {
			mockExecSync.mockReturnValue("diff content");

			// Force an unknown review type by casting
			const result = await handleGitReview(
				mockClient as ReviewClient,
				["model1"],
				{
					review_type: "unknown" as "staged",
				},
			);

			expect(mockExecSync).toHaveBeenCalledWith("git diff --cached", {
				encoding: "utf-8",
				maxBuffer: 10 * 1024 * 1024,
			});
			expect(result.reviewType).toBe("unknown");
		});
	});
});
