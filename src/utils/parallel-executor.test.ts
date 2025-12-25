import { describe, expect, it, vi } from "vitest";
import { executeInParallel } from "./parallel-executor";

describe("executeInParallel", () => {
	it("should execute function for all models in parallel", async () => {
		const mockReview = vi.fn(async (model: string) => `Review from ${model}`);
		const models = ["model1", "model2", "model3"];

		const results = await executeInParallel(models, mockReview);

		expect(results).toHaveLength(3);
		expect(results[0]).toEqual({
			model: "model1",
			review: "Review from model1",
		});
		expect(results[1]).toEqual({
			model: "model2",
			review: "Review from model2",
		});
		expect(results[2]).toEqual({
			model: "model3",
			review: "Review from model3",
		});
		expect(mockReview).toHaveBeenCalledTimes(3);
	});

	it("should handle errors gracefully and continue with other models", async () => {
		const mockReview = vi.fn(async (model: string) => {
			if (model === "failing-model") {
				throw new Error("Model failed");
			}
			return `Review from ${model}`;
		});

		const models = ["model1", "failing-model", "model2"];
		const results = await executeInParallel(models, mockReview);

		expect(results).toHaveLength(3);
		expect(results[0]).toEqual({
			model: "model1",
			review: "Review from model1",
		});
		expect(results[1]).toEqual({
			model: "failing-model",
			review: "",
			error: "Model failed",
		});
		expect(results[2]).toEqual({
			model: "model2",
			review: "Review from model2",
		});
	});

	it("should handle non-Error exceptions", async () => {
		const mockReview = vi.fn(async (model: string) => {
			if (model === "weird-fail") {
				throw "string error";
			}
			return `Review from ${model}`;
		});

		const models = ["model1", "weird-fail"];
		const results = await executeInParallel(models, mockReview);

		expect(results[1]).toEqual({
			model: "weird-fail",
			review: "",
			error: "Unknown error",
		});
	});

	it("should handle empty model list", async () => {
		const mockReview = vi.fn();
		const results = await executeInParallel([], mockReview);

		expect(results).toEqual([]);
		expect(mockReview).not.toHaveBeenCalled();
	});

	it("should execute all models in parallel (not sequentially)", async () => {
		const executionOrder: string[] = [];
		const mockReview = vi.fn(async (model: string) => {
			executionOrder.push(`start-${model}`);
			await new Promise((resolve) => setTimeout(resolve, 10));
			executionOrder.push(`end-${model}`);
			return `Review from ${model}`;
		});

		await executeInParallel(["model1", "model2"], mockReview);

		// Both should start before either finishes (parallel execution)
		expect(executionOrder[0]).toBe("start-model1");
		expect(executionOrder[1]).toBe("start-model2");
	});
});
