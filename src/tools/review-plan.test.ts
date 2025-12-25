import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewClient } from "../review-client.js";
import { handlePlanReview, planReviewSchema } from "./review-plan.js";

vi.mock("../logger", () => ({
	logger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}));

vi.mock("../config", () => ({
	PLAN_REVIEW_MODELS: ["model1", "model2"],
}));

describe("review-plan tool", () => {
	let mockClient: Pick<ReviewClient, "reviewPlan"> & Partial<ReviewClient>;

	beforeEach(() => {
		vi.clearAllMocks();
		mockClient = {
			reviewPlan: vi.fn().mockResolvedValue([
				{ model: "model1", review: "Plan looks feasible" },
				{ model: "model2", review: "Timeline is realistic" },
			]),
		} as Pick<ReviewClient, "reviewPlan"> & Partial<ReviewClient>;
	});

	describe("planReviewSchema", () => {
		it("should have required plan field", () => {
			expect(planReviewSchema.plan).toBeDefined();
		});

		it("should have optional review_type field", () => {
			expect(planReviewSchema.review_type).toBeDefined();
		});

		it("should have optional context field", () => {
			expect(planReviewSchema.context).toBeDefined();
		});
	});

	describe("handlePlanReview", () => {
		it("should review plan with minimal input", async () => {
			const result = await handlePlanReview(mockClient as ReviewClient, {
				plan: "Step 1: Create database",
			});

			expect(mockClient.reviewPlan).toHaveBeenCalledWith(
				"Step 1: Create database",
				["model1", "model2"],
				{
					reviewType: undefined,
					context: undefined,
				},
			);
			expect(result.results).toHaveLength(2);
			expect(result.models).toEqual(["model1", "model2"]);
			expect(result.reviewType).toBe("full");
		});

		it("should include review_type option", async () => {
			const result = await handlePlanReview(mockClient as ReviewClient, {
				plan: "Step 1: Create database",
				review_type: "feasibility",
			});

			expect(mockClient.reviewPlan).toHaveBeenCalledWith(
				"Step 1: Create database",
				["model1", "model2"],
				{
					reviewType: "feasibility",
					context: undefined,
				},
			);
			expect(result.reviewType).toBe("feasibility");
		});

		it("should include context option", async () => {
			await handlePlanReview(mockClient as ReviewClient, {
				plan: "Step 1: Create database",
				context: "2 week timeline",
			});

			expect(mockClient.reviewPlan).toHaveBeenCalledWith(
				"Step 1: Create database",
				["model1", "model2"],
				{
					reviewType: undefined,
					context: "2 week timeline",
				},
			);
		});

		it("should handle all review types", async () => {
			for (const review_type of [
				"feasibility",
				"completeness",
				"risks",
				"timeline",
				"full",
			] as const) {
				const result = await handlePlanReview(mockClient as ReviewClient, {
					plan: "Test plan",
					review_type,
				});
				expect(result.reviewType).toBe(review_type);
			}
		});

		it("should handle all options together", async () => {
			const result = await handlePlanReview(mockClient as ReviewClient, {
				plan: "Step 1: Create database",
				review_type: "risks",
				context: "Legacy system migration",
			});

			expect(mockClient.reviewPlan).toHaveBeenCalledWith(
				"Step 1: Create database",
				["model1", "model2"],
				{
					reviewType: "risks",
					context: "Legacy system migration",
				},
			);
			expect(result.reviewType).toBe("risks");
		});
	});
});
