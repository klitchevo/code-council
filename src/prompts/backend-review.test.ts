import { describe, expect, it } from "vitest";
import { buildUserMessage, SYSTEM_PROMPT } from "./backend-review.js";

describe("backend-review prompts", () => {
	describe("SYSTEM_PROMPT", () => {
		it("should contain backend and security expertise", () => {
			expect(SYSTEM_PROMPT).toContain("backend");
			expect(SYSTEM_PROMPT).toContain("security");
		});
	});

	describe("buildUserMessage", () => {
		const testCode =
			"const handler = (req, res) => { res.send(req.query.data); }";

		it("should build a full review message by default", () => {
			const message = buildUserMessage(testCode);
			expect(message).toContain(testCode);
			expect(message).toContain("comprehensive backend review");
			expect(message).toContain("security");
			expect(message).toContain("performance");
			expect(message).toContain("architecture");
		});

		it("should focus on security when reviewType is security", () => {
			const message = buildUserMessage(testCode, "security");
			expect(message).toContain("Focus specifically on security");
			expect(message).toContain("authentication");
			expect(message).toContain("SQL injection");
			expect(message).toContain(testCode);
		});

		it("should focus on performance when reviewType is performance", () => {
			const message = buildUserMessage(testCode, "performance");
			expect(message).toContain("Focus specifically on backend performance");
			expect(message).toContain("database queries");
			expect(message).toContain("caching");
			expect(message).toContain(testCode);
		});

		it("should focus on architecture when reviewType is architecture", () => {
			const message = buildUserMessage(testCode, "architecture");
			expect(message).toContain("Focus specifically on architecture");
			expect(message).toContain("design patterns");
			expect(message).toContain("scalability");
			expect(message).toContain(testCode);
		});

		it("should include language when provided", () => {
			const message = buildUserMessage(testCode, "full", "node");
			expect(message).toContain("Language/Framework: node");
			expect(message).toContain(testCode);
		});

		it("should include context when provided", () => {
			const message = buildUserMessage(
				testCode,
				"full",
				undefined,
				"This is a REST API endpoint",
			);
			expect(message).toContain("This is a REST API endpoint");
			expect(message).toContain(testCode);
		});

		it("should include both language and context when provided", () => {
			const message = buildUserMessage(
				testCode,
				"security",
				"python",
				"Flask application",
			);
			expect(message).toContain("Language/Framework: python");
			expect(message).toContain("Flask application");
			expect(message).toContain("Focus specifically on security");
			expect(message).toContain(testCode);
		});
	});
});
