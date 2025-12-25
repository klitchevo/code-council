/**
 * Utility for executing operations in parallel with error handling
 */

import type { ModelReviewResult } from "../review-client";

/**
 * Execute a review function across multiple models in parallel
 * Each model runs independently, failures are captured in the result
 */
export async function executeInParallel(
	models: string[],
	reviewFn: (model: string) => Promise<string>,
): Promise<ModelReviewResult[]> {
	const promises = models.map(async (model): Promise<ModelReviewResult> => {
		try {
			const review = await reviewFn(model);
			return { model, review };
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error";
			return { model, review: "", error: errorMessage };
		}
	});

	return Promise.all(promises);
}
