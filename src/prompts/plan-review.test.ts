import { describe, expect, it } from "vitest";
import { buildUserMessage, SYSTEM_PROMPT } from "./plan-review.js";

describe("plan-review prompts", () => {
	describe("SYSTEM_PROMPT", () => {
		it("should contain architect and planner expertise", () => {
			expect(SYSTEM_PROMPT).toContain("architect");
			expect(SYSTEM_PROMPT).toContain("planner");
		});
	});

	describe("buildUserMessage", () => {
		const testPlan =
			"1. Create database schema\n2. Build API endpoints\n3. Add authentication";

		it("should build a full review message by default", () => {
			const message = buildUserMessage(testPlan);
			expect(message).toContain(testPlan);
			expect(message).toContain("comprehensive plan review");
			expect(message).toContain("feasibility");
			expect(message).toContain("completeness");
			expect(message).toContain("risks");
			expect(message).toContain("timeline");
		});

		it("should focus on feasibility when reviewType is feasibility", () => {
			const message = buildUserMessage(testPlan, "feasibility");
			expect(message).toContain("Focus specifically on feasibility");
			expect(message).toContain("technical complexity");
			expect(message).toContain("dependencies");
			expect(message).toContain(testPlan);
		});

		it("should focus on completeness when reviewType is completeness", () => {
			const message = buildUserMessage(testPlan, "completeness");
			expect(message).toContain("Focus specifically on completeness");
			expect(message).toContain("missing requirements");
			expect(message).toContain("edge cases");
			expect(message).toContain(testPlan);
		});

		it("should focus on risks when reviewType is risks", () => {
			const message = buildUserMessage(testPlan, "risks");
			expect(message).toContain("Focus specifically on risks");
			expect(message).toContain("technical risks");
			expect(message).toContain("security concerns");
			expect(message).toContain(testPlan);
		});

		it("should focus on timeline when reviewType is timeline", () => {
			const message = buildUserMessage(testPlan, "timeline");
			expect(message).toContain("Focus specifically on timeline");
			expect(message).toContain("realistic estimates");
			expect(message).toContain("task breakdown");
			expect(message).toContain(testPlan);
		});

		it("should include context when provided", () => {
			const message = buildUserMessage(
				testPlan,
				"full",
				"2 developers, 1 month deadline",
			);
			expect(message).toContain("2 developers, 1 month deadline");
			expect(message).toContain(testPlan);
		});

		it("should work with context and specific review type", () => {
			const message = buildUserMessage(
				testPlan,
				"risks",
				"Legacy system migration",
			);
			expect(message).toContain("Legacy system migration");
			expect(message).toContain("Focus specifically on risks");
			expect(message).toContain(testPlan);
		});
	});
});
