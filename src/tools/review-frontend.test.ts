import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewClient } from "../review-client.js";
import {
	frontendReviewSchema,
	handleFrontendReview,
} from "./review-frontend.js";

vi.mock("../logger", () => ({
	logger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

vi.mock("../config", () => ({
	FRONTEND_REVIEW_MODELS: ["model1", "model2"],
}));

describe("review-frontend tool", () => {
	let mockClient: Pick<ReviewClient, "reviewFrontend"> & Partial<ReviewClient>;

	beforeEach(() => {
		vi.clearAllMocks();
		mockClient = {
			reviewFrontend: vi.fn().mockResolvedValue([
				{ model: "model1", review: "Good accessibility" },
				{ model: "model2", review: "Performance ok" },
			]),
		} as Pick<ReviewClient, "reviewFrontend"> & Partial<ReviewClient>;
	});

	describe("frontendReviewSchema", () => {
		it("should have required code field", () => {
			expect(frontendReviewSchema.code).toBeDefined();
		});

		it("should have optional framework field", () => {
			expect(frontendReviewSchema.framework).toBeDefined();
		});

		it("should have optional review_type field", () => {
			expect(frontendReviewSchema.review_type).toBeDefined();
		});

		it("should have optional context field", () => {
			expect(frontendReviewSchema.context).toBeDefined();
		});
	});

	describe("handleFrontendReview", () => {
		it("should review frontend code with minimal input", async () => {
			const result = await handleFrontendReview(mockClient as ReviewClient, {
				code: "<button>Click</button>",
			});

			expect(mockClient.reviewFrontend).toHaveBeenCalledWith(
				"<button>Click</button>",
				["model1", "model2"],
				{
					framework: undefined,
					reviewType: undefined,
					context: undefined,
				},
			);
			expect(result.results).toHaveLength(2);
			expect(result.models).toEqual(["model1", "model2"]);
			expect(result.reviewType).toBe("full");
		});

		it("should include framework option", async () => {
			await handleFrontendReview(mockClient as ReviewClient, {
				code: "<button>Click</button>",
				framework: "react",
			});

			expect(mockClient.reviewFrontend).toHaveBeenCalledWith(
				"<button>Click</button>",
				["model1", "model2"],
				{
					framework: "react",
					reviewType: undefined,
					context: undefined,
				},
			);
		});

		it("should include review_type option", async () => {
			const result = await handleFrontendReview(mockClient as ReviewClient, {
				code: "<button>Click</button>",
				review_type: "accessibility",
			});

			expect(mockClient.reviewFrontend).toHaveBeenCalledWith(
				"<button>Click</button>",
				["model1", "model2"],
				{
					framework: undefined,
					reviewType: "accessibility",
					context: undefined,
				},
			);
			expect(result.reviewType).toBe("accessibility");
		});

		it("should include context option", async () => {
			await handleFrontendReview(mockClient as ReviewClient, {
				code: "<button>Click</button>",
				context: "Submit button",
			});

			expect(mockClient.reviewFrontend).toHaveBeenCalledWith(
				"<button>Click</button>",
				["model1", "model2"],
				{
					framework: undefined,
					reviewType: undefined,
					context: "Submit button",
				},
			);
		});

		it("should handle all options together", async () => {
			const result = await handleFrontendReview(mockClient as ReviewClient, {
				code: "<button>Click</button>",
				framework: "react",
				review_type: "performance",
				context: "Submit button",
			});

			expect(mockClient.reviewFrontend).toHaveBeenCalledWith(
				"<button>Click</button>",
				["model1", "model2"],
				{
					framework: "react",
					reviewType: "performance",
					context: "Submit button",
				},
			);
			expect(result.reviewType).toBe("performance");
		});
	});
});
