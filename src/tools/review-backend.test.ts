import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewClient } from "../review-client.js";
import { backendReviewSchema, handleBackendReview } from "./review-backend.js";

vi.mock("../logger", () => ({
	logger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

vi.mock("../config", () => ({
	BACKEND_REVIEW_MODELS: ["model1", "model2"],
}));

describe("review-backend tool", () => {
	let mockClient: Pick<ReviewClient, "reviewBackend"> & Partial<ReviewClient>;

	beforeEach(() => {
		vi.clearAllMocks();
		mockClient = {
			reviewBackend: vi.fn().mockResolvedValue([
				{ model: "model1", review: "Security looks good" },
				{ model: "model2", review: "Performance ok" },
			]),
		} as Pick<ReviewClient, "reviewBackend"> & Partial<ReviewClient>;
	});

	describe("backendReviewSchema", () => {
		it("should have required code field", () => {
			expect(backendReviewSchema.code).toBeDefined();
		});

		it("should have optional language field", () => {
			expect(backendReviewSchema.language).toBeDefined();
		});

		it("should have optional review_type field", () => {
			expect(backendReviewSchema.review_type).toBeDefined();
		});

		it("should have optional context field", () => {
			expect(backendReviewSchema.context).toBeDefined();
		});
	});

	describe("handleBackendReview", () => {
		it("should review backend code with minimal input", async () => {
			const result = await handleBackendReview(mockClient as ReviewClient, {
				code: "app.get('/api', handler)",
			});

			expect(mockClient.reviewBackend).toHaveBeenCalledWith(
				"app.get('/api', handler)",
				["model1", "model2"],
				{
					language: undefined,
					reviewType: undefined,
					context: undefined,
				},
			);
			expect(result.results).toHaveLength(2);
			expect(result.models).toEqual(["model1", "model2"]);
			expect(result.reviewType).toBe("full");
		});

		it("should include language option", async () => {
			await handleBackendReview(mockClient as ReviewClient, {
				code: "app.get('/api', handler)",
				language: "node",
			});

			expect(mockClient.reviewBackend).toHaveBeenCalledWith(
				"app.get('/api', handler)",
				["model1", "model2"],
				{
					language: "node",
					reviewType: undefined,
					context: undefined,
				},
			);
		});

		it("should include review_type option", async () => {
			const result = await handleBackendReview(mockClient as ReviewClient, {
				code: "app.get('/api', handler)",
				review_type: "security",
			});

			expect(mockClient.reviewBackend).toHaveBeenCalledWith(
				"app.get('/api', handler)",
				["model1", "model2"],
				{
					language: undefined,
					reviewType: "security",
					context: undefined,
				},
			);
			expect(result.reviewType).toBe("security");
		});

		it("should include context option", async () => {
			await handleBackendReview(mockClient as ReviewClient, {
				code: "app.get('/api', handler)",
				context: "User API endpoint",
			});

			expect(mockClient.reviewBackend).toHaveBeenCalledWith(
				"app.get('/api', handler)",
				["model1", "model2"],
				{
					language: undefined,
					reviewType: undefined,
					context: "User API endpoint",
				},
			);
		});

		it("should handle all options together", async () => {
			const result = await handleBackendReview(mockClient as ReviewClient, {
				code: "app.get('/api', handler)",
				language: "python",
				review_type: "architecture",
				context: "REST API",
			});

			expect(mockClient.reviewBackend).toHaveBeenCalledWith(
				"app.get('/api', handler)",
				["model1", "model2"],
				{
					language: "python",
					reviewType: "architecture",
					context: "REST API",
				},
			);
			expect(result.reviewType).toBe("architecture");
		});
	});
});
