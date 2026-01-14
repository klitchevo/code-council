import { describe, expect, it } from "vitest";
import {
	buildInitialMessage,
	DISCUSSION_SYSTEM_PROMPTS,
	getSystemPrompt,
} from "./discussion";

describe("discussion prompts", () => {
	describe("DISCUSSION_SYSTEM_PROMPTS", () => {
		it("should have prompts for all discussion types", () => {
			expect(DISCUSSION_SYSTEM_PROMPTS.code_review).toBeDefined();
			expect(DISCUSSION_SYSTEM_PROMPTS.plan_review).toBeDefined();
			expect(DISCUSSION_SYSTEM_PROMPTS.general).toBeDefined();
		});

		it("code_review prompt should mention code quality", () => {
			expect(DISCUSSION_SYSTEM_PROMPTS.code_review).toContain("code quality");
		});

		it("plan_review prompt should mention architecture", () => {
			expect(DISCUSSION_SYSTEM_PROMPTS.plan_review).toContain("architect");
		});

		it("general prompt should be broadly applicable", () => {
			expect(DISCUSSION_SYSTEM_PROMPTS.general).toContain("advisor");
		});
	});

	describe("getSystemPrompt", () => {
		it("should return correct prompt for code_review", () => {
			const prompt = getSystemPrompt("code_review");
			expect(prompt).toBe(DISCUSSION_SYSTEM_PROMPTS.code_review);
		});

		it("should return correct prompt for plan_review", () => {
			const prompt = getSystemPrompt("plan_review");
			expect(prompt).toBe(DISCUSSION_SYSTEM_PROMPTS.plan_review);
		});

		it("should return correct prompt for general", () => {
			const prompt = getSystemPrompt("general");
			expect(prompt).toBe(DISCUSSION_SYSTEM_PROMPTS.general);
		});
	});

	describe("buildInitialMessage", () => {
		it("should build message for code_review without context", () => {
			const message = buildInitialMessage(
				"Review this implementation",
				"code_review",
			);
			expect(message).toBe(
				"**Code Review Discussion**\n\nReview this implementation",
			);
		});

		it("should build message for plan_review without context", () => {
			const message = buildInitialMessage(
				"What do you think of this plan?",
				"plan_review",
			);
			expect(message).toBe(
				"**Plan Review Discussion**\n\nWhat do you think of this plan?",
			);
		});

		it("should build message for general without context", () => {
			const message = buildInitialMessage(
				"How should we approach this?",
				"general",
			);
			expect(message).toBe("**Discussion**\n\nHow should we approach this?");
		});

		it("should include context when provided", () => {
			const message = buildInitialMessage(
				"Review this code",
				"code_review",
				"```typescript\nconst x = 1;\n```",
			);
			expect(message).toContain("**Code Review Discussion**");
			expect(message).toContain("Review this code");
			expect(message).toContain("**Additional Context:**");
			expect(message).toContain("const x = 1;");
		});

		it("should handle empty context", () => {
			const message = buildInitialMessage("Test message", "general", "");
			// Empty string is falsy, so context section should not appear
			expect(message).toBe("**Discussion**\n\nTest message");
		});
	});
});
