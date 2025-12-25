import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewClient } from "../review-client.js";
import { codeReviewSchema, handleCodeReview } from "./review-code.js";

vi.mock("../logger", () => ({
	logger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

vi.mock("../config", () => ({
	CODE_REVIEW_MODELS: ["model1", "model2"],
}));

describe("review-code tool", () => {
	let mockClient: Pick<ReviewClient, "reviewCode"> & Partial<ReviewClient>;

	beforeEach(() => {
		vi.clearAllMocks();
		mockClient = {
			reviewCode: vi.fn().mockResolvedValue([
				{ model: "model1", review: "Good code" },
				{ model: "model2", review: "Looks fine" },
			]),
		} as Pick<ReviewClient, "reviewCode"> & Partial<ReviewClient>;
	});

	describe("codeReviewSchema", () => {
		it("should have required code field", () => {
			expect(codeReviewSchema.code).toBeDefined();
		});

		it("should have optional language field", () => {
			expect(codeReviewSchema.language).toBeDefined();
		});

		it("should have optional context field", () => {
			expect(codeReviewSchema.context).toBeDefined();
		});
	});

	describe("handleCodeReview", () => {
		it("should review code with minimal input", async () => {
			const result = await handleCodeReview(mockClient as ReviewClient, {
				code: "const x = 1;",
			});

			expect(mockClient.reviewCode).toHaveBeenCalledWith(
				"const x = 1;",
				["model1", "model2"],
				undefined,
			);
			expect(result.results).toHaveLength(2);
			expect(result.models).toEqual(["model1", "model2"]);
		});

		it("should include language in context", async () => {
			await handleCodeReview(mockClient as ReviewClient, {
				code: "const x = 1;",
				language: "typescript",
			});

			expect(mockClient.reviewCode).toHaveBeenCalledWith(
				"const x = 1;",
				["model1", "model2"],
				"Language: typescript",
			);
		});

		it("should include additional context", async () => {
			await handleCodeReview(mockClient as ReviewClient, {
				code: "const x = 1;",
				context: "This is a test",
			});

			expect(mockClient.reviewCode).toHaveBeenCalledWith(
				"const x = 1;",
				["model1", "model2"],
				"This is a test",
			);
		});

		it("should combine language and context", async () => {
			await handleCodeReview(mockClient as ReviewClient, {
				code: "const x = 1;",
				language: "typescript",
				context: "This is a test",
			});

			expect(mockClient.reviewCode).toHaveBeenCalledWith(
				"const x = 1;",
				["model1", "model2"],
				"Language: typescript\nThis is a test",
			);
		});
	});
});
