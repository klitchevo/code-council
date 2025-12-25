import { describe, expect, it, vi } from "vitest";
import { handleListConfig } from "./list-config.js";

vi.mock("../config", () => ({
	CODE_REVIEW_MODELS: ["model1", "model2"],
	FRONTEND_REVIEW_MODELS: ["model3"],
	BACKEND_REVIEW_MODELS: ["model4", "model5"],
	PLAN_REVIEW_MODELS: ["model6"],
}));

describe("list-config tool", () => {
	describe("handleListConfig", () => {
		it("should return configuration text", async () => {
			const result = await handleListConfig();

			expect(result.results).toEqual([]);
			expect(result.models).toEqual([]);
			expect(result.text).toBeDefined();
		});

		it("should include code review models", async () => {
			const result = await handleListConfig();

			expect(result.text).toContain("Code Review Models");
			expect(result.text).toContain("`model1`");
			expect(result.text).toContain("`model2`");
		});

		it("should include frontend review models", async () => {
			const result = await handleListConfig();

			expect(result.text).toContain("Frontend Review Models");
			expect(result.text).toContain("`model3`");
		});

		it("should include backend review models", async () => {
			const result = await handleListConfig();

			expect(result.text).toContain("Backend Review Models");
			expect(result.text).toContain("`model4`");
			expect(result.text).toContain("`model5`");
		});

		it("should include plan review models", async () => {
			const result = await handleListConfig();

			expect(result.text).toContain("Plan Review Models");
			expect(result.text).toContain("`model6`");
		});

		it("should include environment variable names", async () => {
			const result = await handleListConfig();

			expect(result.text).toContain("CODE_REVIEW_MODELS");
			expect(result.text).toContain("FRONTEND_REVIEW_MODELS");
			expect(result.text).toContain("BACKEND_REVIEW_MODELS");
			expect(result.text).toContain("PLAN_REVIEW_MODELS");
		});
	});
});
